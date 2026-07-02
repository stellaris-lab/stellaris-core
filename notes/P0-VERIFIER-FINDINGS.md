# P0 Verifier Integration Findings

Date: 2026-06-23
Source: `stellar/soroban-examples/groth16_verifier` (official)

## Curve

**BLS12-381.** The official verifier uses `soroban_sdk::crypto::bls12_381` module.
This overrides the earlier BN254 assumption in the plan. All circuit, setup,
and contract code must use BLS12-381.

Circom supports BLS12-381 via `--curve bls12381` flag.
snarkjs supports BLS12-381 natively.

## Exact API

### Contract types (Rust, no_std, soroban-sdk 25.1.0)

```rust
// From soroban_sdk::crypto::bls12_381
use soroban_sdk::crypto::bls12_381::{Fr, G1Affine, G2Affine};

#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,   // ic[0] + sum(signal[i] * ic[i+1])
}

#[contracttype]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}
```

### Verify function

```rust
pub fn verify_proof(
    env: Env,
    vk: VerificationKey,
    proof: Proof,
    pub_signals: Vec<Fr>,
) -> Result<bool, Groth16Error>;
```

### Verification logic (standard Groth16)
1. Check `pub_signals.len() + 1 == vk.ic.len()` (IC has ic[0] + N points for N signals)
2. Compute `vk_x = ic[0] + sum(pub_signals[i] * ic[i+1])` via g1_mul + g1_add
3. Pairing check: `e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) == 1`
4. Return bool

### Public signals type
`Vec<Fr>` where `Fr = bls12_381::Fr`, converted from U256 via `Fr::from_u256(U256::from_u32(&env, 33))`

### Proof type
`Proof { a: G1Affine, b: G2Affine, c: G1Affine }` — uncompressed serialization.

### VK type
`VerificationKey { alpha: G1Affine, beta: G2Affine, gamma: G2Affine, delta: G2Affine, ic: Vec<G1Affine> }`

## Dependencies (pinned)
- soroban-sdk = 25.1.0
- rust-version = 1.89.0
- Test deps: ark-bls12-381 0.4.0, ark-serialize 0.4.2, ark-ff 0.4.2, ark-ec 0.4.2

## Stellaris implications

1. Circuit must compile with `--curve bls12381`
2. Trusted setup uses BLS12-381 powers of tau
3. Poseidon in circomlib works on BLS12-381 field (same field prime)
4. Contract uses `soroban_sdk::crypto::bls12_381` module, NOT the Protocol 22 BN254 host functions
5. snarkjs curve = bls12381 (default is bn128, must override)
6. The plan's BN254 references must be updated to BLS12-381

## What we DON'T need from the official example
- Hardcoded VK coordinates in tests (we will load from JSON)
- The `a*b=c` circuit itself (we use our PoR circuit)
- arkworks test helpers (we can use snarkjs to generate fixtures instead)
