# 01 — Technical Landscape

What you can actually build with ZK on Stellar today, and at what cost.

## Architecture Pattern (VERIFIED — ZK docs)

Every ZK project on Stellar follows one shape:

```
  off-chain                          on-chain (Soroban)
  ---------                          ------------------
  secret inputs                      verifier contract
      |                                    ^
      v                                    |
  circuit (Noir/Circom/RISC0)  --proof-->  pairing_check
      |                                    |
  proof + public inputs  -----------------/
                                           |
                                           v
                                     app logic (mint, settle,
                                     mark-eligible, record nullifier)
```

> "you generate proofs off-chain with a higher-level system... and deploy a
> verifier contract on Stellar to check them." (VERIFIED)

The primitives (BN254, Poseidon) are host functions — they do NOT give you
private payments out of the box. You bring the circuit and the verifier.

## ZK Host Functions (VERIFIED — CAP-0074, CAP-0075, CAP-0059)

| Protocol | Added | What it enables |
|----------|-------|-----------------|
| 22 | BLS12-381 (CAP-0059) | zk-SNARK verification, BLS sigs |
| 25 "X-Ray" | BN254 (g1_add, g1_mul, pairing_check) + Poseidon/Poseidon2 (CAP-0074/75) | EVM-compatible ZK verification + ZK-cheap hashing |
| 26 "Yardstick" | 9 more BN254 host fns (MSM, scalar-field arithmetic, curve-membership) | Heavy ZK math moved to host layer |

VERIFIED key fact:
> "Protocol 26 made Noir proof verification on Stellar significantly cheaper."

VERIFIED strategic fact: BN254 "Mirrors Ethereum's EIP-196/197 precompiles,
allowing seamless porting of existing circuits and tooling." This is the
cross-ecosystem bridge angle — Ethereum/Aztec circuits port over.

Poseidon is being branched into a separate Rust SDK for smart contracts
(VERIFIED note in ZK docs) — good for Merkle trees / nullifiers in-contract.

## Three Proving Frameworks (VERIFIED — detail page table)

| Framework | Nature | Verify cost | Best for |
|-----------|--------|-------------|----------|
| **Circom** | Low-level constraint DSL, Groth16 | CHEAPEST (Groth16) | Tight, well-scoped circuits (range proofs, Merkle membership). Needs per-circuit trusted setup. |
| **Noir** | Rust-like DSL, UltraHonk (or Groth16 backend) | Larger proofs (UltraHonk); Groth16 backend available | Readable circuits, fast dev. P26 made this much cheaper. |
| **RISC Zero** | zkVM, prove arbitrary Rust ran correctly, Groth16-wrapped | Medium | Proving complex/iterative computation (scores, game logic) without writing a circuit by hand. |

### Decision rule (INFERRED)
- Proof of a simple statement (balance >= X, age >= 18, membership in a set)
  -> **Circom Groth16** (cheapest verify, smallest proof, mature tutorial path).
- Proof of "I ran this non-trivial Rust program and got this output"
  -> **RISC Zero** (no hand-written circuit; great for off-chain computation).
- Readability / porting an Aztec/Noir circuit -> **Noir**.

For a 7-day build, **Circom Groth16** has the lowest-risk, best-documented path
on Stellar (James Bachini E2E tutorial + official soroban-examples verifier).

## Ready-to-Clone Building Blocks (VERIFIED — resources page)

| Asset | Repo | Use |
|-------|------|-----|
| Groth16 verifier (official) | github.com/stellar/soroban-examples (groth16_verifier) | Drop-in verifier for Circom/Noir-Groth16 proofs |
| RISC Zero verifier | github.com/NethermindEth/stellar-risc0-verifier | Verify zkVM Groth16 output on Soroban |
| UltraHonk verifier (Noir) | github.com/yugocabrio/rs-soroban-ultrahonk + indextree/ultrahonk_soroban_contract | Verify native Noir proofs |
| Privacy Pools PoC | github.com/NethermindEth/stellar-private-payments | Circom + Groth16 + Soroban private payments (NOT audited) |
| Circom E2E tutorial | jamesbachini.com/circom-on-stellar | Full proof->Soroban verify walkthrough (a*b=c) |
| Noir Groth16 backend | jamesbachini.com/noir-groth16 | Noir -> deterministic Groth16 -> snarkjs -> Soroban |
| RISC Zero games tutorial | jamesbachini.com/stellar-risc-zero-games | On-chain game w/ RISC0 proofs |

INFERRED leverage: the official Groth16 verifier + the Bachini tutorial mean a
**Circom-based proof verified on Soroban testnet is a solved integration path.**
The novelty must live in the *circuit's statement* and the *product wrapped
around it*, not in re-solving verification plumbing.

## AI Dev Assist (VERIFIED — resources page)
- `skills.stellar.org` — agent-readable docs incl. a dedicated ZK Proofs skill
  (Groth16 via BLS12-381/BN254/Poseidon).
- `developers.stellar.org/llms.txt` — machine-readable doc digest.
- Org best-practice: "tell your agent 'Read skills.stellar.org before you start
  building on Stellar.'" -> we will load this skill into the build agent.

## Cost / Feasibility Notes (INFERRED from verified facts)
- Groth16 verify is the cheapest on-chain path and now further reduced post-P26.
- Trusted setup: Circom Groth16 needs a per-circuit trusted setup (powers of tau
  + phase 2). For a hackathon this is a one-time scripted ceremony — fine, but
  must be documented honestly as "demo setup, not a production ceremony."
- Client-side proving (WASM) is the established Stellar pattern (Privacy Pools
  PoC generates proofs client-side so secrets never leave the device) — reuse
  this so the demo shows secrets never touching a server.

## Constraints That Shape Ideas (INFERRED)
1. Verification is solved; build value in the *statement proven*.
2. Cheapest, most-documented path = Circom Groth16 + official verifier.
3. Poseidon in-contract enables Merkle membership + nullifiers cheaply — the
   key ingredient for "prove inclusion / prevent double-use" products.
4. BN254 = EVM circuit portability = a real cross-chain story if wanted.
