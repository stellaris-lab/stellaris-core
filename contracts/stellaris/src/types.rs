//! Contract types, storage keys, errors, and public-signal constants.

use soroban_sdk::{contracterror, contracttype, crypto::bls12_381::Fr, Address, Vec, U256};

// ---------------------------------------------------------------------------
// Public-signal index constants (must match circuits/PUBLIC_SIGNALS.md)
// ---------------------------------------------------------------------------

pub const SIG_SOLVENT: usize = 0;
pub const SIG_COMMITMENT: usize = 1;
pub const SIG_LIABILITIES: usize = 2;
pub const SIG_PERIOD: usize = 3;
pub const N_PUBLIC_SIGNALS: usize = 4;

// v2 public-signal indices (mirror PUBLIC_SIGNALS.md v2; see por_v2.circom).
// Order: [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
pub const SIG2_SOLVENT: usize = 0;
pub const SIG2_RESERVE_COMMITMENT: usize = 1;
pub const SIG2_LIAB_ROOT: usize = 2;
pub const SIG2_LIAB_TOTAL: usize = 3;
pub const SIG2_PERIOD: usize = 4;
pub const N_PUBLIC_SIGNALS_V2: usize = 5;

// v3 public-signal indices (multi-asset solvency; see por_v3.circom).
// Order: [ aggregateSolvent, reserveCommitment, priceCommitment,
//          assetSolvent[0..N_ASSETS_V3-1], period ]
pub const SIG3_AGGREGATE_SOLVENT: usize = 0;
pub const SIG3_RESERVE_COMMITMENT: usize = 1;
pub const SIG3_PRICE_COMMITMENT: usize = 2;
pub const SIG3_ASSET_SOLVENT_BASE: usize = 3; // assetSolvent[a] at base + a
pub const N_ASSETS_V3: usize = 4;
pub const SIG3_PERIOD: usize = SIG3_ASSET_SOLVENT_BASE + N_ASSETS_V3; // = 7
pub const N_PUBLIC_SIGNALS_V3: usize = SIG3_PERIOD + 1; // = 8

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum StellarisContractError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ProofInvalid = 4,
    NotSolvent = 5,
    PeriodAlreadyAttested = 6,
    BadPublicSignals = 7,
    BadProofEncoding = 8,
    BadLiabilityRoot = 9,
    WrongVerifierVersion = 10,
    // C3: the attested priceCommitment does not match the oracle-published
    // commitment for the period.
    OracleMismatch = 11,
    // C3: no designated oracle has been configured (set_oracle not yet called).
    OracleNotConfigured = 12,
    // C2: no designated custodian key configured (set_custodian not yet called).
    CustodianNotConfigured = 13,
    // C2: the custodian BLS signature over the reserveCommitment did not verify.
    CustodianSigInvalid = 14,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Vk,
    Admin,
    Attest(Address, u64),
    Periods(Address),
    // v2: parallel verification key + attestation namespace (additive; v1 keys
    // are untouched so existing attestations and the 11 v1 tests keep working).
    VkV2,
    AttestV2(Address, u64),
    // v3: multi-asset verification key + attestation namespace (additive).
    VkV3,
    AttestV3(Address, u64),
    // C3: designated price-oracle authority, and per-period published price
    // commitments. Additive; v1/v2/v3 storage untouched.
    Oracle,
    OracleCommitment(u64),
    // C2: designated custodian BLS public key (G2). Additive.
    Custodian,
}

// ---------------------------------------------------------------------------
// On-chain attestation and parsed signal models
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Attestation {
    pub commitment: U256,
    pub liabilities: u128,
    pub solvent: bool,
    pub ledger_ts: u64,
    pub period_id: u64,
    pub issuer: Address,
}

#[derive(Clone)]
pub struct ParsedSignals {
    pub solvent: bool,
    pub commitment: U256,
    pub liabilities: u128,
    pub period_id: u64,
    pub fr_signals: Vec<Fr>,
}

// --- v2: solvency with SNARK-proven liabilities -----------------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AttestationV2 {
    pub reserve_commitment: U256,
    pub liab_root: U256, // SNARK-proven Merkle-sum liability root (full-width hash)
    pub liab_total: u128, // proven total liabilities (NOT a declared scalar)
    pub solvent: bool,
    pub ledger_ts: u64,
    pub period_id: u64,
    pub issuer: Address,
}

#[derive(Clone)]
pub struct ParsedSignalsV2 {
    pub solvent: bool,
    pub reserve_commitment: U256,
    pub liab_root: U256,
    pub liab_total: u128,
    pub period_id: u64,
    pub fr_signals: Vec<Fr>,
}

// --- v3: multi-asset solvency with oracle-priced aggregate ------------------

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AttestationV3 {
    pub aggregate_solvent: bool,
    pub reserve_commitment: U256,
    pub price_commitment: U256,
    pub asset_solvent: Vec<bool>, // per-asset solvency flags (len == N_ASSETS_V3)
    // C3 provenance: true iff a designated-oracle commitment was published for
    // this period AND the attested price_commitment matched it. When false, the
    // prices are issuer-chosen (self-asserted); a consumer requiring oracle-bound
    // pricing MUST check this flag. This makes the trust boundary explicit rather
    // than silently optional.
    pub oracle_bound: bool,
    // C2 provenance: true iff a designated custodian's BLS signature over the
    // reserve_commitment was presented AND verified on-chain. When false, the
    // reserves are not custodian-attested; a consumer requiring a named-custodian
    // signature MUST check this flag. Mirrors `oracle_bound` — explicit, not
    // silently optional.
    pub custodian_bound: bool,
    pub ledger_ts: u64,
    pub period_id: u64,
    pub issuer: Address,
}

#[derive(Clone)]
pub struct ParsedSignalsV3 {
    pub aggregate_solvent: bool,
    pub reserve_commitment: U256,
    pub price_commitment: U256,
    pub asset_solvent: Vec<bool>,
    pub period_id: u64,
    pub fr_signals: Vec<Fr>,
}
