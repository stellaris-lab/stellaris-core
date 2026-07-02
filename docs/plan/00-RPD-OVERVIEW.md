# RPD Implementation Plan — Stellaris (ZK Proof-of-Reserves on Stellar)

File-level Role / Public API / Detailed Flow plan for the lead idea selected in
`research/04-RECOMMENDATION.md`. This is a PLAN, not code. No implementation
until the user accepts it.

## Document Index

| File | Scope |
|------|-------|
| `plan/00-RPD-OVERVIEW.md` | Standards, architecture, repo layout, phases (this file) |
| `plan/01-CIRCUIT-RPD.md` | Circom circuit + trusted setup + proving |
| `plan/02-CONTRACT-RPD.md` | Soroban verifier + attestation registry contract (Rust) |
| `plan/03-CLIENT-RPD.md` | WASM client proving, issuer UI, glue scripts |
| `plan/04-PLAN-AUDIT-AND-FIXES.md` | Double-check of the plan against research, competitor update, and real tooling risks |
| `plan/05-DEVELOPMENT-PLAYBOOK.md` | Minor-step implementation checklist with commands, outputs, failure handling, and acceptance gates |

## One-line product
An issuer proves on-chain that `sum(reserves) >= liabilities` without revealing
any account balance; a Soroban contract verifies the Groth16 proof and records a
non-replayable "Solvent as of ledger N" attestation.

## Market-backed pitch after competitor research
Chainlink and Binance prove reserve verification is already a real market:
stablecoin, RWA, exchange, wrapped-asset, and institutional users need reliable
reserve transparency. Stellaris brings that trust category to Stellar as a
privacy-preserving Soroban attestation layer: the issuer proves solvency without
publishing every reserve balance. It is not a Chainlink replacement and not a
full audit system; it is the ZK proof + on-chain verification layer that can
later connect to custodian signatures or oracle feeds.

## Senior Engineering Standards (all files must follow)

- **Rust (contract):** per-crate error enum via explicit `#[contracterror]`;
  no panics on user input paths; deterministic; no host-time assumptions beyond
  the ledger timestamp the contract is given.
- **Circom:** every signal constrained (no dangling inputs); explicit range
  constraints on all balance inputs; document each public vs private signal.
- **TS/JS client:** proving runs client-side (WASM); secrets never sent to any
  server; all chain calls isolated behind one `stellar.ts` module so the UI is
  swappable and demo-mockable.
- **Testing:** circuit has a witness-generation test vector (solvent + insolvent
  + boundary). Contract has unit tests for verify-true, verify-false (tampered
  proof), and replay-rejection. Client has one end-to-end script test.
- **Honesty:** README states the PoR limitation (proof binds arithmetic, not raw
  balance truthfulness) and "research prototype, not audited."
- **No invented APIs:** verifier interface mirrors the official
  `stellar/soroban-examples/groth16_verifier` (BLS12-381 curve, confirmed in P0).
  Confirm exact function signatures against the cloned repo before coding
  (verify-before-build).

## Architecture

```
  CLIENT (browser, secrets local)            STELLAR TESTNET (Soroban)
  -------------------------------            -------------------------
  reserve balances r_1..r_n (private)
  liabilities L (public)
        |
        v
  snarkjs/wasm prover  --- Groth16 proof + public signals --->  Stellaris contract
        |                                                          |
   Poseidon commitment C (public)                                  | 1. groth16_verify(vk, proof, pubsignals)
                                                                   | 2. assert solvent == 1
                                                                   | 3. assert period not already attested (nullifier)
                                                                   | 4. store Attestation{C, L, solvent, ledger_ts, period}
                                                                   v
                                                            on-chain "Solvent as of ledger N"
```

Public signals (order is contract-critical, lock it early):
`[ solvent (0/1), C_commitment, L_liabilities, period_id ]`

## Repository Layout (target)

```
stellaris/                   # project root
  circuits/
    por.circom              # main proof-of-reserves circuit
    components/             # range + sum + poseidon-commit subcircuits
    inputs/                 # test input vectors (solvent/insolvent/boundary)
  setup/
    ceremony.sh             # powers-of-tau + phase-2 (DEMO setup, documented)
    export-vk.sh            # export verification key -> contract-ready hex
  contracts/
    stellaris/
      src/lib.rs            # contract entry: attest(), get_attestation()
      src/verifier.rs       # Groth16 verify glue (mirrors official example)
      src/types.rs          # Attestation, Error, storage keys
      src/test.rs           # unit tests (true/false/replay)
      Cargo.toml
  client/
    src/prove.ts            # wasm proving (snarkjs) — secrets stay local
    src/stellar.ts          # all Soroban calls isolated here
    src/ui/                 # minimal issuer UI (enter balances -> proof -> attest)
    scripts/e2e.sh          # full local->testnet smoke
  docs/                     # planning, research, strategy documents
  README.md                 # detailed; states ZK integration + honest limits
  CHANGELOG.md
```

## Phases (build-first / test-soon; 7-day budget)

| Phase | Files | Exit criteria |
|-------|-------|---------------|
| P0 Integration spike | clone official groth16_verifier; deploy testnet | tutorial `a*b=c` proof verifies TRUE on testnet via our deploy |
| P1 Circuit | circuits/por.circom + components + inputs | `snarkjs groth16 verify` OK for solvent vector; FAILS for insolvent |
| P2 Setup | setup/ceremony.sh, export-vk.sh | vk + proof exported in contract-ready hex layout |
| P3 Contract | contracts/stellaris/src/* | unit tests pass: verify-true, verify-false, replay-reject |
| P4 Wire | client/src/prove.ts + stellar.ts | proof generated client-side verifies + records attestation on testnet |
| P5 Insolvent + nullifier | contract + client | insolvent proof rejected on camera; period replay rejected |
| P6 Polish | UI, README, AGENTS, video | 2-3 min demo recorded; README documents ZK + limits |
| P7 Buffer | — | resubmit-ready; testnet flakiness absorbed |

Dependency note: P0 BEFORE P1. Lock the verification integration against the
real official contract first; the circuit's public-signal layout must match what
the verifier expects. Verify signatures against the cloned repo, not memory.

For development, the table above is only the phase summary. The authoritative
minor-step checklist is `plan/05-DEVELOPMENT-PLAYBOOK.md`. Do not implement from
this overview alone.

## Risk register

| Risk | Mitigation |
|------|------------|
| Public-signal ordering mismatch contract<->circuit | Lock the 4-signal array in P0; single source-of-truth constant in types.rs + prove.ts |
| Trusted setup misunderstood as production | ceremony.sh comments + README: "DEMO setup, not a real ceremony" |
| Testnet RPC flake during judging | Demo video is required anyway = backup; local snarkjs verify proves validity off-chain |
| zkVM-style proving slowness | N/A — Circom Groth16 proving is fast for a small reserve set (cap n, e.g. <= 16 accounts for demo) |
| Looks like a privacy-pool fork | It isn't (no notes/transfers); README frames it as issuer attestation, distinct category |
