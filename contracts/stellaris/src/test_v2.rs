//! test_v2.rs — Contract v2 unit tests using REAL Groth16 proofs over the
//! solvency-with-proven-liabilities statement (por_v2.circom, 5 public signals).
//!
//! These verify ACTUAL BLS12-381 proofs produced by setup/ceremony-v2.sh +
//! setup/export-fixtures-v2.sh and codegen'd into test_fixtures_v2.rs. No mock
//! VK — the proofs exercise the real on-chain pairing check in verifier.rs over
//! the 6-element IC (5 signals + 1) v2 verification key.
//!
//! v2 is additive: v1 `init`/`attest` and the 11 v1 tests are untouched. These
//! tests drive `init_v2`/`attest_v2`/`get_attestation_v2`.
//!
//! Coverage:
//!   - test_attest_v2_solvent_real:   real solvent v2 proof -> AttestationV2 stored
//!   - test_attest_v2_reject_insolvent_real: valid proof, solvent=0 -> NotSolvent
//!   - test_attest_v2_reject_wrong_signals:  mismatched signals -> ProofInvalid
//!   - test_attest_v2_replay:         same period twice -> PeriodAlreadyAttested
//!   - test_attest_v2_bad_signal_count: wrong arity -> BadPublicSignals
//!   - test_v1_v2_isolation:          a v1 (4-signal) proof rejected by attest_v2
//!   - test_attest_v2_requires_init_v2: attest_v2 before init_v2 -> NotInitialized

extern crate std;

use crate::test::{build_signals_n, g1_from, g2_from};
use crate::test_fixtures::VkData;
use crate::test_fixtures_v2::{INSOLVENT_V2, SOLVENT_V2, VK_V2};
use crate::types::StellarisContractError;
use crate::verifier::{Groth16Proof, Groth16VerificationKey};
use crate::{StellarisContract, StellarisContractClient};

use soroban_sdk::{crypto::bls12_381::G1Affine, testutils::Address as _, Address, Env, Vec, U256};

/// Build the v2 verification key (IC length = 6) from codegen'd data.
fn build_vk_v2(env: &Env) -> Groth16VerificationKey {
    // VkDataV2 has the same field shape as VkData; reuse the v1 builder via a
    // local shim by reconstructing through g1_from/g2_from.
    let mut ic: Vec<G1Affine> = Vec::new(env);
    for point in VK_V2.ic.iter() {
        ic.push_back(g1_from(env, point));
    }
    Groth16VerificationKey {
        alpha: g1_from(env, &VK_V2.alpha),
        beta: g2_from(env, &VK_V2.beta),
        gamma: g2_from(env, &VK_V2.gamma),
        delta: g2_from(env, &VK_V2.delta),
        ic,
    }
}

fn solvent_v2_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        a: g1_from(env, &SOLVENT_V2.a),
        b: g2_from(env, &SOLVENT_V2.b),
        c: g1_from(env, &SOLVENT_V2.c),
    }
}

fn insolvent_v2_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        a: g1_from(env, &INSOLVENT_V2.a),
        b: g2_from(env, &INSOLVENT_V2.b),
        c: g1_from(env, &INSOLVENT_V2.c),
    }
}

/// Register, init (v1), and init_v2 with the real v2 VK.
fn setup_v2() -> (Env, StellarisContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);

    // v1 init establishes admin; init_v2 registers the v2 VK.
    let v1_vk = build_v1_vk(&env);
    client.init(&admin, &v1_vk);
    let v2_vk = build_vk_v2(&env);
    client.init_v2(&v2_vk);
    (env, client, admin)
}

/// A structurally-valid v1 VK (reuse the v1 fixture) so `init` succeeds.
fn build_v1_vk(env: &Env) -> Groth16VerificationKey {
    use crate::test_fixtures::VK;
    let v: &VkData = &VK;
    let mut ic: Vec<G1Affine> = Vec::new(env);
    for point in v.ic.iter() {
        ic.push_back(g1_from(env, point));
    }
    Groth16VerificationKey {
        alpha: g1_from(env, &v.alpha),
        beta: g2_from(env, &v.beta),
        gamma: g2_from(env, &v.gamma),
        delta: g2_from(env, &v.delta),
        ic,
    }
}

// ---------------------------------------------------------------------------
// Real v2 proof verification
// ---------------------------------------------------------------------------

#[test]
fn test_attest_v2_solvent_real() {
    let (env, client, admin) = setup_v2();
    let proof = solvent_v2_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V2.signals);

    let att = client.attest_v2(&admin, &proof, &signals);
    assert!(att.solvent, "solvent v2 proof must yield solvent=true");
    // liabTotal is the SNARK-proven total (signal index 3), not a declared scalar.
    assert_eq!(att.period_id, 1u64);

    let stored = client.get_attestation_v2(&admin, &1);
    assert!(stored.is_some(), "v2 attestation must be retrievable");
    assert_eq!(stored.unwrap().liab_total, att.liab_total);
}

#[test]
fn test_attest_v2_reject_insolvent_real() {
    let (env, client, admin) = setup_v2();
    let proof = insolvent_v2_proof(&env);
    let signals = build_signals_n(&env, &INSOLVENT_V2.signals);

    let result = client.try_attest_v2(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::NotSolvent),
        "valid v2 proof with solvent=0 must be rejected as NotSolvent"
    );
}

#[test]
fn test_attest_v2_reject_wrong_signals() {
    // Real solvent v2 proof, but insolvent public signals -> pairing fails.
    let (env, client, admin) = setup_v2();
    let proof = solvent_v2_proof(&env);
    let signals = build_signals_n(&env, &INSOLVENT_V2.signals);

    let result = client.try_attest_v2(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::ProofInvalid),
        "mismatched public signals must fail the v2 pairing check"
    );
}

#[test]
fn test_attest_v2_replay() {
    let (env, client, admin) = setup_v2();
    let proof = solvent_v2_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V2.signals);

    client.attest_v2(&admin, &proof, &signals);
    let result = client.try_attest_v2(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::PeriodAlreadyAttested)
    );
}

#[test]
fn test_attest_v2_bad_signal_count() {
    let (env, client, admin) = setup_v2();
    let proof = solvent_v2_proof(&env);

    // Only 4 signals instead of the required 5.
    let mut signals: Vec<U256> = Vec::new(&env);
    for s in SOLVENT_V2.signals.iter().take(4) {
        signals.push_back(crate::test::u256_from_dec(&env, s));
    }

    let result = client.try_attest_v2(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::BadPublicSignals)
    );
}

#[test]
fn test_v1_v2_isolation() {
    // A v1 (4-signal) proof must be rejected by attest_v2: wrong arity vs the
    // v2 VK (IC length 6 expects 5 signals). The signals.rs length guard fires.
    let (env, client, admin) = setup_v2();
    use crate::test_fixtures::SOLVENT;
    let proof = Groth16Proof {
        a: g1_from(&env, &SOLVENT.a),
        b: g2_from(&env, &SOLVENT.b),
        c: g1_from(&env, &SOLVENT.c),
    };
    let mut signals: Vec<U256> = Vec::new(&env);
    for s in SOLVENT.signals.iter() {
        signals.push_back(crate::test::u256_from_dec(&env, s));
    }
    let result = client.try_attest_v2(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::BadPublicSignals),
        "a 4-signal v1 proof must not satisfy the 5-signal v2 statement"
    );
}

#[test]
fn test_attest_v2_requires_init_v2() {
    // attest_v2 before init_v2 -> NotInitialized (no VkV2 stored).
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    let v1_vk = build_v1_vk(&env);
    client.init(&admin, &v1_vk); // v1 only; no init_v2

    let proof = solvent_v2_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V2.signals);
    let result = client.try_attest_v2(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::NotInitialized)
    );
}

#[test]
fn test_init_v2_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);

    env.mock_all_auths();
    client.init(&admin, &build_v1_vk(&env));
    env.set_auths(&[]);

    let result = client.try_init_v2(&build_vk_v2(&env));
    assert!(result.is_err(), "init_v2 without admin auth must fail");
}

#[test]
fn test_init_v2_cannot_replace_vk() {
    let (env, client, _) = setup_v2();
    let result = client.try_init_v2(&build_vk_v2(&env));
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::AlreadyInitialized),
        "init_v2 must be one-time so the verified circuit cannot be swapped"
    );
}
