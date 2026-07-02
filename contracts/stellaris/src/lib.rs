//! Stellaris contract — ZK Proof-of-Reserves on Stellar.
//!
//! On-chain Soroban smart contract that verifies Groth16 proofs and stores
//! attestation records. Prevents per-period replay and enforces solvency.
//!
//! Part of the Stellaris proof-of-reserves SDK and protocol.

#![no_std]

use soroban_sdk::{contract, contractevent, contractimpl, Address, Env, Vec, U256};

use crate::admin::{get_admin as read_admin, initialize_once, require_issuer_auth};
use crate::bls_sig::verify_custodian_sig;
use crate::signals::{parse_public_signals, parse_public_signals_v2, parse_public_signals_v3};
use crate::storage::{
    append_period, get_oracle as read_oracle, get_vk as read_vk, get_vk_v2 as read_vk_v2,
    get_vk_v3 as read_vk_v3, has_attestation, has_attestation_v2, has_attestation_v3,
    list_periods as read_periods, load_attestation, load_attestation_v2, load_attestation_v3,
    load_custodian, load_oracle_commitment, load_vk, load_vk_v2, load_vk_v3, store_attestation,
    store_attestation_v2, store_attestation_v3, store_custodian, store_oracle,
    store_oracle_commitment, store_vk, store_vk_v2, store_vk_v3,
};
use crate::types::{Attestation, AttestationV2, AttestationV3, StellarisContractError};
use crate::verifier::{dispatch_verify, Groth16Proof, Groth16VerificationKey, VerifierVersion};
use soroban_sdk::crypto::bls12_381::{G1Affine, G2Affine};

mod admin;
mod bls_sig;
// The solvency-gated token is a SEPARATE deployable contract that shares this
// crate ONLY so its end-to-end test can exercise the REAL attestation contract
// (real Groth16 pairing check) via a genuine cross-contract call. It is compiled
// in under `test` only (host target). It is excluded from EVERY wasm build
// because two `#[contract]` types in one crate export colliding bare entrypoint
// symbols (`init`) on wasm32v1-none, and the guard depends on the attestation's
// generated client type so the two cannot be cleanly separated inside one crate.
// Producing a standalone guard WASM therefore requires a crate split — a
// (user-gated) testnet-sprint task. The host test below proves the guard logic
// against real proofs today; the WASM split is a deploy-time packaging concern.
#[cfg(test)]
mod mint_guard;
mod signals;
mod storage;
mod types;
mod verifier;

#[cfg(test)]
mod bls_sig_tests;

#[cfg(test)]
mod test;

#[cfg(test)]
mod test_fixtures;

#[cfg(test)]
mod test_v2;

#[cfg(test)]
mod test_fixtures_v2;

#[cfg(test)]
mod test_d1;

#[cfg(test)]
mod test_v3;

#[cfg(test)]
mod test_mint_guard;

#[cfg(test)]
mod test_fixtures_v3;

#[contractevent(topics = ["attested"])]
pub struct AttestationRecorded {
    #[topic]
    pub issuer: Address,
    #[topic]
    pub period_id: u64,
    pub attestation: Attestation,
}

#[contractevent(topics = ["attested_v2"])]
pub struct AttestationRecordedV2 {
    #[topic]
    pub issuer: Address,
    #[topic]
    pub period_id: u64,
    pub attestation: AttestationV2,
}

#[contractevent(topics = ["attested_v3"])]
pub struct AttestationRecordedV3 {
    #[topic]
    pub issuer: Address,
    #[topic]
    pub period_id: u64,
    pub attestation: AttestationV3,
}

#[contract]
pub struct StellarisContract;

#[contractimpl]
impl StellarisContract {
    pub fn init(
        env: Env,
        admin: Address,
        vk: Groth16VerificationKey,
    ) -> Result<(), StellarisContractError> {
        initialize_once(&env, &admin)?;
        store_vk(&env, &vk);
        Ok(())
    }

    pub fn attest(
        env: Env,
        issuer: Address,
        proof: Groth16Proof,
        pub_signals: Vec<U256>,
    ) -> Result<Attestation, StellarisContractError> {
        require_issuer_auth(&issuer);

        let vk = load_vk(&env)?;
        let parsed = parse_public_signals(&env, &pub_signals)?;

        // Verify through the backend seam (D1). The version tag is Groth16 today;
        // dispatch_verify is the single point a future backend would slot into.
        let proof_ok = dispatch_verify(
            &env,
            VerifierVersion::Groth16.to_u32(),
            &vk,
            &proof,
            &parsed.fr_signals,
        )
        .unwrap_or(false);
        if !proof_ok {
            return Err(StellarisContractError::ProofInvalid);
        }
        if !parsed.solvent {
            return Err(StellarisContractError::NotSolvent);
        }
        if has_attestation(&env, &issuer, parsed.period_id) {
            return Err(StellarisContractError::PeriodAlreadyAttested);
        }

        let attestation = Attestation {
            commitment: parsed.commitment,
            liabilities: parsed.liabilities,
            solvent: true,
            ledger_ts: env.ledger().timestamp(),
            period_id: parsed.period_id,
            issuer: issuer.clone(),
        };

        store_attestation(&env, &attestation);
        append_period(&env, &issuer, parsed.period_id);
        publish_attested_event(&env, &attestation);

        Ok(attestation)
    }

    pub fn get_attestation(env: Env, issuer: Address, period_id: u64) -> Option<Attestation> {
        load_attestation(&env, issuer, period_id)
    }

    pub fn list_periods(env: Env, issuer: Address) -> Vec<u64> {
        read_periods(&env, issuer)
    }

    pub fn get_vk(env: Env) -> Option<Groth16VerificationKey> {
        read_vk(&env)
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        read_admin(&env)
    }

    // --- v2: solvency with SNARK-proven liabilities -------------------------

    /// Register the v2 verification key (5-signal statement). Separate from v1's
    /// `init` so v2 can be enabled independently; requires admin to be set.
    pub fn init_v2(env: Env, vk: Groth16VerificationKey) -> Result<(), StellarisContractError> {
        let admin = read_admin(&env).ok_or(StellarisContractError::NotInitialized)?;
        admin.require_auth();
        if read_vk_v2(&env).is_some() {
            return Err(StellarisContractError::AlreadyInitialized);
        }
        store_vk_v2(&env, &vk);
        Ok(())
    }

    /// Attest solvency against a SNARK-proven liability total. The proof binds
    /// `sum(reserves) >= liabTotal` where `liabTotal` and `liabRoot` are outputs
    /// of the in-circuit Merkle-sum tree — not trusted scalars.
    pub fn attest_v2(
        env: Env,
        issuer: Address,
        proof: Groth16Proof,
        pub_signals: Vec<U256>,
    ) -> Result<AttestationV2, StellarisContractError> {
        require_issuer_auth(&issuer);

        let vk = load_vk_v2(&env)?;
        let parsed = parse_public_signals_v2(&env, &pub_signals)?;

        // Verify through the backend seam (D1) — same dispatch point as v1.
        let proof_ok = dispatch_verify(
            &env,
            VerifierVersion::Groth16.to_u32(),
            &vk,
            &proof,
            &parsed.fr_signals,
        )
        .unwrap_or(false);
        if !proof_ok {
            return Err(StellarisContractError::ProofInvalid);
        }
        if !parsed.solvent {
            return Err(StellarisContractError::NotSolvent);
        }
        if has_attestation_v2(&env, &issuer, parsed.period_id) {
            return Err(StellarisContractError::PeriodAlreadyAttested);
        }

        let attestation = AttestationV2 {
            reserve_commitment: parsed.reserve_commitment,
            liab_root: parsed.liab_root,
            liab_total: parsed.liab_total,
            solvent: true,
            ledger_ts: env.ledger().timestamp(),
            period_id: parsed.period_id,
            issuer: issuer.clone(),
        };

        store_attestation_v2(&env, &attestation);
        append_period(&env, &issuer, parsed.period_id);
        publish_attested_v2_event(&env, &attestation);

        Ok(attestation)
    }

    pub fn get_attestation_v2(env: Env, issuer: Address, period_id: u64) -> Option<AttestationV2> {
        load_attestation_v2(&env, issuer, period_id)
    }

    pub fn get_vk_v2(env: Env) -> Option<Groth16VerificationKey> {
        read_vk_v2(&env)
    }

    // --- v3: multi-asset solvency with oracle-priced aggregate --------------

    /// Register the v3 verification key (8-signal multi-asset statement).
    /// Additive: requires admin (v1 init) to exist; v1/v2 state untouched.
    pub fn init_v3(env: Env, vk: Groth16VerificationKey) -> Result<(), StellarisContractError> {
        let admin = read_admin(&env).ok_or(StellarisContractError::NotInitialized)?;
        admin.require_auth();
        if read_vk_v3(&env).is_some() {
            return Err(StellarisContractError::AlreadyInitialized);
        }
        store_vk_v3(&env, &vk);
        Ok(())
    }

    /// Attest multi-asset solvency. The proof binds per-asset solvency flags and
    /// an oracle-priced aggregate solvency (`sum_a price[a]*reserve[a] >=
    /// sum_a price[a]*liab[a]`), with the prices bound by `priceCommitment`. The
    /// contract requires the AGGREGATE to be solvent to record an attestation;
    /// per-asset flags are stored for transparency (an asset may be individually
    /// underwater while the priced aggregate is solvent).
    pub fn attest_v3(
        env: Env,
        issuer: Address,
        proof: Groth16Proof,
        pub_signals: Vec<U256>,
    ) -> Result<AttestationV3, StellarisContractError> {
        require_issuer_auth(&issuer);

        let vk = load_vk_v3(&env)?;
        let parsed = parse_public_signals_v3(&env, &pub_signals)?;

        // Verify through the backend seam (D1) — same dispatch point as v1/v2.
        let proof_ok = dispatch_verify(
            &env,
            VerifierVersion::Groth16.to_u32(),
            &vk,
            &proof,
            &parsed.fr_signals,
        )
        .unwrap_or(false);
        if !proof_ok {
            return Err(StellarisContractError::ProofInvalid);
        }
        if !parsed.aggregate_solvent {
            return Err(StellarisContractError::NotSolvent);
        }
        if has_attestation_v3(&env, &issuer, parsed.period_id) {
            return Err(StellarisContractError::PeriodAlreadyAttested);
        }

        // C3: if a designated oracle has published a price commitment for this
        // period, the attested price_commitment MUST match it (else OracleMismatch),
        // and the attestation is stamped oracle_bound=true. If no commitment was
        // published, the prices are issuer-chosen and oracle_bound=false. Consumers
        // requiring oracle-bound pricing MUST check the flag — the binding is
        // explicit, not silently optional.
        let oracle_bound = match load_oracle_commitment(&env, parsed.period_id) {
            Some(published) => {
                if published != parsed.price_commitment {
                    return Err(StellarisContractError::OracleMismatch);
                }
                true
            }
            None => false,
        };

        let attestation = AttestationV3 {
            aggregate_solvent: true,
            reserve_commitment: parsed.reserve_commitment,
            price_commitment: parsed.price_commitment,
            asset_solvent: parsed.asset_solvent.clone(),
            oracle_bound,
            custodian_bound: false,
            ledger_ts: env.ledger().timestamp(),
            period_id: parsed.period_id,
            issuer: issuer.clone(),
        };

        store_attestation_v3(&env, &attestation);
        append_period(&env, &issuer, parsed.period_id);
        publish_attested_v3_event(&env, &attestation);

        Ok(attestation)
    }

    pub fn get_attestation_v3(env: Env, issuer: Address, period_id: u64) -> Option<AttestationV3> {
        load_attestation_v3(&env, issuer, period_id)
    }

    pub fn get_vk_v3(env: Env) -> Option<Groth16VerificationKey> {
        read_vk_v3(&env)
    }

    // --- C3: designated price-oracle + per-period published commitments ------

    /// Designate the price-oracle authority (admin-only). The oracle is the
    /// account allowed to publish per-period price commitments that `attest_v3`
    /// enforces. Additive: requires admin (v1 init) to exist.
    pub fn set_oracle(env: Env, oracle: Address) -> Result<(), StellarisContractError> {
        let admin = read_admin(&env).ok_or(StellarisContractError::NotInitialized)?;
        admin.require_auth();
        store_oracle(&env, &oracle);
        Ok(())
    }

    /// Publish the authoritative price commitment for a reporting period. Only
    /// the designated oracle may call this (its Stellar keypair signs the tx —
    /// the contract-boundary authentication). A subsequent `attest_v3` for the
    /// same period MUST present a matching `priceCommitment` or be rejected with
    /// `OracleMismatch`. Re-publishing overwrites (the oracle can correct a feed
    /// before an attestation binds to it).
    pub fn publish_oracle_commitment(
        env: Env,
        period_id: u64,
        commitment: U256,
    ) -> Result<(), StellarisContractError> {
        let oracle = read_oracle(&env).ok_or(StellarisContractError::OracleNotConfigured)?;
        oracle.require_auth();
        store_oracle_commitment(&env, period_id, &commitment);
        Ok(())
    }

    pub fn get_oracle(env: Env) -> Option<Address> {
        read_oracle(&env)
    }

    pub fn get_oracle_commitment(env: Env, period_id: u64) -> Option<U256> {
        load_oracle_commitment(&env, period_id)
    }

    // --- C2: designated custodian + BLS-signed reserve attestation -----------

    /// Designate the custodian BLS public key (G2), admin-only. The custodian is
    /// the off-chain party (exchange/bank) whose signature over the
    /// `reserveCommitment` `attest_v3_signed` verifies. Additive: requires admin.
    pub fn set_custodian(env: Env, pk: G2Affine) -> Result<(), StellarisContractError> {
        let admin = read_admin(&env).ok_or(StellarisContractError::NotInitialized)?;
        admin.require_auth();
        store_custodian(&env, &pk);
        Ok(())
    }

    /// Attest multi-asset solvency WITH a custodian BLS signature over the
    /// reserve_commitment. Identical to `attest_v3` (Groth16 proof + aggregate
    /// solvency + C3 oracle binding) but ALSO requires a real BLS12-381 signature
    /// from the designated custodian over the public `reserve_commitment`,
    /// verified on-chain via the pairing host function. On success the
    /// attestation is stamped `custodian_bound=true`.
    ///
    /// This is the reserve-side sibling of C3's oracle binding: C3 binds prices
    /// to an oracle authority; C2 binds reserves to a named custodian. Because the
    /// custodian signs the COMMITMENT (already public) and C1 proved the
    /// commitment binds the exact balances, "custodian X signed these reserves"
    /// holds without revealing balances.
    pub fn attest_v3_signed(
        env: Env,
        issuer: Address,
        proof: Groth16Proof,
        pub_signals: Vec<U256>,
        custodian_sig: G1Affine,
    ) -> Result<AttestationV3, StellarisContractError> {
        require_issuer_auth(&issuer);

        let vk = load_vk_v3(&env)?;
        let parsed = parse_public_signals_v3(&env, &pub_signals)?;

        let proof_ok = dispatch_verify(
            &env,
            VerifierVersion::Groth16.to_u32(),
            &vk,
            &proof,
            &parsed.fr_signals,
        )
        .unwrap_or(false);
        if !proof_ok {
            return Err(StellarisContractError::ProofInvalid);
        }
        if !parsed.aggregate_solvent {
            return Err(StellarisContractError::NotSolvent);
        }
        if has_attestation_v3(&env, &issuer, parsed.period_id) {
            return Err(StellarisContractError::PeriodAlreadyAttested);
        }

        // C2: a custodian must be configured, and its BLS signature over the
        // reserve_commitment must verify on-chain (else CustodianSigInvalid).
        let custodian_pk =
            load_custodian(&env).ok_or(StellarisContractError::CustodianNotConfigured)?;
        if !verify_custodian_sig(
            &env,
            &custodian_pk,
            &custodian_sig,
            &parsed.reserve_commitment,
        ) {
            return Err(StellarisContractError::CustodianSigInvalid);
        }

        // C3 oracle binding still applies (same logic as attest_v3).
        let oracle_bound = match load_oracle_commitment(&env, parsed.period_id) {
            Some(published) => {
                if published != parsed.price_commitment {
                    return Err(StellarisContractError::OracleMismatch);
                }
                true
            }
            None => false,
        };

        let attestation = AttestationV3 {
            aggregate_solvent: true,
            reserve_commitment: parsed.reserve_commitment,
            price_commitment: parsed.price_commitment,
            asset_solvent: parsed.asset_solvent.clone(),
            oracle_bound,
            custodian_bound: true,
            ledger_ts: env.ledger().timestamp(),
            period_id: parsed.period_id,
            issuer: issuer.clone(),
        };

        store_attestation_v3(&env, &attestation);
        append_period(&env, &issuer, parsed.period_id);
        publish_attested_v3_event(&env, &attestation);

        Ok(attestation)
    }

    pub fn get_custodian(env: Env) -> Option<G2Affine> {
        load_custodian(&env)
    }
}

fn publish_attested_event(env: &Env, attestation: &Attestation) {
    AttestationRecorded {
        issuer: attestation.issuer.clone(),
        period_id: attestation.period_id,
        attestation: attestation.clone(),
    }
    .publish(env);
}

fn publish_attested_v2_event(env: &Env, attestation: &AttestationV2) {
    AttestationRecordedV2 {
        issuer: attestation.issuer.clone(),
        period_id: attestation.period_id,
        attestation: attestation.clone(),
    }
    .publish(env);
}

fn publish_attested_v3_event(env: &Env, attestation: &AttestationV3) {
    AttestationRecordedV3 {
        issuer: attestation.issuer.clone(),
        period_id: attestation.period_id,
        attestation: attestation.clone(),
    }
    .publish(env);
}
