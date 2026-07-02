# AGENTS.md — Stellaris (ZK Proof-of-Reserves on Stellar)

Conventions and commands for any agent/developer working this project. Read this
and `docs/plan/00-RPD-OVERVIEW.md` before writing code.

## What this is
A Stellar Hacks: Real-World ZK submission. An issuer proves on-chain that
`sum(reserves) >= liabilities` without revealing balances; a Soroban contract
verifies the Groth16 proof and records a non-replayable solvency attestation.
Full rationale: `docs/research/04-RECOMMENDATION.md`.

## Current phase
Research COMPLETE. Implement IN PROGRESS — core protocol, SDK, docs website, and
integration workspace are active:
- `stellaris-core/` holds the protocol: Circom circuits, Soroban contract, fixtures,
  and the `@stellaris/por-sdk` TypeScript SDK.
- `stellaris/` is the Fumadocs/Next.js documentation and product landing website.
- `stellaris-apps/` is the integration showcase monorepo: Soroban transport,
  keypair signer, manifest loader, attestation service, registry indexer, and
  operator CLI.
- Current verification gates: docs `bun run build`; apps `npm run build`,
  `npm run typecheck`, `npm run lint`, `npm test` (92/92); core contract
  `cargo test` (60/60), `cargo clippy --all-targets` clean.
See `docs/CHANGELOG.md` [Unreleased] for the authoritative status. Testnet
deploy + live e2e are DONE (mint-guard live on testnet; see
`docs/plan/TESTNET-E2E-EVIDENCE.md` for contract IDs + tx hashes). `docs/plan/05-DEVELOPMENT-PLAYBOOK.md` remains the
step checklist.

## Read-before-build (verify-before-build)
1. Clone `stellar/soroban-examples` -> `groth16_verifier`. Confirm the EXACT
   verify function name, argument types, and proof/vk byte encoding. The RPD
   signatures are planned shapes — reconcile with the real repo, do not trust
   memory.
2. Read `skills.stellar.org` (org best practice) and the ZK Proofs skill before
   building on Stellar.

## CROSS-FILE INVARIANTS (never drift — these break verification silently)
1. Public-signal order is generated and recorded in `circuits/PUBLIC_SIGNALS.md`;
   it must then be identical in `circuits/por.circom`,
   `contracts/stellaris/src/types.rs`, `client/src/constants.ts`, and
   `client/src/prove.ts`. Desired product order is
   `[ solvent, C_commitment, L_liabilities, period_id ]`, but actual snarkjs
   output wins.
2. Proof/VK byte encoding must match the on-chain verifier exactly. The SINGLE
   authoritative serializer lives in the SDK core: `client/src/encoding.ts`
   (exported via `@stellaris/por-sdk`, re-exported through `@stellaris-apps/
   common`). G1 = 96B `X(48)||Y(48)` big-endian; G2 = 192B with each Fp2 written
   `c1||c0` (high coefficient first — snarkjs `[c0,c1]` is SWAPPED); U256 signals
   = 32B big-endian. Locked by `client/scripts/encoding-check.mjs` (byte-for-byte
   vs Rust ground truth). The transport's `proof-codec.ts` is a THIN ADAPTER over
   this — do NOT reimplement the byte layout there (that recreates the split-brain
   removed in [Unreleased]). `attest` submits `bundle.proof` (snarkjs shape); the
   contract codec serializes via the shared encoder. Do NOT reorder without
   re-running the byte-equality test.
3. `n = 16` accounts, `nBits = 64` consistent across circuit, client validation,
   and tests.
4. Curve = bls12_381 (BLS12-381) to match the official Stellar groth16_verifier
   example (confirmed in P0). The earlier BN254 assumption was incorrect; the
   official Soroban Groth16 verifier uses BLS12-381 exclusively.
5. soroban-sdk + stellar-sdk versions PINNED from the official example. Never
   "latest".

## Commands (fill in exact versions during P0)
```
# circuit
circom circuits/por.circom --r1cs --wasm --sym
bash setup/ceremony.sh         # DEMO trusted setup (single contributor)
bash setup/export-vk.sh        # vk + proof -> contract-ready hex

# contract
cd contracts/stellaris && cargo test          # unit: true/false/replay/insolvent
stellar contract build
stellar contract deploy ...                   # testnet

# client
cd client && npm install && npm test
bash client/scripts/e2e.sh testnet            # full live smoke
bash client/scripts/e2e.sh local              # mock client, no network
```

## Demo output conventions (user preference)
- Pure ASCII only. No Unicode box/check glyphs. Use `+ - |`, `[OK]`, `[FAIL]`,
  `[====>]`.
- `sleep` between demo steps for legibility.
- Expose ALL raw output (proofs, tx hashes, explorer links).
- Under `set -e`, append `|| true` after grep.

## Honest limitations (must appear in README + demo video)
- Proof binds arithmetic + non-negativity, NOT truthfulness of raw balances
  (needs a custodian oracle — out of scope).
- Trusted setup is a single-contributor DEMO, not a production ceremony.
- Research prototype, not audited. Testnet only.

## Go/no-go before P1
- P0 spike passes: tutorial `a*b=c` proof verifies TRUE on our testnet deploy.
- If P0 fails, fall back to GateProof (Candidate 4): same verifier path, simpler
  Merkle-membership circuit. See `docs/research/03-IDEA-CANDIDATES.md`.
