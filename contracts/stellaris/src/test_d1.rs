//! test_d1.rs — VerifierBackend seam (Milestone D1) unit tests.
//!
//! These tests make the backend abstraction LOAD-BEARING rather than dead code:
//! they drive the real BLS12-381 Groth16 pairing check through the trait
//! (`Groth16Backend::verify`), through the version-dispatch selector
//! (`dispatch_verify`), and through the kept `verify_proof` wrapper, and they
//! activate the previously-dormant `WrongVerifierVersion` error.
//!
//! Coverage:
//!   - test_d1_version_roundtrip:       VerifierVersion <-> u32 wire tag
//!   - test_d1_unknown_backend_tag:     unknown tag -> WrongVerifierVersion
//!   - test_d1_backend_version_tag:     Groth16Backend::version() == Groth16
//!   - test_d1_dispatch_verifies_real:  real SOLVENT proof verifies via dispatch
//!   - test_d1_dispatch_rejects_mismatch: mismatched signals -> dispatch false
//!   - test_d1_dispatch_unknown_version_errors: bad tag -> Err before crypto
//!   - test_d1_verify_proof_wrapper_matches: kept wrapper agrees with backend

use crate::test::{g1_from, g2_from};
use crate::test_fixtures::{ProofData, VkData, BOUNDARY, SOLVENT, VK};
use crate::types::StellarisContractError;
use crate::verifier::{
    dispatch_verify, verify_proof, Groth16Backend, Groth16Proof, Groth16VerificationKey,
    VerifierBackend, VerifierVersion,
};

use soroban_sdk::{crypto::bls12_381::Fr, Bytes, Env, Vec, U256};

// Local fixture builders (mirror test.rs; kept here so this module is
// self-contained and does not widen test.rs's private helpers).
fn build_vk(env: &Env, vk: &VkData) -> Groth16VerificationKey {
    let mut ic: Vec<soroban_sdk::crypto::bls12_381::G1Affine> = Vec::new(env);
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

fn u256_from_dec(env: &Env, s: &str) -> U256 {
    use ark_ff::{BigInteger, PrimeField};
    use core::str::FromStr;
    let fr = ark_bls12_381::Fr::from_str(s).expect("fr parse");
    let be = fr.into_bigint().to_bytes_be();
    let mut buf = [0u8; 32];
    buf[32 - be.len()..].copy_from_slice(&be);
    U256::from_be_bytes(env, &Bytes::from_array(env, &buf))
}

/// Build the field-element signal vector the verifier consumes (Fr, not U256).
fn fr_signals(env: &Env, signals: &[&str]) -> Vec<Fr> {
    let mut out: Vec<Fr> = Vec::new(env);
    for s in signals.iter() {
        out.push_back(Fr::from_u256(u256_from_dec(env, s)));
    }
    out
}

#[test]
fn test_d1_version_roundtrip() {
    // The wire tag round-trips and Groth16 is tag 1 (0 stays an invalid sentinel).
    assert_eq!(VerifierVersion::Groth16.to_u32(), 1);
    assert_eq!(
        VerifierVersion::from_u32(1).expect("tag 1 is Groth16"),
        VerifierVersion::Groth16
    );
}

#[test]
fn test_d1_unknown_backend_tag() {
    // Any tag other than a known backend maps to WrongVerifierVersion. 0 is the
    // explicit unset sentinel; 2 is an as-yet-unimplemented backend.
    assert_eq!(
        VerifierVersion::from_u32(0).err(),
        Some(StellarisContractError::WrongVerifierVersion)
    );
    assert_eq!(
        VerifierVersion::from_u32(2).err(),
        Some(StellarisContractError::WrongVerifierVersion)
    );
    assert_eq!(
        VerifierVersion::from_u32(99).err(),
        Some(StellarisContractError::WrongVerifierVersion)
    );
}

#[test]
fn test_d1_backend_version_tag() {
    // The trait's version() associated fn reports the backend's wire identity.
    assert_eq!(Groth16Backend::version(), VerifierVersion::Groth16);
}

#[test]
fn test_d1_dispatch_verifies_real() {
    // The real SOLVENT proof verifies when dispatched through the Groth16 tag.
    let env = Env::default();
    let vk = build_vk(&env, &VK);
    let proof = build_proof(&env, &SOLVENT);
    let signals = fr_signals(&env, &SOLVENT.signals);

    let ok = dispatch_verify(
        &env,
        VerifierVersion::Groth16.to_u32(),
        &vk,
        &proof,
        &signals,
    )
    .expect("dispatch must not error for a well-formed Groth16 request");
    assert!(
        ok,
        "real solvent proof must verify through the backend seam"
    );
}

#[test]
fn test_d1_dispatch_rejects_mismatch() {
    // Real proof, wrong public signals -> pairing fails -> dispatch returns false
    // (NOT an error: the backend ran, the proof just didn't verify).
    let env = Env::default();
    let vk = build_vk(&env, &VK);
    let proof = build_proof(&env, &SOLVENT);
    let signals = fr_signals(&env, &BOUNDARY.signals);

    let ok = dispatch_verify(
        &env,
        VerifierVersion::Groth16.to_u32(),
        &vk,
        &proof,
        &signals,
    )
    .expect("dispatch returns Ok(false) for a failed check, not Err");
    assert!(!ok, "mismatched signals must fail the pairing check");
}

#[test]
fn test_d1_dispatch_unknown_version_errors() {
    // Requesting an unsupported backend tag is rejected BEFORE any crypto runs.
    let env = Env::default();
    let vk = build_vk(&env, &VK);
    let proof = build_proof(&env, &SOLVENT);
    let signals = fr_signals(&env, &SOLVENT.signals);

    let result = dispatch_verify(&env, 2, &vk, &proof, &signals);
    assert_eq!(
        result.err(),
        Some(StellarisContractError::WrongVerifierVersion),
        "an unknown backend tag must error with WrongVerifierVersion"
    );
}

#[test]
fn test_d1_verify_proof_wrapper_matches() {
    // The kept free-fn wrapper delegates to the same backend: same answer as the
    // trait call for both a valid and an invalid request.
    let env = Env::default();
    // This test deliberately runs FOUR BLS pairing checks (wrapper + backend, for
    // both a valid and an invalid request) to prove the kept free-fn delegates to
    // the same backend. Four pairings exceed the default host budget, so lift it —
    // this asserts logical equivalence, not on-chain cost (the attest-path tests
    // cover real budget). Pattern: vendor/soroban-examples/liquidity_pool/test.rs.
    env.cost_estimate().budget().reset_unlimited();
    let vk = build_vk(&env, &VK);
    let proof = build_proof(&env, &SOLVENT);

    let good = fr_signals(&env, &SOLVENT.signals);
    let bad = fr_signals(&env, &BOUNDARY.signals);

    let via_wrapper_good = verify_proof(&env, &vk, &proof, &good).expect("wrapper good");
    let via_backend_good = Groth16Backend::verify(&env, &vk, &proof, &good).expect("backend good");
    assert_eq!(via_wrapper_good, via_backend_good);
    assert!(via_wrapper_good);

    let via_wrapper_bad = verify_proof(&env, &vk, &proof, &bad).expect("wrapper bad");
    let via_backend_bad = Groth16Backend::verify(&env, &vk, &proof, &bad).expect("backend bad");
    assert_eq!(via_wrapper_bad, via_backend_bad);
    assert!(!via_wrapper_bad);
}
