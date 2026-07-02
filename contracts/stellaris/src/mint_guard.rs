//! mint_guard.rs — solvency-gated token minting (Sprint A wedge).
//!
//! `SolvencyGatedToken` is a minimal SEP-41-shaped token whose `mint` path is
//! gated by a FRESH, SOLVENT Stellaris attestation for the current reporting
//! period. This is the Stellar-native analogue of Chainlink's "Secure Mint":
//! issuance cannot exceed what a privacy-preserving solvency proof currently
//! supports, and a stale or absent attestation fails the mint CLOSED.
//!
//! Trust-boundary note (mirrors the protocol's honest scope): the guard enforces
//! that a solvency attestation EXISTS, is for the CURRENT period, is not older
//! than `max_age`, and (optionally) is oracle-/custodian-bound. It does NOT
//! re-prove solvency itself — it reads the verdict the Stellaris contract already
//! verified on-chain via the real Groth16 pairing check. The attestation's
//! truthfulness boundary (C2 custodian / C3 oracle binding) is surfaced as
//! configurable mint requirements, not hidden.
//!
//! ABI impact: NONE on the attestation contract. This is a SEPARATE `#[contract]`
//! type that performs a cross-contract READ (`get_attestation_v3`) against a
//! deployed Stellaris contract. The v1/v2/v3 attestation entrypoints, the
//! proof/VK byte invariants, and the existing suite are all untouched.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env};

use crate::types::AttestationV3;
use crate::StellarisContractClient;

/// Errors surfaced by the solvency-gated token. Distinct from the attestation
/// contract's error enum so a mint failure is unambiguous about WHY the guard
/// blocked issuance.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GuardError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    /// No attestation exists for the issuer at the required period — fail closed.
    NoAttestation = 3,
    /// An attestation exists but its `aggregate_solvent` flag is false. (In
    /// practice the attestation contract refuses to store a non-solvent v3
    /// attestation, so this is a defense-in-depth check, not dead code.)
    NotSolvent = 4,
    /// The attestation's period is older than the guard's configured current
    /// period — i.e. the issuer has not re-attested for the active period.
    StaleAttestationPeriod = 5,
    /// The attestation timestamp is older than `max_age_secs` relative to the
    /// current ledger time — freshness violation.
    StaleAttestationAge = 6,
    /// The guard requires an oracle-bound price commitment but the attestation
    /// is not oracle-bound.
    OracleBindingRequired = 7,
    /// The guard requires a custodian-bound reserve signature but the
    /// attestation is not custodian-bound.
    CustodianBindingRequired = 8,
    /// Mint amount would exceed the supply cap.
    SupplyCapExceeded = 9,
    /// Arithmetic overflow on supply update.
    Overflow = 10,
    /// Mint amount must be strictly positive.
    InvalidAmount = 11,
    /// Current period can only move forward.
    InvalidPeriod = 12,
}

/// Mint-guard configuration. Stored once at `init`.
#[contracttype]
#[derive(Clone)]
pub struct GuardConfig {
    /// The deployed Stellaris attestation contract this token reads.
    pub attestation_contract: Address,
    /// The issuer address whose attestations gate this token (the same address
    /// that calls `attest_v3` on the Stellaris contract).
    pub issuer: Address,
    /// Maximum age (seconds) of an attestation, measured against the current
    /// ledger timestamp, before the guard treats it as stale. 0 disables the
    /// age check (period check still applies).
    pub max_age_secs: u64,
    /// If true, `mint` requires the attestation to be oracle-bound (C3).
    pub require_oracle_bound: bool,
    /// If true, `mint` requires the attestation to be custodian-bound (C2).
    pub require_custodian_bound: bool,
    /// Hard cap on total minted supply. 0 means "no cap".
    pub supply_cap: i128,
}

#[contracttype]
enum GuardKey {
    Config,
    /// The current reporting period the guard gates against. The token admin
    /// advances this as periods roll over; `mint` requires an attestation whose
    /// `period_id` is >= this value.
    CurrentPeriod,
    /// Total minted supply (i128, SEP-41 convention).
    Supply,
    /// Per-address balance.
    Balance(Address),
}

#[contract]
pub struct SolvencyGatedToken;

#[contractimpl]
impl SolvencyGatedToken {
    /// One-time initialization. Binds the token to a Stellaris attestation
    /// contract + issuer and sets the gating policy. `current_period` is the
    /// period the guard initially requires.
    pub fn init(env: Env, config: GuardConfig, current_period: u64) -> Result<(), GuardError> {
        if env.storage().instance().has(&GuardKey::Config) {
            return Err(GuardError::AlreadyInitialized);
        }
        env.storage().instance().set(&GuardKey::Config, &config);
        env.storage()
            .instance()
            .set(&GuardKey::CurrentPeriod, &current_period);
        env.storage().instance().set(&GuardKey::Supply, &0i128);
        Ok(())
    }

    /// Advance (or set) the current reporting period the guard requires. Issuer-
    /// gated: only the configured issuer may roll the period forward. This is how
    /// a new period is opened — after which `mint` blocks until a fresh
    /// attestation for that period is recorded on the Stellaris contract.
    pub fn set_current_period(env: Env, period_id: u64) -> Result<(), GuardError> {
        let config = Self::load_config(&env)?;
        config.issuer.require_auth();
        let current_period: u64 = env
            .storage()
            .instance()
            .get(&GuardKey::CurrentPeriod)
            .ok_or(GuardError::NotInitialized)?;
        if period_id <= current_period {
            return Err(GuardError::InvalidPeriod);
        }
        env.storage()
            .instance()
            .set(&GuardKey::CurrentPeriod, &period_id);
        Ok(())
    }

    /// Mint `amount` to `to`, gated by a fresh solvent attestation.
    ///
    /// The guard reads `get_attestation_v3(issuer, current_period)` from the
    /// Stellaris contract via a cross-contract call and enforces, in order:
    ///   1. an attestation exists for the current period (else NoAttestation);
    ///   2. it is aggregate-solvent (defense-in-depth; else NotSolvent);
    ///   3. its period is not behind the guard's current period (else
    ///      StaleAttestationPeriod);
    ///   4. it is fresh within `max_age_secs` (else StaleAttestationAge);
    ///   5. oracle/custodian binding requirements, if configured;
    ///   6. the supply cap, if configured.
    /// Only if all pass is issuance allowed.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), GuardError> {
        let config = Self::load_config(&env)?;
        config.issuer.require_auth();
        if amount <= 0 {
            return Err(GuardError::InvalidAmount);
        }

        let current_period: u64 = env
            .storage()
            .instance()
            .get(&GuardKey::CurrentPeriod)
            .ok_or(GuardError::NotInitialized)?;

        // --- the solvency gate: cross-contract read of the real attestation ---
        let attestation = Self::read_attestation(&env, &config, current_period)?;
        Self::enforce_guard(&env, &config, &attestation, current_period)?;

        // --- enforcement passed: perform the mint ---
        if config.supply_cap > 0 {
            let supply: i128 = env.storage().instance().get(&GuardKey::Supply).unwrap_or(0);
            let new_supply = supply.checked_add(amount).ok_or(GuardError::Overflow)?;
            if new_supply > config.supply_cap {
                return Err(GuardError::SupplyCapExceeded);
            }
            env.storage().instance().set(&GuardKey::Supply, &new_supply);
        } else {
            let supply: i128 = env.storage().instance().get(&GuardKey::Supply).unwrap_or(0);
            let new_supply = supply.checked_add(amount).ok_or(GuardError::Overflow)?;
            env.storage().instance().set(&GuardKey::Supply, &new_supply);
        }

        let bal: i128 = env
            .storage()
            .instance()
            .get(&GuardKey::Balance(to.clone()))
            .unwrap_or(0);
        let new_bal = bal.checked_add(amount).ok_or(GuardError::Overflow)?;
        env.storage()
            .instance()
            .set(&GuardKey::Balance(to), &new_bal);

        Ok(())
    }

    /// A read-only dry-run of the mint gate: returns Ok(()) if a mint for the
    /// current period would be ALLOWED right now, or the same GuardError `mint`
    /// would return. Lets a UI show "mint is currently blocked because X" without
    /// submitting a transaction.
    pub fn check_mint_allowed(env: Env) -> Result<(), GuardError> {
        let config = Self::load_config(&env)?;
        let current_period: u64 = env
            .storage()
            .instance()
            .get(&GuardKey::CurrentPeriod)
            .ok_or(GuardError::NotInitialized)?;
        let attestation = Self::read_attestation(&env, &config, current_period)?;
        Self::enforce_guard(&env, &config, &attestation, current_period)
    }

    pub fn balance(env: Env, who: Address) -> i128 {
        env.storage()
            .instance()
            .get(&GuardKey::Balance(who))
            .unwrap_or(0)
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&GuardKey::Supply).unwrap_or(0)
    }

    pub fn current_period(env: Env) -> Option<u64> {
        env.storage().instance().get(&GuardKey::CurrentPeriod)
    }

    pub fn get_config(env: Env) -> Option<GuardConfig> {
        env.storage().instance().get(&GuardKey::Config)
    }

    // --- internals ---------------------------------------------------------

    fn load_config(env: &Env) -> Result<GuardConfig, GuardError> {
        env.storage()
            .instance()
            .get(&GuardKey::Config)
            .ok_or(GuardError::NotInitialized)
    }

    /// Cross-contract read of the attestation for `(issuer, period)`.
    fn read_attestation(
        env: &Env,
        config: &GuardConfig,
        period: u64,
    ) -> Result<AttestationV3, GuardError> {
        let client = StellarisContractClient::new(env, &config.attestation_contract);
        client
            .get_attestation_v3(&config.issuer, &period)
            .ok_or(GuardError::NoAttestation)
    }

    /// Pure policy enforcement over a fetched attestation. Separated so both
    /// `mint` and `check_mint_allowed` share identical logic.
    fn enforce_guard(
        env: &Env,
        config: &GuardConfig,
        attestation: &AttestationV3,
        current_period: u64,
    ) -> Result<(), GuardError> {
        if !attestation.aggregate_solvent {
            return Err(GuardError::NotSolvent);
        }
        // The attestation must be for the current period (not an older one).
        if attestation.period_id < current_period {
            return Err(GuardError::StaleAttestationPeriod);
        }
        // Freshness by wall-clock age, if configured.
        if config.max_age_secs > 0 {
            let now = env.ledger().timestamp();
            // Saturating: a future-dated attestation (clock skew) is treated as
            // age 0, never as stale.
            let age = now.saturating_sub(attestation.ledger_ts);
            if age > config.max_age_secs {
                return Err(GuardError::StaleAttestationAge);
            }
        }
        if config.require_oracle_bound && !attestation.oracle_bound {
            return Err(GuardError::OracleBindingRequired);
        }
        if config.require_custodian_bound && !attestation.custodian_bound {
            return Err(GuardError::CustodianBindingRequired);
        }
        Ok(())
    }
}
