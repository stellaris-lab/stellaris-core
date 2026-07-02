# 05 — Development Playbook: Minor-Step Plan for Implementation

This is the development-ready checklist. Follow it linearly. Do not skip gates.
Each phase defines exactly what to write, what to run, what output to expect, and
what failure means.

## Global rules before any phase

1. Work from repo root: `/home/harry-riddle/dev/github.com/stellaris/stellaris`.
2. Keep planning docs under `docs/`; build source lives directly at project root
   (circuits/, contracts/, client/, setup/, fixtures/).
3. Do not install toolchains without user approval. The user prefers to run setup.
4. Use pure ASCII in scripts and demo output: `[OK]`, `[FAIL]`, `+---+`.
5. Expose raw command output in demo scripts; do not hide important logs.
6. Pin versions from official examples. Never use `latest` in code or docs.
7. At the end of every phase, update `CHANGELOG.md` and any constants docs.

---

## P0 — Official verifier integration spike

### Purpose
Prove we can deploy or run the official Stellar Groth16 verifier and make a known
sample proof verify TRUE. This removes the biggest unknown: encoding.

### Files to create or update
- `stellaris/vendor/soroban-examples/` or `stellaris/references/soroban-examples/`
- `stellaris/notes/P0-VERIFIER-FINDINGS.md`
- `stellaris/scripts/p0_verify_official_example.sh`

### Minor steps
1. Clone the official examples repo into a vendor/reference folder.
2. Locate `groth16_verifier`.
3. Read its README, tests, Cargo.toml, and any sample proof/vk files.
4. Record exact versions:
   - Rust toolchain,
   - soroban-sdk,
   - stellar CLI,
   - curve used by the sample,
   - verifier argument types.
5. Run its tests locally if available.
6. Build the verifier wasm.
7. Deploy to Stellar testnet if the example supports deployment.
8. Invoke the verifier with its own sample vk/proof/public inputs.
9. Save the exact successful command and raw output in `P0-VERIFIER-FINDINGS.md`.

### Expected outputs
- A local test or testnet transaction proving TRUE.
- A documented call shape, for example:
  - contract function name,
  - argument order,
  - proof format,
  - public input format,
  - verification key format.

### Failure handling
- If tests fail because dependencies are missing: stop and list exact missing deps.
- If testnet deployment fails: still complete local tests, then retry testnet once.
- If proof verifies FALSE: stop. Do not write Stellaris circuit yet. Debug encoding.
- If official example only supports BLS12-381 but plan assumes BN254: update plan
  immediately and decide whether to adapt to the supported curve or find BN254 PR.

### Acceptance criteria
- `[OK]` official proof verifies TRUE.
- `P0-VERIFIER-FINDINGS.md` records exact versions and exact proof/vk encoding.
- User can re-run `scripts/p0_verify_official_example.sh` and see the same result.

---

## P1 — Circuit skeleton and public signal verification

### Purpose
Create the smallest possible PoR circuit and verify its public signal order from
real snarkjs output.

### Files to create
- `stellaris/circuits/components/range_check.circom`
- `stellaris/circuits/components/sum_gte.circom`
- `stellaris/circuits/components/commit.circom`
- `stellaris/circuits/por.circom`
- `stellaris/circuits/inputs/solvent.json`
- `stellaris/circuits/inputs/insolvent.json`
- `stellaris/circuits/inputs/boundary.json`
- `stellaris/circuits/PUBLIC_SIGNALS.md`

### Minor steps
1. Create a minimal `por.circom` with fixed `n=16`, `nBits=64`.
2. Implement range checks for each reserve input.
3. Implement total sum with explicit intermediate signals; do not leave dangling
   computations as unconstrained vars.
4. Implement comparison `total >= L` using a known circomlib comparator.
5. Implement Poseidon commitment over all padded balances plus salt.
6. Expose `solvent` and `C` as main outputs.
7. Declare `L` and `period_id` public at main component level.
8. Compile with `--r1cs --wasm --sym`.
9. Generate witness for `solvent.json`.
10. Generate proof and `public.json`.
11. Inspect `public.json` and `.sym`.
12. Write `PUBLIC_SIGNALS.md` with the actual emitted order.

### Expected outputs
- `public.json` contains four values.
- Solvent vector: solvent value is `1`.
- Insolvent vector: proof is valid but solvent value is `0`.
- Boundary vector: solvent value is `1`.

### Failure handling
- If compile fails: fix circuit syntax only; do not touch contract plan.
- If witness generation fails for solvent input: inspect constraints; likely bad
  comparator or range bound.
- If public signal order differs from desired order: update constants to actual
  order; do not guess.
- If insolvent input cannot generate proof: the circuit incorrectly constrains
  solvency to true. Fix it so insolvent proofs are valid with `solvent=0`; the
  contract, not the circuit, rejects insolvent attestations.

### Acceptance criteria
- Three input vectors compile/prove.
- `PUBLIC_SIGNALS.md` exists and is referenced by contract/client tasks.
- The public signal order is confirmed from actual generated files.

---

## P2 — Trusted setup and fixture generation

### Purpose
Create proving/verifying keys and stable fixtures for contract tests and client
development.

### Files to create
- `stellaris/setup/ceremony.sh`
- `stellaris/setup/export-fixtures.sh`
- `stellaris/fixtures/solvent/proof.json`
- `stellaris/fixtures/solvent/public.json`
- `stellaris/fixtures/insolvent/proof.json`
- `stellaris/fixtures/insolvent/public.json`
- `stellaris/fixtures/verification_key.json`
- `stellaris/fixtures/README.md`

### Minor steps
1. Write `ceremony.sh` with strict mode: `set -euo pipefail`.
2. Add clear header: DEMO single-contributor trusted setup, not production.
3. Compile circuit inside the script or require compiled output exists.
4. Run powers of tau with bn128/BN254 if P0 confirms BN254 path.
5. Run phase 2 setup for `por.r1cs`.
6. Export verification key JSON.
7. Generate proofs for solvent, insolvent, boundary vectors.
8. Verify each proof with `snarkjs groth16 verify`.
9. Write `fixtures/README.md` explaining each fixture.

### Expected outputs
- `snarkjs groth16 verify` returns OK for solvent, insolvent, and boundary.
- Fixture files are deterministic enough for contract tests.

### Failure handling
- If ceremony uses wrong curve: stop and reconcile with P0 verifier findings.
- If proof generation succeeds but verification fails: delete generated keys and
  rerun setup from scratch; do not continue with corrupted fixtures.

### Acceptance criteria
- Fixtures are committed/available for contract tests.
- `ceremony.sh` can be re-run from clean build artifacts.
- README loudly states demo-only trusted setup.

---

## P3 — Contract implementation

### Purpose
Create a minimal Soroban contract that uses the verified proof format to record
solvency attestations.

### Files to create
- `stellaris/contracts/stellaris/Cargo.toml`
- `stellaris/contracts/stellaris/src/lib.rs`
- `stellaris/contracts/stellaris/src/types.rs`
- `stellaris/contracts/stellaris/src/verifier.rs`
- `stellaris/contracts/stellaris/src/test.rs`
- `stellaris/contracts/stellaris/README.md`

### Minor steps
1. Copy or adapt official verifier code only after P0 documents its license and
   exact version.
2. Create `types.rs` using actual `PUBLIC_SIGNALS.md` order.
3. Implement `init(admin, vk)` with one-time initialization.
4. Implement `attest(issuer, proof, public_signals)`.
5. First line of `attest`: `issuer.require_auth()`.
6. Validate signal length before reading indexes.
7. Parse `solvent` as bool only if field value is exactly 0 or 1.
8. Parse `period_id` into u64 only if it fits.
9. Parse liabilities into u128 only if it fits.
10. Convert commitment to storage-safe bytes/string according to real type from P0.
11. Call verifier. If false, return `ProofInvalid`.
12. If `solvent != 1`, return `NotSolvent`.
13. If `(issuer, period_id)` already exists, return `PeriodAlreadyAttested`.
14. Store `Attestation`.
15. Emit event with issuer, period, commitment, liabilities.
16. Implement read functions.
17. Write unit tests using real fixtures.

### Expected outputs
- `cargo test` passes.
- Tests cover valid, tampered, insolvent, replay, uninitialized, bad signal length.

### Failure handling
- If fixture proof fails in contract but passes in snarkjs: encoding mismatch.
  Return to P0/P2 converter; do not change circuit constraints blindly.
- If contract exceeds budget: strip events/read helpers first, not core verify.

### Acceptance criteria
- Contract tests pass using real proof fixtures.
- Contract API documented in contract README.
- Errors are explicit and demo-friendly.

---

## P4 — Client proof and chain wiring

### Purpose
Generate proofs client-side and submit them to the contract without leaking raw
balances.

### Files to create
- `stellaris/client/package.json`
- `stellaris/client/src/constants.ts`
- `stellaris/client/src/prove.ts`
- `stellaris/client/src/stellar.ts`
- `stellaris/client/src/errors.ts`
- `stellaris/client/src/index.ts` or UI app entry

### Minor steps
1. Pin snarkjs and Stellar SDK versions.
2. Add constants from `PUBLIC_SIGNALS.md`.
3. Implement input validation: max 16 balances, each integer, each >=0, each <2^64.
4. Pad balances to 16 with zeros.
5. Generate salt if none supplied; make demo salt visible but not a secret in demo.
6. Build witness input object exactly matching circuit signal names.
7. Run `snarkjs.groth16.fullProve` in Node first, then browser.
8. Verify proof locally with `snarkjs.groth16.verify` before chain submit.
9. Convert proof/signals using the same encoding found in P0.
10. Submit `attest` transaction.
11. Read back attestation after successful submit.
12. Map contract errors to UI messages.

### Expected outputs
- Solvent sample submits and reads back attestation.
- Insolvent sample submits proof but contract returns `NotSolvent`.
- Replay sample returns `PeriodAlreadyAttested`.

### Failure handling
- If browser proving fails but Node works: asset path or bundler issue.
- If local verify succeeds but chain verify fails: encoding issue.
- If chain submit succeeds but readback fails: storage key/decode issue.

### Acceptance criteria
- One command can run the proof path from client to contract.
- Raw balances are never logged.
- UI can switch live/mock mode.

---

## P5 — End-to-end script

### Purpose
Create a deterministic command-line demo path before UI polish.

### Files to create
- `stellaris/client/scripts/e2e.sh`
- `stellaris/client/scripts/e2e-local.sh`
- `stellaris/client/scripts/e2e-testnet.sh`

### Minor steps
1. Use `set -euo pipefail`.
2. Print every command before running it.
3. Use ASCII `[OK]` and `[FAIL]` labels.
4. Sleep briefly between major steps for readable video capture.
5. Deploy or reuse contract id from `.env`.
6. Initialize contract with vk.
7. Generate solvent proof.
8. Submit solvent attestation.
9. Read attestation and print raw output.
10. Generate insolvent proof.
11. Submit insolvent proof and assert expected failure.
12. Submit replay and assert expected failure.
13. Print final summary with tx hashes and explorer links.

### Acceptance criteria
- Script demonstrates the full judge story without UI.
- Script can be screen-recorded as fallback.

---

## P6 — UI and README polish

### Purpose
Make the project understandable to judges in under three minutes.

### Files to create/update
- `stellaris/client/src/ui/*`
- `stellaris/README.md`
- `stellaris/DEMO-SCRIPT.md`
- `stellaris/docs/ARCHITECTURE.md`
- `stellaris/docs/LIMITATIONS.md`

### Minor steps
1. README first paragraph must include competitor-market validation:
   "Binance and Chainlink validate PoR demand; Stellaris brings a ZK/Soroban
   issuer attestation layer to Stellar."
2. Show architecture diagram.
3. Explain exact proof statement.
4. Explain honest limitations.
5. Provide run commands.
6. Provide contract id and testnet explorer links.
7. UI must have three visible states: proving locally, attested on-chain,
   rejected insolvent.
8. UI must say secrets never leave the browser.
9. Record demo using the script in `docs/strategy/DEMO-SCRIPT.md`.

### Acceptance criteria
- A judge can understand the repo without asking us.
- Demo video covers market gap, ZK proof, on-chain verification, rejection, and
  limitation.

---

## P7 — Final submission hardening

### Purpose
Package for DoraHacks.

### Minor steps
1. Run clean install/build/test from scratch.
2. Run e2e local.
3. Run e2e testnet once.
4. Confirm repo is public.
5. Confirm README has exact submission links.
6. Confirm demo video length is 2-3 minutes.
7. Confirm no raw private demo seed phrases are committed.
8. Confirm no generated huge artifacts bloat repo unless needed.
9. Tag final version.
10. Submit repo + video.

### Acceptance criteria
- Submission contains open-source repo and demo video.
- README clearly separates pre-existing official verifier code from new Stellaris
  code.
- ZK integration is impossible to miss.
