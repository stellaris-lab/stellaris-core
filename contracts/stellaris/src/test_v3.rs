//! test_v3.rs — Contract v3 unit tests using REAL Groth16 proofs over the
//! multi-asset solvency statement (por_v3.circom, 8 public signals).
//!
//! These verify ACTUAL BLS12-381 proofs produced by setup/ceremony-v3.sh +
//! setup/export-fixtures-v3.sh and codegen'd into test_fixtures_v3.rs. No mock
//! VK — the proofs exercise the real on-chain pairing check in verifier.rs over
//! the 9-element IC (8 signals + 1) v3 verification key, through the D1 backend
//! seam.
//!
//! v3 is additive: v1/v2 state + tests are untouched. These drive
//! `init_v3`/`attest_v3`/`get_attestation_v3`.
//!
//! Public-signal order (8): [ aggregateSolvent, reserveCommitment,
//!   priceCommitment, assetSolvent[0..3], period ]
//!
//! Coverage:
//!
//! - `test_attest_v3_solvent_real`: real solvent proof -> AttestationV3 stored;
//!   all 4 asset flags true
//! - `test_attest_v3_one_asset_underwater`: HEADLINE multi-asset property — asset 0
//!   underwater (flag=0) yet aggregate solvent; attestation records the flags
//! - `test_attest_v3_reject_priced_insolvent`: valid proof, aggregateSolvent=0 ->
//!   NotSolvent (and nothing stored)
//! - `test_attest_v3_replay`: same period twice -> PeriodAlreadyAttested
//! - `test_attest_v3_bad_signal_count`: wrong arity -> BadPublicSignals
//! - `test_attest_v3_requires_init_v3`: attest_v3 before init_v3 -> NotInitialized
//! - `test_v3_isolation_from_v2`: a v2 (5-signal) proof rejected by attest_v3

extern crate std;

use crate::test::{build_signals_n, g1_from, g2_from};
use crate::test_fixtures::VkData;
use crate::test_fixtures_v3::{ONE_ASSET_UNDERWATER_V3, PRICED_INSOLVENT_V3, SOLVENT_V3, VK_V3};
use crate::types::StellarisContractError;
use crate::verifier::{Groth16Proof, Groth16VerificationKey};
use crate::{StellarisContract, StellarisContractClient};

use soroban_sdk::{crypto::bls12_381::G1Affine, testutils::Address as _, Address, Env, Vec, U256};

/// Build the v3 verification key (IC length = 9) from codegen'd data.
fn build_vk_v3(env: &Env) -> Groth16VerificationKey {
    let mut ic: Vec<G1Affine> = Vec::new(env);
    for point in VK_V3.ic.iter() {
        ic.push_back(g1_from(env, point));
    }
    Groth16VerificationKey {
        alpha: g1_from(env, &VK_V3.alpha),
        beta: g2_from(env, &VK_V3.beta),
        gamma: g2_from(env, &VK_V3.gamma),
        delta: g2_from(env, &VK_V3.delta),
        ic,
    }
}

fn solvent_v3_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        a: g1_from(env, &SOLVENT_V3.a),
        b: g2_from(env, &SOLVENT_V3.b),
        c: g1_from(env, &SOLVENT_V3.c),
    }
}

fn underwater_v3_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        a: g1_from(env, &ONE_ASSET_UNDERWATER_V3.a),
        b: g2_from(env, &ONE_ASSET_UNDERWATER_V3.b),
        c: g1_from(env, &ONE_ASSET_UNDERWATER_V3.c),
    }
}

fn priced_insolvent_v3_proof(env: &Env) -> Groth16Proof {
    Groth16Proof {
        a: g1_from(env, &PRICED_INSOLVENT_V3.a),
        b: g2_from(env, &PRICED_INSOLVENT_V3.b),
        c: g1_from(env, &PRICED_INSOLVENT_V3.c),
    }
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

/// Register, init (v1, establishes admin), and init_v3 with the real v3 VK.
fn setup_v3() -> (Env, StellarisContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);

    let v1_vk = build_v1_vk(&env);
    client.init(&admin, &v1_vk);
    let v3_vk = build_vk_v3(&env);
    client.init_v3(&v3_vk);
    (env, client, admin)
}

// ---------------------------------------------------------------------------
// Real v3 proof verification
// ---------------------------------------------------------------------------

#[test]
fn test_attest_v3_solvent_real() {
    let (env, client, admin) = setup_v3();
    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);

    let att = client.attest_v3(&admin, &proof, &signals);
    assert!(
        att.aggregate_solvent,
        "solvent v3 proof must be aggregate-solvent"
    );
    assert_eq!(att.period_id, 1u64);
    assert_eq!(att.asset_solvent.len(), 4, "four per-asset flags");
    for a in 0..4u32 {
        assert!(
            att.asset_solvent.get(a).unwrap(),
            "all assets solvent in the solvent scenario"
        );
    }

    let stored = client.get_attestation_v3(&admin, &1);
    assert!(stored.is_some(), "v3 attestation must be retrievable");
    assert_eq!(stored.unwrap().price_commitment, att.price_commitment);
}

#[test]
fn test_attest_v3_one_asset_underwater() {
    // HEADLINE multi-asset property: asset 0 is individually underwater
    // (assetSolvent[0]=0) yet the price-weighted aggregate is solvent, so the
    // attestation is recorded WITH the per-asset breakdown preserved.
    let (env, client, admin) = setup_v3();
    let proof = underwater_v3_proof(&env);
    let signals = build_signals_n(&env, &ONE_ASSET_UNDERWATER_V3.signals);

    let att = client.attest_v3(&admin, &proof, &signals);
    assert!(
        att.aggregate_solvent,
        "aggregate must be solvent even with one asset underwater"
    );
    assert!(
        !att.asset_solvent.get(0).unwrap(),
        "asset 0 must be recorded as individually underwater (flag=0)"
    );
    assert!(
        att.asset_solvent.get(1).unwrap()
            && att.asset_solvent.get(2).unwrap()
            && att.asset_solvent.get(3).unwrap(),
        "assets 1..3 remain solvent"
    );
}

#[test]
fn test_attest_v3_reject_priced_insolvent() {
    // A cryptographically VALID proof whose aggregateSolvent signal is 0.
    // Proof verifies; the contract then rejects on the aggregate-solvency gate.
    let (env, client, admin) = setup_v3();
    let proof = priced_insolvent_v3_proof(&env);
    let signals = build_signals_n(&env, &PRICED_INSOLVENT_V3.signals);

    let result = client.try_attest_v3(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::NotSolvent),
        "valid v3 proof with aggregateSolvent=0 must be rejected as NotSolvent"
    );
    assert!(
        client.get_attestation_v3(&admin, &1).is_none(),
        "nothing is stored for a rejected attestation"
    );
}

#[test]
fn test_attest_v3_replay() {
    let (env, client, admin) = setup_v3();
    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);

    client.attest_v3(&admin, &proof, &signals);
    let result = client.try_attest_v3(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::PeriodAlreadyAttested),
        "replaying the same v3 period must fail"
    );
}

// ---------------------------------------------------------------------------
// Structural / isolation rejections
// ---------------------------------------------------------------------------

#[test]
fn test_attest_v3_bad_signal_count() {
    let (env, client, admin) = setup_v3();
    let proof = solvent_v3_proof(&env);

    // Only 5 signals instead of the required 8.
    let mut signals: Vec<U256> = Vec::new(&env);
    for s in SOLVENT_V3.signals.iter().take(5) {
        signals.push_back(crate::test::u256_from_dec(&env, s));
    }
    let result = client.try_attest_v3(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::BadPublicSignals),
        "wrong v3 signal arity must be rejected as BadPublicSignals"
    );
}

#[test]
fn test_attest_v3_requires_init_v3() {
    // admin set (v1 init) but NO v3 VK -> attest_v3 hits load_vk_v3 guard.
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    client.init(&admin, &build_v1_vk(&env));

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let result = client.try_attest_v3(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::NotInitialized),
        "attest_v3 before init_v3 must fail with NotInitialized"
    );
}

#[test]
fn test_v3_isolation_from_v2() {
    // A v2 (5-signal) proof must be rejected by attest_v3: wrong arity vs the
    // 8-signal v3 statement. Confirms the namespaces don't cross.
    use crate::test_fixtures_v2::SOLVENT_V2;
    let (env, client, admin) = setup_v3();
    let proof = solvent_v3_proof(&env);
    // Feed v2's 5 signals into the v3 entry point.
    let signals = build_signals_n(&env, &SOLVENT_V2.signals);
    let result = client.try_attest_v3(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::BadPublicSignals),
        "a 5-signal v2 payload must not satisfy the 8-signal v3 statement"
    );
}

// ---------------------------------------------------------------------------
// C3: designated price-oracle + per-period commitment binding
// ---------------------------------------------------------------------------

/// The priceCommitment public signal (index 2) of the solvent v3 fixture, as a
/// U256 — the value a matching oracle commitment must equal.
fn solvent_v3_price_commitment(env: &Env) -> U256 {
    use crate::test::u256_from_dec;
    u256_from_dec(env, SOLVENT_V3.signals[2])
}

#[test]
fn test_c3_oracle_bound_true_on_match() {
    // Oracle publishes the SAME priceCommitment the proof carries -> attest_v3
    // binds and stamps oracle_bound = true.
    let (env, client, admin) = setup_v3();
    let oracle = Address::generate(&env);
    client.set_oracle(&oracle);

    // period_id of the solvent fixture is 1 (signal index 7).
    client.publish_oracle_commitment(&1u64, &solvent_v3_price_commitment(&env));

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let att = client.attest_v3(&admin, &proof, &signals);
    assert!(
        att.oracle_bound,
        "matching oracle commitment must stamp oracle_bound=true"
    );

    let stored = client.get_attestation_v3(&admin, &1).unwrap();
    assert!(stored.oracle_bound, "provenance flag must persist");
    assert_eq!(
        client.get_oracle().unwrap(),
        oracle,
        "designated oracle is retrievable"
    );
}

#[test]
fn test_c3_oracle_mismatch_rejected() {
    // Oracle publishes a DIFFERENT commitment than the proof carries -> the
    // attestation is rejected with OracleMismatch (nothing stored).
    let (env, client, admin) = setup_v3();
    let oracle = Address::generate(&env);
    client.set_oracle(&oracle);

    // Publish a commitment that does NOT match the fixture's priceCommitment.
    let wrong = U256::from_u32(&env, 999_999u32);
    client.publish_oracle_commitment(&1u64, &wrong);

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let result = client.try_attest_v3(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::OracleMismatch),
        "a priceCommitment not matching the published oracle commitment must be rejected"
    );
    assert!(
        client.get_attestation_v3(&admin, &1).is_none(),
        "rejected attestation must not be stored"
    );
}

#[test]
fn test_c3_unbound_when_no_commitment_published() {
    // No oracle commitment for the period -> attest_v3 still succeeds but
    // oracle_bound = false (issuer-chosen prices, explicit provenance).
    let (env, client, admin) = setup_v3();
    let oracle = Address::generate(&env);
    client.set_oracle(&oracle);
    // Note: NO publish_oracle_commitment call.

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let att = client.attest_v3(&admin, &proof, &signals);
    assert!(
        !att.oracle_bound,
        "without a published commitment, oracle_bound must be false"
    );
}

#[test]
fn test_c3_publish_requires_oracle_configured() {
    // publish_oracle_commitment before set_oracle -> OracleNotConfigured.
    let (env, client, _admin) = setup_v3();
    let result = client.try_publish_oracle_commitment(&1u64, &U256::from_u32(&env, 1u32));
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::OracleNotConfigured),
        "publishing before a designated oracle is set must fail"
    );
}

#[test]
fn test_c3_oracle_commitment_readable() {
    // A published commitment is retrievable via get_oracle_commitment.
    let (env, client, _admin) = setup_v3();
    let oracle = Address::generate(&env);
    client.set_oracle(&oracle);
    let c = U256::from_u32(&env, 4242u32);
    client.publish_oracle_commitment(&7u64, &c);

    assert_eq!(
        client.get_oracle_commitment(&7u64),
        Some(c),
        "published commitment must be readable"
    );
    assert_eq!(
        client.get_oracle_commitment(&8u64),
        None,
        "unpublished period returns None"
    );
}

#[test]
fn test_c3_publish_requires_oracle_auth() {
    // The designated oracle's authorization is REQUIRED to publish. With no
    // authorization in scope, publish_oracle_commitment must fail — this proves
    // the require_auth() guard is load-bearing (the oracle's keypair signing the
    // tx is the contract-boundary authentication).
    let env = Env::default();
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.init(&admin, &build_v1_vk(&env));
    client.init_v3(&build_vk_v3(&env));
    client.set_oracle(&oracle);

    // Clear all authorizations: the oracle does NOT sign this publish.
    env.set_auths(&[]);
    let result = client.try_publish_oracle_commitment(&1u64, &U256::from_u32(&env, 7u32));
    assert!(
        result.is_err(),
        "publish_oracle_commitment without the oracle's auth must fail"
    );
}

#[test]
fn test_c3_set_oracle_requires_admin_auth() {
    // set_oracle is admin-gated. Without admin authorization it must fail.
    let env = Env::default();
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.init(&admin, &build_v1_vk(&env));

    env.set_auths(&[]); // clear: admin does not authorize
    let result = client.try_set_oracle(&oracle);
    assert!(result.is_err(), "set_oracle without admin auth must fail");
}

// ---------------------------------------------------------------------------
// C2: designated custodian + BLS-signed reserve attestation (attest_v3_signed)
// ---------------------------------------------------------------------------

use crate::bls_sig_tests::{sign_commitment, sk_from_label};

/// The reserveCommitment public signal (index 1) of the solvent v3 fixture.
fn solvent_v3_reserve_commitment(env: &Env) -> U256 {
    use crate::test::u256_from_dec;
    u256_from_dec(env, SOLVENT_V3.signals[1])
}

#[test]
fn test_c2_signed_attest_succeeds_and_binds() {
    // A real custodian BLS signature over the fixture's reserveCommitment lets
    // attest_v3_signed succeed and stamps custodian_bound=true.
    let (env, client, admin) = setup_v3();
    let commitment = solvent_v3_reserve_commitment(&env);
    let sk = sk_from_label(b"stellaris-custodian-1");
    let (pk, sig) = sign_commitment(&env, sk, &commitment);

    client.set_custodian(&pk);

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let att = client.attest_v3_signed(&admin, &proof, &signals, &sig);
    assert!(
        att.custodian_bound,
        "a valid custodian signature must stamp custodian_bound=true"
    );
    assert!(att.aggregate_solvent, "still aggregate-solvent");

    let stored = client.get_attestation_v3(&admin, &1).unwrap();
    assert!(stored.custodian_bound, "provenance flag must persist");
    assert_eq!(
        client.get_custodian().unwrap(),
        pk,
        "custodian pk retrievable"
    );
}

#[test]
fn test_c2_wrong_signer_rejected() {
    // A signature from a DIFFERENT custodian key than the configured one must be
    // rejected with CustodianSigInvalid.
    let (env, client, admin) = setup_v3();
    let commitment = solvent_v3_reserve_commitment(&env);

    // Configure custodian A, but sign with custodian B.
    let (pk_a, _sig_a) = sign_commitment(&env, sk_from_label(b"custodian-A"), &commitment);
    let (_pk_b, sig_b) = sign_commitment(&env, sk_from_label(b"custodian-B"), &commitment);
    client.set_custodian(&pk_a);

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let result = client.try_attest_v3_signed(&admin, &proof, &signals, &sig_b);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::CustodianSigInvalid),
        "a signature from the wrong custodian key must be rejected"
    );
    assert!(
        client.get_attestation_v3(&admin, &1).is_none(),
        "rejected signed attestation must not be stored"
    );
}

#[test]
fn test_c2_signature_over_wrong_commitment_rejected() {
    // A signature valid for a DIFFERENT commitment must not verify against the
    // attested reserve_commitment (the message binding is load-bearing).
    let (env, client, admin) = setup_v3();
    let sk = sk_from_label(b"stellaris-custodian-1");

    // Sign some OTHER commitment, not the fixture's reserveCommitment.
    let other = U256::from_u32(&env, 0xDEAD_u32);
    let (pk, sig_over_other) = sign_commitment(&env, sk, &other);
    client.set_custodian(&pk);

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let result = client.try_attest_v3_signed(&admin, &proof, &signals, &sig_over_other);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::CustodianSigInvalid),
        "a signature over a different commitment must be rejected"
    );
}

#[test]
fn test_c2_requires_custodian_configured() {
    // attest_v3_signed before set_custodian -> CustodianNotConfigured.
    let (env, client, admin) = setup_v3();
    let commitment = solvent_v3_reserve_commitment(&env);
    let (_pk, sig) = sign_commitment(&env, sk_from_label(b"c"), &commitment);

    let proof = solvent_v3_proof(&env);
    let signals = build_signals_n(&env, &SOLVENT_V3.signals);
    let result = client.try_attest_v3_signed(&admin, &proof, &signals, &sig);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::CustodianNotConfigured),
        "signed attest before a custodian is set must fail"
    );
}

#[test]
fn test_c2_set_custodian_requires_admin_auth() {
    // set_custodian is admin-gated. Without admin auth it must fail.
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.init(&admin, &build_v1_vk(&env));
    client.init_v3(&build_vk_v3(&env));

    let commitment = solvent_v3_reserve_commitment(&env);
    let (pk, _sig) = sign_commitment(&env, sk_from_label(b"c"), &commitment);

    env.set_auths(&[]); // clear: admin does not authorize
    let result = client.try_set_custodian(&pk);
    assert!(
        result.is_err(),
        "set_custodian without admin auth must fail"
    );
}

#[test]
fn test_init_v3_requires_admin_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);

    env.mock_all_auths();
    client.init(&admin, &build_v1_vk(&env));
    env.set_auths(&[]);

    let result = client.try_init_v3(&build_vk_v3(&env));
    assert!(result.is_err(), "init_v3 without admin auth must fail");
}

#[test]
fn test_init_v3_cannot_replace_vk() {
    let (env, client, _) = setup_v3();
    let result = client.try_init_v3(&build_vk_v3(&env));
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::AlreadyInitialized),
        "init_v3 must be one-time so the verified circuit cannot be swapped"
    );
}
