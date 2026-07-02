# Stellaris Fixtures

Generated Groth16 proof fixtures for contract testing and client development.

## Generation

Run from the project root:

```bash
bash setup/ceremony.sh          # Compile circuit + trusted setup
bash setup/export-fixtures.sh   # Generate proofs
```

## Files

| File | Source Input | Description |
|------|-------------|-------------|
| `solvent/proof.json` | `circuits/inputs/solvent.json` | Valid proof: total reserves (3.2M) > liabilities (2.8M), solvent=1 |
| `solvent/public.json` | same | Public signals: [1, <hash>, 2800000, 1] |
| `insolvent/proof.json` | `circuits/inputs/insolvent.json` | Valid proof: total reserves (1.6M) < liabilities (2.8M), solvent=0 |
| `insolvent/public.json` | same | Public signals: [0, <hash>, 2800000, 1] |
| `boundary/proof.json` | `circuits/inputs/boundary.json` | Valid proof: total reserves (2.8M) == liabilities (2.8M), solvent=1 |
| `boundary/public.json` | same | Public signals: [1, <hash>, 2800000, 2] |
| `verification_key.json` | (copy from build/) | BLS12-381 verification key for the POR circuit |

## Usage in Contract Tests

```rust
// Load fixture
let proof_json = std::fs::read_to_string("../../fixtures/solvent/proof.json")?;
let pub_json   = std::fs::read_to_string("../../fixtures/solvent/public.json")?;

// Parse into contract types
let proof: Groth16Proof = parse_proof_from_json(&proof_json);
let pub_signals: Vec<U256> = parse_signals_from_json(&pub_json);

// Submit to contract
let attestation = client.attest(&admin, &proof, &pub_signals);
assert_eq!(attestation.solvent, true);
```

## Curve

BLS12-381. All proofs were generated with Circom `--curve bls12381` and
verified against the Stellar Soroban BLS12-381 verifier (soroban-sdk 25.1.0).

## Warning

These fixtures were generated with a **single-contributor DEMO trusted setup**.
They are NOT secure for production use.
