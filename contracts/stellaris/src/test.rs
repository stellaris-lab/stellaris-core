//! test.rs — Contract unit tests using REAL Groth16 proofs.
//!
//! These tests verify ACTUAL BLS12-381 Groth16 proofs produced by the trusted
//! setup (setup/ceremony.sh) and proof generation (setup/export-fixtures.sh),
//! converted from snarkjs decimal coordinates via the same ark-bls12-381 +
//! ark-serialize path used by the official soroban groth16_verifier example.
//!
//! No mock verification key. The solvent/insolvent/boundary proofs exercise the
//! real on-chain pairing check in verifier.rs.
//!
//! Coverage:
//!   - test_init / test_double_init_fails: admin + VK lifecycle
//!   - test_attest_solvent_real:    real solvent proof -> stored attestation
//!   - test_attest_boundary_real:   sum == liabilities -> solvent=1, stored
//!   - test_reject_insolvent_real:  valid proof, solvent=0 -> NotSolvent
//!   - test_reject_wrong_signals:   real proof + mismatched signals -> ProofInvalid
//!   - test_reject_replay_real:     same period twice -> PeriodAlreadyAttested
//!   - test_reject_bad_signal_count: wrong arity -> BadPublicSignals
//!   - test_requires_auth:          missing issuer auth fails
//!   - test_get_attestation / test_list_periods: reads after a real attest

extern crate std;

use ark_bls12_381::{Fq, Fq2};
use ark_ff::{BigInteger, PrimeField};
use ark_serialize::CanonicalSerialize;
use core::str::FromStr;

use crate::test_fixtures::{G1c, G2c, ProofData, VkData, BOUNDARY, INSOLVENT, SOLVENT, VK};
use crate::types::StellarisContractError;
use crate::verifier::{Groth16Proof, Groth16VerificationKey};
use crate::{StellarisContract, StellarisContractClient};

use soroban_sdk::{
    crypto::bls12_381::{G1Affine, G2Affine, G1_SERIALIZED_SIZE, G2_SERIALIZED_SIZE},
    testutils::Address as _,
    Address, Bytes, Env, Vec, U256,
};

// ---------------------------------------------------------------------------
// Coordinate conversion (mirrors vendor/soroban-examples/groth16_verifier)
// ---------------------------------------------------------------------------

pub(crate) fn g1_from(env: &Env, c: &G1c) -> G1Affine {
    let p = ark_bls12_381::G1Affine::new(
        Fq::from_str(c.x).expect("g1.x"),
        Fq::from_str(c.y).expect("g1.y"),
    );
    let mut buf = [0u8; G1_SERIALIZED_SIZE];
    p.serialize_uncompressed(&mut buf[..]).expect("g1 ser");
    G1Affine::from_array(env, &buf)
}

pub(crate) fn g2_from(env: &Env, c: &G2c) -> G2Affine {
    let x = Fq2::new(
        Fq::from_str(c.x1).expect("g2.x1"),
        Fq::from_str(c.x2).expect("g2.x2"),
    );
    let y = Fq2::new(
        Fq::from_str(c.y1).expect("g2.y1"),
        Fq::from_str(c.y2).expect("g2.y2"),
    );
    let p = ark_bls12_381::G2Affine::new(x, y);
    let mut buf = [0u8; G2_SERIALIZED_SIZE];
    p.serialize_uncompressed(&mut buf[..]).expect("g2 ser");
    G2Affine::from_array(env, &buf)
}

/// Decimal field-element string -> 32-byte big-endian U256.
pub(crate) fn u256_from_dec(env: &Env, s: &str) -> U256 {
    let fr = ark_bls12_381::Fr::from_str(s).expect("fr parse");
    let be = fr.into_bigint().to_bytes_be();
    let mut buf = [0u8; 32];
    buf[32 - be.len()..].copy_from_slice(&be);
    U256::from_be_bytes(env, &Bytes::from_array(env, &buf))
}

fn build_vk(env: &Env, vk: &VkData) -> Groth16VerificationKey {
    let mut ic: Vec<G1Affine> = Vec::new(env);
    for point in vk.ic.iter() {
        ic.push_back(g1_from(env, point));
    }
    Groth16VerificationKey {
        alpha: g1_from(env, &vk.alpha),
        beta: g2_from(env, &vk.beta),
        gamma: g2_from(env, &vk.gamma),
        delta: g2_from(env, &vk.delta),
        ic,
    }
}

fn build_proof(env: &Env, p: &ProofData) -> Groth16Proof {
    Groth16Proof {
        a: g1_from(env, &p.a),
        b: g2_from(env, &p.b),
        c: g1_from(env, &p.c),
    }
}

fn build_signals(env: &Env, signals: &[&str; 4]) -> Vec<U256> {
    build_signals_n(env, signals)
}

/// Build a `Vec<U256>` from any slice of decimal signal strings (v1: 4, v2: 5).
pub(crate) fn build_signals_n(env: &Env, signals: &[&str]) -> Vec<U256> {
    let mut out: Vec<U256> = Vec::new(env);
    for s in signals.iter() {
        out.push_back(u256_from_dec(env, s));
    }
    out
}

/// Register + initialize a contract with the REAL verification key.
fn setup() -> (Env, StellarisContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let vk = build_vk(&env, &VK);

    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    client.init(&admin, &vk);
    (env, client, admin)
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

#[test]
fn test_init() {
    let (_, client, admin) = setup();
    assert_eq!(client.get_admin(), Some(admin));
}

#[test]
fn test_double_init_fails() {
    let (env, client, admin) = setup();
    let vk = build_vk(&env, &VK);
    let result = client.try_init(&admin, &vk);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::AlreadyInitialized)
    );
}

// ---------------------------------------------------------------------------
// Real proof verification — the core of this suite
// ---------------------------------------------------------------------------

#[test]
fn test_attest_solvent_real() {
    let (env, client, admin) = setup();
    let proof = build_proof(&env, &SOLVENT);
    let signals = build_signals(&env, &SOLVENT.signals);

    let attestation = client.attest(&admin, &proof, &signals);
    assert!(attestation.solvent, "solvent proof must yield solvent=true");
    assert_eq!(attestation.liabilities, 2_800_000u128);
    assert_eq!(attestation.period_id, 1u64);

    // Read back through the contract.
    let stored = client.get_attestation(&admin, &1);
    assert!(stored.is_some());
    assert_eq!(client.list_periods(&admin), soroban_sdk::vec![&env, 1u64]);
}

#[test]
fn test_attest_boundary_real() {
    // boundary input: total reserves == liabilities -> still solvent (>=).
    let (env, client, admin) = setup();
    let proof = build_proof(&env, &BOUNDARY);
    let signals = build_signals(&env, &BOUNDARY.signals);

    let attestation = client.attest(&admin, &proof, &signals);
    assert!(attestation.solvent, "boundary (sum == L) must be solvent");
    assert_eq!(attestation.period_id, 2u64);
}

#[test]
fn test_reject_insolvent_real() {
    // A cryptographically VALID proof whose solvent public signal is 0.
    // Proof verification passes; the contract then rejects on the solvency gate.
    let (env, client, admin) = setup();
    let proof = build_proof(&env, &INSOLVENT);
    let signals = build_signals(&env, &INSOLVENT.signals);

    let result = client.try_attest(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::NotSolvent),
        "valid proof with solvent=0 must be rejected as NotSolvent"
    );
}

#[test]
fn test_reject_wrong_signals() {
    // Real solvent proof, but public signals from the boundary scenario.
    // vk_x no longer matches the proof -> pairing fails -> ProofInvalid.
    let (env, client, admin) = setup();
    let proof = build_proof(&env, &SOLVENT);
    let signals = build_signals(&env, &BOUNDARY.signals);

    let result = client.try_attest(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::ProofInvalid),
        "mismatched public signals must fail the pairing check"
    );
}

#[test]
fn test_reject_replay_real() {
    let (env, client, admin) = setup();
    let proof = build_proof(&env, &SOLVENT);
    let signals = build_signals(&env, &SOLVENT.signals);

    // First attest succeeds.
    client.attest(&admin, &proof, &signals);
    // Replaying the same period must fail.
    let result = client.try_attest(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::PeriodAlreadyAttested)
    );
}

// ---------------------------------------------------------------------------
// Structural / auth rejections
// ---------------------------------------------------------------------------

#[test]
fn test_reject_bad_signal_count() {
    let (env, client, admin) = setup();
    let proof = build_proof(&env, &SOLVENT);

    // Only 3 signals instead of the required 4.
    let mut signals: Vec<U256> = Vec::new(&env);
    for s in SOLVENT.signals.iter().take(3) {
        signals.push_back(u256_from_dec(&env, s));
    }

    let result = client.try_attest(&admin, &proof, &signals);
    assert_eq!(
        result.err().unwrap(),
        Ok(StellarisContractError::BadPublicSignals)
    );
}

#[test]
fn test_requires_auth() {
    // No mock_all_auths here: the issuer never authorizes, so attest must fail.
    let env = Env::default();
    let admin = Address::generate(&env);
    let vk = build_vk(&env, &VK);
    let contract_id = env.register(StellarisContract {}, ());
    let client = StellarisContractClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.init(&admin, &vk);
    env.set_auths(&[]); // clear: subsequent calls have no authorization

    let proof = build_proof(&env, &SOLVENT);
    let signals = build_signals(&env, &SOLVENT.signals);
    let result = client.try_attest(&admin, &proof, &signals);
    assert!(result.is_err(), "attest without issuer auth must fail");
}

#[test]
fn test_get_attestation_not_found() {
    let (_, client, admin) = setup();
    assert_eq!(client.get_attestation(&admin, &999), None);
}

#[test]
fn test_list_periods_empty() {
    let (_, client, admin) = setup();
    assert!(client.list_periods(&admin).is_empty());
}
