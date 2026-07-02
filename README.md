# Stellaris — ZK Proof-of-Reserves on Stellar

An issuer proves on-chain that `sum(reserves) >= liabilities` without revealing
individual reserve balances. A Soroban smart contract verifies the Groth16 proof
and records a non-replayable **"Solvent as of ledger N"** attestation.

Built for **Stellar Hacks: Real-World ZK** (DoraHacks, June 2026).

## Market Context

Binance and Chainlink validate that proof-of-reserves is already a real market:
exchanges, stablecoin issuers, tokenized asset providers, custodians, and
institutional users need reliable reserve transparency. Stellaris brings that
trust category to Stellar as a privacy-preserving, Soroban-verified issuer
solvency attestation. It is **not** a Chainlink replacement and **not** a full
audit system — it is the ZK proof + on-chain verification layer.

## Tooling or Product?

Stellaris is best understood as a **productized protocol SDK**:

- **Productized** because it targets a concrete issuer/auditor workflow: prove
  reserve coverage without exposing treasury composition.
- **Protocol** because the circuit statement, public signal ABI, and Soroban
  attestation registry are reusable infrastructure.
- **SDK** because exchanges, stablecoin issuers, RWA platforms, auditors,
  dashboards, and backend services can integrate it without depending on one UI.

The MVP proves the hard cryptographic path end-to-end. The production roadmap
adds custodian/oracle inputs, issuer dashboards, and regulator/auditor workflows.

## Architecture

```
  CLIENT (secrets local)                       STELLAR TESTNET (Soroban)
  ----------------------                       -------------------------
  reserve balances r_1..r_n (private)
  liabilities L (public)
        |
        v
  snarkjs/wasm prover  --- Groth16 proof + pub signals --->  Stellaris contract
        |                                                       |
   Poseidon commitment C (public)                               | 1. Verify proof
                                                                | 2. Check solvent=1
                                                                | 3. Check not replay
                                                                | 4. Store attestation
                                                                v
                                                         on-chain "Solvent as of ledger N"
```

## What the Proof Proves

The ZK circuit proves (without revealing `r[i]` or `salt`):

1. Each reserve balance is a 64-bit unsigned integer (non-negative, no overflow).
2. `total = sum(r[0..15])` is computed correctly.
3. `total >= L` (declared liabilities).
4. `C = Poseidon(r[0..15], salt)` binds the proof to a specific reserve vector.
5. The proof is bound to `period_id` (anti-replay).

## What the Proof Does NOT Prove

- Bank balances actually exist at a custodian.
- Wallet addresses belong to the issuer.
- Liabilities are complete and accurate.
- Multi-asset price conversions are correct.
- No temporary borrowing occurred before the snapshot.

These are roadmap items (custodian-signed inputs, oracle feeds, etc.).

## Repository Structure

```
stellaris/
  circuits/          Circom 2.x circuit (BLS12-381)
    por.circom       Main proof-of-reserves circuit
    components/      Range check, sum>=liabilities, Poseidon commitment
    inputs/          Test vectors
    PUBLIC_SIGNALS.md  Verified public signal order (source of truth)
  contracts/stellaris/  Soroban smart contract (Rust, soroban-sdk 25.1.0)
    src/lib.rs       Contract entry: init, attest, get_attestation, list_periods
    src/verifier.rs  Groth16 BLS12-381 pairing check
    src/types.rs     Data types, errors, storage keys
    src/test.rs      Unit tests (true/false/replay/insolvent)
  client/            TypeScript SDK
    src/domain.ts    Transport-free domain model
    src/policy.ts    Snapshot policy evaluation
    src/manifest.ts  Artifact/deployment manifest validation
    src/signals.ts   Public signal parsing/encoding
    src/prove.ts     WASM proof generation (snarkjs)
    src/codec.ts     Contract argument encoding boundary
    src/operations.ts Typed contract operation registry
    src/transport.ts Binding/RPC transport adapter with validation + retry
    src/stellar.ts   StellarisClient — high-level contract client
    src/events.ts    Typed registry/reconciler event bus and replay log
    src/audit.ts     Redacted operational audit artifacts
    src/pipeline.ts  Normalize -> policy -> prove -> verify -> attest orchestration
    src/registry.ts  Indexed attestation state, gap/replay diagnostics
    src/persistence.ts JSON-safe registry checkpoints and file-backed store
    src/reconciler.ts Deterministic registry refresh jobs with audit/backoff
    src/index.ts     SDK public API exports
  setup/             Trusted setup scripts
    ceremony.sh      DEMO Groth16 setup (single contributor, BLS12-381)
    export-fixtures.sh  Generate proof fixtures for contract tests
  fixtures/          Generated proof fixtures
  notes/             Research notes (P0 verifier findings, etc.)
  docs/              Planning, research, and strategy documents
```

## Quick Start

### Prerequisites

Install the toolchain (user runs these):

```bash
# Circom (BLS12-381 capable, v2.1+)
git clone https://github.com/iden3/circom.git && cd circom && cargo build --release && cargo install --path circom

# snarkjs
npm install -g snarkjs

# Stellar CLI + Soroban
# See: https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup
```

### Build & Test

```bash
# Circuit + setup
bash setup/ceremony.sh               # Compile circuit, trusted setup

# Generate fixtures
bash setup/export-fixtures.sh        # Solvent, insolvent, boundary proofs

# Verify public signal order
cat fixtures/solvent/public.json     # Record in circuits/PUBLIC_SIGNALS.md

# Contract tests
cd contracts/stellaris && cargo test

# Client (install deps)
cd client && npm install
```

## Honest Limitations

- **Research prototype, not audited.** Do not use in production with real assets.
- **Trusted setup** is a single-contributor DEMO — not a secure ceremony.
- **Testnet only.** The contract has not been deployed to Stellar mainnet.
- **Raw balance truthfulness** requires custodian-signed inputs or oracles (roadmap).
- **Frontend** for the demo product will be built separately.

## License

MIT
