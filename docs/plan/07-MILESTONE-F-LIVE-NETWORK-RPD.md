# Milestone F — Live Network & Release Hardening (RPD)

Status: PLAN (pre-execution). Authoritative for intent within F; `docs/CHANGELOG.md`
[Unreleased] remains authoritative for what is actually built. Do not mark any
sub-gate `[x]` until its artifact exists and is verified (a passing command, a
committed measurement, a live tx hash). "Documented" is not "done."

Roadmap parent: `docs/ROADMAP.md` §Milestone F (F1 testnet e2e, F2 multi-party
ceremony, F3 audit-readiness).

---

## 0. Pre-flight — exactly what the operator must provide

F1 is the only network-gated sub-milestone. Precise requirement:

| Need | Why | Who |
|---|---|---|
| Outbound HTTPS | (a) install `stellar` CLI, (b) `cargo build --target wasm32` first-time crate download (js-sys etc. are NOT vendored — verified: `--offline` fails on `js-sys v0.3.102`), (c) reach testnet RPC + friendbot | operator enables network |
| A funded testnet account | deploy + invoke transactions pay fees | **OPTIONAL** — on **testnet** friendbot funds any generated account for free; a pre-supplied `S...` key is only needed if the operator wants a specific identity. Mainnet is out of F's scope. |

**Answer to "is network + funded key enough?": Yes for F1, with caveats.** Network
is the hard requirement; a funded key is *expected*-sufficient on testnet (I can
`stellar keys generate --fund` via friendbot myself) but NOT guaranteed —
friendbot can be down/rate-limited, and deploy + multiple invokes + negative
tests can exhaust a starting balance. Contingencies baked into the harness:
retry/refund on insufficient-balance, single-account sequence isolation (no
concurrent txs), and acceptance of an operator-supplied pre-funded `S...` as the
robust path if friendbot flakes. F2/F3 are offline-capable EXCEPT one optional
live read (the on-chain VK-digest equality check, see F-P4) — and they still need
Node deps already installed (`npm install` is itself network-gated if not cached).

Verified local toolchain (no action needed): circom 2.2.3, snarkjs, rustc 1.93.1
with `wasm32-unknown-unknown`, soroban-sdk pinned 25.1.0. v1 fixtures
(`fixtures/{solvent,insolvent,boundary}`, `fixtures/verification_key.json`) and
v3 artifacts (`build/v3/por_v3_final.zkey`, `por_v3_vk.json`, real `.wtns`,
`fixtures/v3/`) already exist on disk.

---

## 1. Threat model framing (what F actually proves)

F closes the gap between "verified in `cargo test` / mock transport" and "verified
against a real Soroban node." The single highest-value thing F1 proves that no
offline test can: **the shared byte encoder (`client/src/encoding.ts`) produces
bytes a real protocol-22+ node accepts through the live BLS12-381 pairing host
functions.** Every cargo test runs against the in-process test env; only a real
ledger validates the wire format end to end.

Honest boundaries F does NOT erase (carry forward from ROADMAP §0):
- Testnet ≠ mainnet custody hardening.
- The v3 *proving-from-snapshot* path still does not exist in the SDK; F-P2 submits
  the existing REAL v3 fixture proof via `client.attestV3()`, not a fresh
  snapshot→proof. Labelled honestly, no fabrication.
- F2 with one operator is entropy-separated sequential contributions, not
  geographically distributed parties — the deliverable is the transcript FORMAT +
  verification, labelled as such.

---

## 2. Phase ladder (dependency-ordered, each with an exit gate)

### F-P0 — Environment bring-up + live prechecks  [network-gated]

1. Install `stellar` CLI; capture `stellar --version` and **pin that exact version**
   in the harness header (record-then-pin: the version becomes a constant, not a
   "whatever yields" floating dep). Confirm the bundled optimizer is usable
   (`stellar contract optimize --help`; `wasm-opt --version || true`).
2. Network config + health prechecks (do NOT hardcode blindly): `stellar network`
   add/use testnet via the CLI's own config; `curl -s <rpc>/health`; capture the
   **protocol version** from RPC `getNetwork`/`getLatestLedger` and ASSERT it
   includes the BLS12-381 host functions (protocol 22+ / CAP-0059). If the live
   protocol lacks them, F1 is hard-blocked — stop and report.
3. Build the contract to wasm: `cargo build --target wasm32-unknown-unknown
   --release` (workspace `target/` may be at repo root, not the crate dir). DISCOVER
   the emitted artifact (`find target/wasm32-unknown-unknown/release -maxdepth 1
   -name '*.wasm'`) — do NOT hardcode `stellaris.wasm`. `stellar contract optimize`;
   record raw + optimized sizes and ASSERT optimized size is under the Stellar
   max-contract-size limit.
4. Node deps: `npm install` (network-gated) so the SDK harness + `stellaris-ops`
   run; record `@stellar/stellar-sdk` version (must be compatible with the pinned
   CLI's network passphrase/RPC).
5. Funding: `stellar keys generate stellaris-issuer --fund --network testnet`
   (friendbot) OR import the operator `S...`. Verify the account exists and has a
   usable sequence number + non-zero balance.

Exit gate: pinned `stellar --version` recorded; live protocol version asserted to
support BLS12-381; discovered `.wasm` path + optimized size (under limit) recorded;
`@stellar/stellar-sdk` version recorded; a funded testnet account (`G...`) with a
valid sequence verified.

### F-P1 — Deploy + init harness (single source of truth)  [F1 core]

ORDERING FIX (from review): the harness is built and runs the deploy/init — there
is NO separate manual deploy step that could diverge from it.

1. CHECKPOINT before writing anything: inspect `client/src/operations.ts` +
   `codec.ts` — does the SDK already serialize `Groth16VerificationKey` to ScVal
   for a real `init` invoke? It almost certainly does (the transport already builds
   contract calls). REUSE it. The VK init arg is a nested ScVal struct (G1/G2
   points, Fp limbs) — passing it as hand-written shell JSON to `stellar contract
   invoke` is fragile and quoting-fragile. THEREFORE the deploy/init harness is a
   **Node/SDK script** (`setup/deploy-testnet.mjs`) using `@stellar/stellar-sdk` +
   the SAME `encoding.ts`/`codec.ts` boundary (invariant #2 — no second converter),
   NOT a shell `stellar contract invoke` with serialized JSON.
2. The harness, end to end, idempotently: deploys the optimized wasm (capture
   **contract ID** + **wasm hash**), invokes `init(admin, vk)` with the v1 VK and
   `init_v3(vk)` with `build/v3/por_v3_vk.json`. Every tx is SIMULATED first
   (footprint/auth/resource-fee/Soroban tx data) then signed then sent then polled
   — real Soroban prepare flow, not a blind submit. Resolve at execution: who must
   sign `init` (admin auth?), and whether `issuer` passed to `attest` must equal
   the source account or is just an argument.
3. Harness writes `build/testnet/deploy.json` (contract ID, wasm hash, tx hashes,
   ledger numbers, CLI + SDK versions) and emits `manifest.testnet.json` in the SDK
   loader shape FROM that output — one source of truth. SECURITY: the harness
   redacts secrets, never `set -x` over a secret, and `deploy.json` contains NO
   `S...`.

Exit gate: `get_admin()` returns the issuer; `get_vk()` / `get_vk_v3()` return
non-null over RPC (via getter invoke — note if the full VK struct is large, prefer
a digest getter); `build/testnet/deploy.json` + `manifest.testnet.json` written,
secret-free, pinned to the live contract ID.

### F-P2 — Real e2e attest  [F1 headline]

1. PRECONDITION: verify the v1 fixture proof was produced under the SAME VK now
   init'd on-chain, and the v3 fixture matches `build/v3/por_v3_vk.json` — else the
   live verify returns `ProofInvalid`. (Freeze these artifacts for F1; do not
   re-ceremony until after F1, see F-P4 ordering note.)
2. v1 e2e: `STELLARIS_MANIFEST=manifest.testnet.json STELLARIS_ISSUER_SECRET=…
   stellaris-ops attest <solvent snapshot>` → REAL tx hash. Confirm the SDK
   transport simulates+prepares the Soroban tx (footprint/fee/auth) and signs with
   the manifest's network passphrase before send. This is THE byte-format
   validation against a live node.
3. Read back: `stellaris-ops get <issuer> <pid>`; ALSO capture the emitted
   `attested` contract event (the public integration surface) + result XDR, not
   just the stored struct.
4. v3 e2e: `setup/attest-v3-testnet.mjs` loads the existing real v3 fixture proof
   and calls `client.attestV3({ issuer, bundle, signer })` against the live
   deployment (SDK has no v3 snapshot→proof path — honest). Read back via
   `stellaris-ops get-v3` + capture the `attested_v3` event. (C2/C3 optional: a
   `publish_oracle_commitment` + matching attest to demonstrate `oracle_bound=true`
   on a real ledger; `set_custodian` + `attest_v3_signed` for `custodian_bound=true`.)
5. TTL note: Soroban persistent/instance storage has rent/TTL; document that
   testnet state is ephemeral and extend TTL if the attestation must stay readable.

Exit gate: a v1 AND a v3 real testnet tx hash, both read back AND their events
captured, recorded in `stellaris-core/README.md` ALONGSIDE contract ID, network
passphrase, ledger number, wasm hash, VK digest, and proof/public-input digest
(testnet tx hashes alone are not durable evidence — the bundle is). Saved under
`build/testnet/`.

### F-P3 — Negative paths on the real chain  [F1 soundness]

CLASSIFY each negative by its true failure point (review fix — an insolvent witness
may not even produce a valid proof):
1. valid proof carrying an insolvent public signal → expect `NotSolvent`;
2. an invalid/garbage proof or wrong signals → expect `ProofInvalid`;
3. replay of an already-attested period → expect `PeriodAlreadyAttested` (may
   surface at simulation, not send).
Assert by the **numeric contract error code** (+ result XDR), not a formatted
string — CLI/RPC error rendering varies.

Exit gate: real testnet error responses (numeric codes + XDR) captured for the
insolvent + replay cases (+ proof-invalid if run), saved under
`build/testnet/negative/`.

### F-P4 — Multi-party ceremony  [F2]

CEREMONY-PHASE SEPARATION (review fix — do NOT conflate phase 1 and phase 2):
- Phase 1 (powers-of-tau) is universal/circuit-independent. Either reuse the
  existing `pot_final.ptau` with documented provenance + `powersoftau verify`, OR
  run a fresh multi-contributor phase-1 ONCE and verify it. Do NOT re-run
  `powersoftau contribute` per circuit.
- Phase 2 (zkey) is PER CIRCUIT: `groth16 setup <r1cs> <final.ptau> <0000.zkey>`,
  then N sequential `zkey contribute` (distinct entropy each), then optional
  `zkey beacon`, then `zkey export verificationkey`.

VK-DIGEST ORDERING TRAP (review fix — the critical one): F-P1 already init'd the
LIVE contract with the EXISTING v1/v3 VKs. If F-P4 produces a NEW final zkey/VK,
its digest will NOT match the on-chain `get_vk_digest()` and ALL existing fixture
proofs become invalid. Resolve by choosing ONE mode up front:
- (a) Transcript-of-record mode [default, offline]: F-P4 documents + verifies the
  provenance of the ALREADY-DEPLOYED zkey/VK (the one F1 used). No new VK, no
  on-chain comparison needed, fully offline. The on-chain digest equals the
  transcript digest by construction.
- (b) Re-ceremony mode [requires re-deploy]: if a fresh multi-party VK is the
  goal, the ceremony must run BEFORE F-P1 init, F1 fixtures must be regenerated
  from the new zkey, and the live contract init'd with the new VK. This reorders
  the whole milestone — only take it if a genuinely new ceremony is required.

1. Generalize `setup/ceremony.sh` (+ `ceremony-v3.sh`) for N phase-2 contributors
   + beacon (per the separation above).
2. Publish `setup/CEREMONY-TRANSCRIPT.md`: r1cs hash, ptau hash + provenance,
   initial-zkey hash, each contribution's before/after hash, beacon value, final
   zkey hash, exported-VK hash/digest, and the EXACT circom/snarkjs versions +
   commands. Tie the VK digest to ROADMAP A4 (`get_vk_digest`).
3. Verify: `powersoftau verify <final.ptau>` (if phase-1 was run) AND
   `snarkjs zkey verify <r1cs> <final.ptau> <final.zkey>` pass.

Exit gate: a committed transcript with the full hash chain above; `zkey verify`
(and `powersoftau verify` if applicable) pass. In mode (a) the digest equals the
on-chain VK digest by construction (one optional live read to confirm); mode (b)
asserts equality after re-deploy. Labelled honestly as entropy-separated
sequential contributions if run by a single operator.

### F-P5 — Audit-readiness  [F3, offline; needs Node/Rust deps already installed]

1. `docs/security/THREAT-MODEL.md`: assets, trust boundaries (issuer / custodian /
   oracle / verifier / chain), attacker capabilities, per-milestone mitigations
   (A/B/C/D), and residual risks (the honest boundaries above).
2. `docs/security/UNDER-CONSTRAINED-REVIEW.md`: MECHANICAL checks per circuit
   (`por`, `por_v2`, `por_v3`), not prose assurances — `snarkjs r1cs info` (signal
   + constraint counts), inspect `.sym`/r1cs for free/unconstrained witness
   signals, confirm every input is range-checked, every intermediate sum is
   constrained with no overflow slack relative to the field modulus, and document
   any intentionally-unconstrained public input. Record concrete findings + the
   command output per circuit.
3. Fuzz/property harness — pick ONE that is actually available offline: prefer
   `proptest` (a dev-dependency, no toolchain change) over `cargo fuzz` (needs
   nightly + `cargo-fuzz` install = network). Target the signal parsers
   (`parse_public_signals`, `_v2`, `_v3`) + codec with random `Vec<U256>` inputs.
   HONEST CLAIM (review fix): assert NO Rust panic in the parser/codec for inputs
   that reach them, and typed errors for malformed-but-well-typed input — do NOT
   claim every malformed contract call yields a typed error (host/SDK may reject
   at the ABI boundary before contract code runs).

Exit gate: threat model committed; mechanical under-constrained findings (with
command output) recorded for all three circuits; proptest target runs N iterations
with zero panics in the parser/codec.

---

## 3. New / changed artifacts (file-level)

| Path | Action | Phase |
|---|---|---|
| `setup/deploy-testnet.mjs` | NEW — Node/SDK deploy+init harness (single source of truth): deploys, init's v1+v3 VKs via the shared `encoding.ts`/`codec.ts` boundary, simulates+signs+sends, writes secret-free `build/testnet/deploy.json` + `manifest.testnet.json`. ASCII logging, raw output, no `set -x` over secrets | F-P1 |
| `setup/attest-v3-testnet.mjs` | NEW — submit existing real v3 fixture proof via `client.attestV3()` to live node | F-P2 |
| `manifest.testnet.json` | NEW — SDK-loader-shaped manifest, emitted BY the harness, pinned to the live contract ID | F-P1 |
| `setup/ceremony.sh`, `ceremony-v3.sh` | EDIT — N phase-2 contributors + beacon (phase-1/phase-2 separated; see F-P4) | F-P4 |
| `setup/CEREMONY-TRANSCRIPT.md` | NEW — full hash chain (r1cs/ptau/zkey/VK) + versions + digest | F-P4 |
| `docs/security/THREAT-MODEL.md` | NEW | F-P5 |
| `docs/security/UNDER-CONSTRAINED-REVIEW.md` | NEW — mechanical per-circuit findings + command output | F-P5 |
| `contracts/stellaris/` proptest module | NEW — parser/codec property target (proptest, NOT cargo-fuzz — offline) | F-P5 |
| `stellaris-core/README.md` | EDIT — record the full evidence bundle (tx hash + contract ID + passphrase + ledger + wasm hash + VK digest + proof digest) | F-P2 |
| `docs/CHANGELOG.md` | EDIT — F-Pn entries as each gate is met | all |
| `docs/ROADMAP.md` | EDIT — flip F sub-items to DONE only when gate artifacts exist | all |

Invariants re-checked each phase (ROADMAP §2 / AGENTS.md): ONE encoder
(`encoding.ts`) — the deploy/init converter must reuse it, never reimplement;
public-signal ABI unchanged by F; soroban-sdk/stellar-sdk versions pinned; BLS12-381
throughout.

---

## 4. Execution order & gating summary

```
operator enables network  ->  F-P0  ->  F-P1  ->  F-P2  ->  F-P3   (F1 complete: live tx hash in README)
                                                   |
F2/F3 need NO network:                             +->  F-P4 (ceremony)  +->  F-P5 (audit-readiness)
```

F-P4 and F-P5 can begin in parallel with / before network is enabled (they are
offline, given Node/Rust deps are already installed). F-P0..F-P3 are strictly
serial and network-gated. The smallest first real step the moment network is on:
F-P0 (install+pin `stellar` CLI, assert live protocol supports BLS12-381, build
the wasm) — everything downstream needs the deploy artifact and the protocol
assertion. The deploy/init harness (F-P1) is written and run as ONE step that is
the single source of truth for contract ID + manifest; there is no separate manual
deploy that could diverge from it.

DEPENDENCY GAP (resolve before relying on digest gates): several exit gates and
the F-P4 transcript reference `get_vk_digest()` / ROADMAP A4 (VK provenance
on-chain). A4 is NOT built yet (ROADMAP marks only A2/A3 done). Either (i) build A4
first (small, offline contract addition: store the ceremony transcript hash at
`init`, expose `get_vk_digest()`), or (ii) drop the on-chain digest comparison to a
purely local VK-hash check for F. Recommended: build A4 as F-P0.5 (offline) since it
is the natural home for the provenance the whole milestone wants to record.

---

## 5. Open checkpoints to resolve at execution (not assumptions)

1. Confirm `operations.ts`/`codec.ts` already serializes `Groth16VerificationKey`
   to ScVal for a real `init` invoke (it should — the transport builds contract
   calls). This is what lets the Node harness reuse the shared encoder instead of
   hand-rolling init-arg JSON. Inspect first.
2. `stellar` CLI version: on first install, capture `stellar --version`, then
   resolve the exact funding/deploy/invoke command syntax for THAT version (it
   varies: `--fund` flag vs `stellar keys fund`; upload-then-deploy-from-hash vs
   direct deploy). Hardcode the resolved version + commands into the harness; the
   harness must fail loudly if `stellar --version` later drifts from the pin.
3. Who signs `init` (admin auth model) and whether the `issuer` arg to `attest*`
   must equal the source account or is just a parameter — verify against `admin.rs`
   before the first live invoke.
4. Whether `attest_v3` on a real ledger needs the v3 VK init'd with the SAME
   ceremony VK the fixture proof was produced under (it must — verify the fixture's
   VK matches `build/v3/por_v3_vk.json` before submitting, else `ProofInvalid`).
5. Friendbot funding amount sufficiency for the full deploy+invoke sequence
   (re-fund, or fall back to an operator-supplied pre-funded key, if a tx fails on
   insufficient balance).
6. Whether the deployed VK getter returns a struct too large for a comfortable RPC
   read — if so, prefer the A4 `get_vk_digest()` getter for the exit-gate check.
