//! bls_sig.rs — C2: real BLS12-381 custodian-signature verification (contract-side).
//!
//! C2 closes the trust gap C3 left open. C3 binds *prices* to a designated oracle
//! at the contract boundary (the oracle's Stellar keypair signs the publish tx).
//! C2 binds the *reserves* to a named custodian: the custodian signs the public
//! `reserveCommitment` with a BLS12-381 key, and the contract verifies that
//! signature on-chain via the real pairing host function. So an attestation can
//! prove "these reserves were signed by custodian X" without revealing balances
//! (C1 already proved the commitment binds the exact reserve matrix).
//!
//! WHY CONTRACT-SIDE, NOT IN-CIRCUIT (honest scope + a roadmap correction):
//! The ROADMAP's C2 line said "verified inside the circuit via the BLS host
//! functions." That is not implementable: Soroban host functions are contract
//! calls, not circom gadgets, and circomlib ships no BLS12-381 pairing gadget (an
//! in-circuit pairing is millions of constraints). The circomlib EdDSA-Poseidon
//! gadget *compiles* under -p bls12381 but its BabyJubjub parameters were chosen
//! for the BN254 scalar field, so its soundness under BLS12-381's Fr is
//! unverified — shipping it would be unsound. The real, on-curve (invariant #4),
//! offline-verifiable reading of C2 is this: a genuine BLS signature checked by
//! the same `pairing_check` host function the Groth16 verifier already uses.
//!
//! Scheme (minimal-signature-size BLS):
//!
//! - custodian secret key: `sk` (an Fr scalar, never on-chain)
//! - custodian public key: `pk = sk * G2_generator` (a G2 point, stored)
//! - message: `m = reserveCommitment`
//! - hash-to-curve: `H(m) = hash_to_g1(serialize(m), DST)` (a G1 point)
//! - signature: `sig = sk * H(m)` (a G1 point)
//! - verification: `e(sig, G2_gen) == e(H(m), pk)`, equivalently
//!   `pairing_check([sig, -H(m)], [G2_gen, pk]) == true`.
//!
//! Negation in G1 is cheap — only the Fp y-coordinate flips.

use soroban_sdk::{
    crypto::bls12_381::{Bls12_381, Fp, Fp2, G1Affine, G2Affine},
    vec, Bytes, BytesN, Env, U256,
};

/// Domain separation tag for the custodian reserve-signature hash-to-curve.
/// Distinct, versioned, and project-scoped so a Stellaris custodian signature
/// can never be replayed as any other BLS message on the same key.
pub const CUSTODIAN_DST: &[u8] = b"STELLARIS-CUSTODIAN-RESERVE-SIG-V1";

/// The canonical BLS12-381 G2 generator, serialized in Soroban's uncompressed
/// 192-byte layout (`c1 || c0` per Fp2, matching CAP-0059 / encoding.ts). This
/// is the FIXED group generator — it is NOT custodian-supplied (a custodian that
/// could choose the generator could forge signatures), and `bls_sig_tests`
/// re-derives it from ark-bls12-381 and asserts byte-equality so it is a
/// self-checked constant, not a magic blob.
pub fn g2_generator(env: &Env) -> G2Affine {
    G2Affine::from_bytes(BytesN::from_array(env, &G2_GENERATOR_BYTES))
}

/// Serialize a U256 field element (the reserveCommitment) to its 32-byte
/// big-endian message representation for hash-to-curve.
fn commitment_msg(_env: &Env, commitment: &U256) -> Bytes {
    commitment.to_be_bytes()
}

/// Verify a custodian BLS signature over `commitment`.
///
/// Returns true iff `sig` is `sk * H(commitment)` for the `sk` whose public key
/// is `pk = sk * G2_generator`. Uses the real on-chain pairing host function.
pub fn verify_custodian_sig(env: &Env, pk: &G2Affine, sig: &G1Affine, commitment: &U256) -> bool {
    let bls: Bls12_381 = env.crypto().bls12_381();

    // H(m) in G1 via the host hash-to-curve (issuer cannot forge the hash).
    let dst = Bytes::from_slice(env, CUSTODIAN_DST);
    let msg = commitment_msg(env, commitment);
    let h = bls.hash_to_g1(&msg, &dst);

    // pairing_check([sig, -H(m)], [G2_gen, pk]) == e(sig,G2)·e(-H,pk) == 1
    // <=> e(sig, G2_gen) == e(H(m), pk), the BLS verification equation.
    let neg_h = -h;
    let g2 = g2_generator(env);
    let vp1 = vec![env, sig.clone(), neg_h];
    let vp2 = vec![env, g2, pk.clone()];
    bls.pairing_check(vp1, vp2)
}

// Re-export Fp/Fp2 so callers/tests share the exact field types.
#[allow(unused_imports)]
pub(crate) use soroban_sdk::crypto::bls12_381::{Fp as _Fp, Fp2 as _Fp2};
#[allow(dead_code)]
type _FpAlias = Fp;
#[allow(dead_code)]
type _Fp2Alias = Fp2;

// ---------------------------------------------------------------------------
// Canonical BLS12-381 G2 generator (uncompressed, Soroban 192-byte layout).
// Filled from ark-bls12-381 and asserted self-consistent in bls_sig_tests.
// ---------------------------------------------------------------------------
include!("bls_g2_generator.rs");
