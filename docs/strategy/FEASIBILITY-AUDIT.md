# Feasibility Audit — Stellaris (7-day window)

Hardening pass per hackathon-strategy skill Phase 5. Strips anything not needed
for judging-day success; confirms the MVP is shippable in the time left.

## Time reality (VERIFIED)
Deadline 2026-06-29 19:00; current 2026-06-22. ~7 days. Solo build assumed.

## MVP acceptance criteria (the only things that MUST work for the demo)
1. A real Circom Groth16 proof of `sum(reserves) >= L` verifies TRUE inside the
   Soroban `stellaris` contract on **testnet**, recording an attestation.
2. An insolvent proof is REJECTED on-chain (`NotSolvent`).
3. A replayed period is REJECTED (`PeriodAlreadyAttested`).
4. Proving happens client-side (secrets never leave the browser).
5. A 2-3 min video shows all of the above + states the honest limitation.

If only items 1-2 + video land, it is still a credible, differentiated
submission. Items 3-4 are strong polish; item 4 is the trust story.

## In scope (keep)
- ONE circuit (por.circom), n<=16 accounts, nBits=64.
- ONE contract (stellaris) reusing the official groth16_verifier glue.
- Minimal issuer UI + mock-client fallback for demo reliability.
- Scripted DEMO trusted setup (documented as non-production).

## Out of scope (CUT — do not build for the hackathon)
- Real custodian/bank oracle binding raw balances to reality (honest limitation).
- Multi-party trusted-setup ceremony.
- Multi-asset / multi-currency reserve composition proofs.
- Recursive/aggregated proofs ("Wild" tier).
- Mainnet deployment, audits, production key management.
- Account-level privacy of *liabilities* (L is public by design here).
- Any shielded-transfer / notes / pool mechanics (that's the crowded fork; not us).

## Demo-risk analysis
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Testnet RPC flake during judging | Med | Required demo video = backup; mock client toggle; local snarkjs verify proves validity off-chain |
| Byte-encoding mismatch circuit<->contract | Med-High | P0 spike locks encoding against official verifier BEFORE circuit work; single shared converter |
| Trusted setup misread as production-secure | Low | Loud README + script comments |
| Proving too slow in-browser | Low | n capped at 16; Groth16 proving is fast at this size |
| Looks like a privacy-pool fork | Low | Distinct category (issuer attestation, no transfers); README frames it explicitly |

## External primitive dependency table
| Primitive | Source | Maturity | Live? | Fallback |
|-----------|--------|----------|-------|----------|
| Groth16 verifier | stellar/soroban-examples | Official, P25/26-ready | To deploy in P0 | Bachini tutorial verified path |
| snarkjs/circom | iden3 | Stable, widely used | yes | n/a |
| soroban-sdk | crates.io (pinned) | Stable | yes | pin version from example |
| Stellar testnet RPC | SDF | Stable | yes | mock client + video |

## Go/no-go gate before coding
- [ ] P0 spike passes: tutorial proof verifies TRUE on our testnet deploy.
- [ ] Required toolchains installed: rust + wasm target, soroban/stellar CLI,
      node + snarkjs, circom. (Confirm with user before install — user prefers
      to run their own setup commands.)
- [ ] Public-signal order + byte encoding locked in a shared constants file.

If P0 fails, fall back to GateProof (Candidate 4) which uses the same verifier
path but a simpler Merkle-membership circuit.
