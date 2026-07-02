//! verifier.rs — proof verification behind a swappable backend seam.
//!
//! Mirrors the official `stellar/soroban-examples/groth16_verifier` structure
//! for the BLS12-381 Groth16 pairing check, but exposes it through a
//! `VerifierBackend` trait so the proving system is ONE implementation, not a
//! hardcoded assumption (Milestone D1). The public-signal ABI and on-chain byte
//! layout are unchanged; only the call seam is abstracted.
//!
//! Design (kept deliberately minimal — no speculative second backend is added):
//!
//! - `VerifierBackend`: trait abstracting the (vk, proof, signals) -> bool check
//! - `Groth16Backend`: the real, only implementation (BLS12-381 pairing)
//! - `VerifierVersion`: on-the-wire backend tag; activates the dormant
//!   `WrongVerifierVersion` error via `dispatch_verify`
//! - `verify_proof`: thin free fn delegating to `Groth16Backend`, kept so
//!   existing call sites + tests are untouched
//!
//! This module is the ONLY place that touches BLS12-381 crypto primitives.

use soroban_sdk::{
    contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    vec, Env, Vec,
};

use crate::types::StellarisContractError;

/// Groth16 proof (same structure as the official example).
/// Mirrors the snarkjs `proof.json` fields: pi_a, pi_b, pi_c.
#[derive(Clone)]
#[contracttype]
pub struct Groth16Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

/// Groth16 verification key (same structure as the official example).
/// Mirrors snarkjs `verification_key.json` fields.
#[derive(Clone)]
#[contracttype]
pub struct Groth16VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

/// Error types for the verifier module.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum VerifierError {
    MalformedVerificationKey,
}

// ---------------------------------------------------------------------------
// Backend seam (D1): a stable trait so Groth16 is one implementation.
// ---------------------------------------------------------------------------

/// A proof-verification backend. The associated types let each backend own its
/// own proof / verification-key shape while the contract calls a single
/// `verify(...)` method. Groth16 is the only backend today.
///
/// SCOPE (honest boundary): this trait abstracts only the INTERNAL verify call.
/// It does NOT make the contract's public entrypoints backend-polymorphic — the
/// `attest`/`attest_v2`/`attest_v3` signatures bind the concrete `Groth16Proof`
/// type into the Soroban XDR ABI, which a Rust trait cannot abstract. A future
/// PLONK / post-quantum backend whose proof shape differs from `Groth16Proof`
/// therefore needs a NEW entrypoint (or a `Bytes`-proof + scheme discriminant),
/// not just a new impl of this trait. What this seam DOES buy: a single typed
/// verification surface + the `VerifierVersion` dispatch tap, so when a second
/// backend is built the verification logic and version routing already have a
/// home. The public-signal ABI is unaffected either way.
pub trait VerifierBackend {
    /// Backend-specific verification key type.
    type Vk;
    /// Backend-specific proof type.
    type Proof;

    /// The on-the-wire version tag this backend answers to. Part of the trait
    /// contract (a future backend reports its own tag here so `dispatch_verify`
    /// can route to it); exercised by the D1 seam tests.
    #[allow(dead_code)]
    fn version() -> VerifierVersion;

    /// Verify `proof` against `vk` and the field-element public signals.
    /// Returns `Ok(true)` if valid, `Ok(false)` if the check fails, and `Err`
    /// only for a malformed verification key (a programming/config error, not a
    /// failed proof).
    fn verify(
        env: &Env,
        vk: &Self::Vk,
        proof: &Self::Proof,
        pub_signals: &Vec<Fr>,
    ) -> Result<bool, VerifierError>;
}

/// On-the-wire backend selector. Stored/passed as a `u32` so the manifest and
/// SDK can request a specific backend; unknown values map to
/// `WrongVerifierVersion`. Groth16 is `1` to leave `0` as an explicit
/// "unset/invalid" sentinel.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VerifierVersion {
    Groth16 = 1,
}

impl VerifierVersion {
    /// Parse a wire tag into a known backend version, or `WrongVerifierVersion`.
    pub fn from_u32(tag: u32) -> Result<Self, StellarisContractError> {
        match tag {
            1 => Ok(VerifierVersion::Groth16),
            _ => Err(StellarisContractError::WrongVerifierVersion),
        }
    }

    /// The numeric wire tag for this version.
    pub fn to_u32(self) -> u32 {
        self as u32
    }
}

/// The Groth16 BLS12-381 backend — the real, only implementation.
pub struct Groth16Backend;

impl VerifierBackend for Groth16Backend {
    type Vk = Groth16VerificationKey;
    type Proof = Groth16Proof;

    fn version() -> VerifierVersion {
        VerifierVersion::Groth16
    }

    fn verify(
        env: &Env,
        vk: &Self::Vk,
        proof: &Self::Proof,
        pub_signals: &Vec<Fr>,
    ) -> Result<bool, VerifierError> {
        groth16_pairing_check(env, vk, proof, pub_signals)
    }
}

/// Dispatch a Groth16 verification through the backend selected by `version`.
///
/// This is the activation point for the (previously dormant)
/// `WrongVerifierVersion` error: a caller that requests an unsupported backend
/// tag is rejected before any crypto runs. Today only `Groth16` resolves to a
/// backend.
///
/// NOTE (honest boundary): this function is itself typed with the concrete
/// `Groth16VerificationKey` / `Groth16Proof`, so a second arm could only cover
/// another backend that reuses those exact types. A backend with a different
/// proof/VK shape (PLONK, PQ) needs a new entrypoint or a `Bytes`-proof +
/// discriminant — NOT just a match arm here. So this dispatch tap routes the
/// version tag and rejects unknown ones; it is the version-routing half of the
/// seam, not a claim that a new proving system is one line of work.
pub fn dispatch_verify(
    env: &Env,
    version: u32,
    vk: &Groth16VerificationKey,
    proof: &Groth16Proof,
    pub_signals: &Vec<Fr>,
) -> Result<bool, StellarisContractError> {
    match VerifierVersion::from_u32(version)? {
        VerifierVersion::Groth16 => Groth16Backend::verify(env, vk, proof, pub_signals)
            .map_err(|_| StellarisContractError::BadProofEncoding),
    }
}

/// Verify a Groth16 proof against a verification key and public signals.
///
/// Thin free function kept for the existing `attest` / `attest_v2` call sites
/// and the contract test suite. Delegates to `Groth16Backend` so there is a
/// single pairing-check implementation behind the trait.
///
/// Returns Ok(true) if the proof is valid, Ok(false) if invalid.
///
/// # Errors
/// Returns Err if ic count mismatch (malformed verification key).
#[allow(dead_code)] // compat wrapper + equivalence-tested in test_d1; kept for callers/tests.
pub fn verify_proof(
    env: &Env,
    vk: &Groth16VerificationKey,
    proof: &Groth16Proof,
    pub_signals: &Vec<Fr>,
) -> Result<bool, VerifierError> {
    Groth16Backend::verify(env, vk, proof, pub_signals)
}

/// The BLS12-381 Groth16 pairing check itself (formerly the body of
/// `verify_proof`). Computes `vk_x = ic[0] + sum(signal_i * ic[i+1])` and the
/// pairing `e(-A,B)·e(alpha,beta)·e(vk_x,gamma)·e(C,delta) == 1`.
fn groth16_pairing_check(
    env: &Env,
    vk: &Groth16VerificationKey,
    proof: &Groth16Proof,
    pub_signals: &Vec<Fr>,
) -> Result<bool, VerifierError> {
    let bls = env.crypto().bls12_381();

    // Compute vk_x = ic[0] + sum(pub_signals[i] * ic[i+1])
    if pub_signals.len() + 1 != vk.ic.len() {
        return Err(VerifierError::MalformedVerificationKey);
    }

    let ic0 = vk
        .ic
        .get(0)
        .ok_or(VerifierError::MalformedVerificationKey)?;
    let mut vk_x = ic0;
    for (i, signal) in pub_signals.iter().enumerate() {
        let ic_point = vk
            .ic
            .get((i + 1) as u32)
            .ok_or(VerifierError::MalformedVerificationKey)?;
        let prod = bls.g1_mul(&ic_point, &signal);
        vk_x = bls.g1_add(&vk_x, &prod);
    }

    // Compute the pairing check:
    // e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1
    let neg_a = -(proof.a.clone());
    let vp1 = vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
    let vp2 = vec![
        env,
        proof.b.clone(),
        vk.beta.clone(),
        vk.gamma.clone(),
        vk.delta.clone(),
    ];

    Ok(bls.pairing_check(vp1, vp2))
}
