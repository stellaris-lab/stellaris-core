# Stellaris Productionization Roadmap

Path from the current verified prototype to a production, audited, mainnet-deployed
solvency-gated minting protocol on Stellar/Soroban. This document is honest about
what is DONE, what is DEFERRED, and what is genuinely BLOCKED on user/external input.

Companion docs:
- `docs/plan/NEXT-SPRINTS-DEBATE-RESEARCH.md` — why the wedge is solvency-gated minting.
- `docs/plan/SPRINT-A-SPIKE-GONOGO.md` — mint-guard architecture + the crate-split deferral.
- `docs/plan/REGULATORY-TRUST-BOUNDARY.md` — GENIUS/MiCA mapping; C2/C3 input bindings.
- `docs/plan/SCF-GRANT-APPLICATION.md` — distribution / non-dilutive funding path.

---

## Verified state today (the honest baseline)

DONE and verified by real tool output:
- Core contract: `cargo test` -> 60/60 pass, including 11 `test_mint_guard::*` that
  drive a REAL two-contract cross-contract call against the real Groth16 BLS12-381
  pairing check (`SOLVENT_V3` fixture). No mock attestation on the headline path.
- Default deployable WASM: `cargo build --target wasm32v1-none --release` ->
  clean 26,822-byte `stellaris_contract.wasm` (attestation contract only, no
  symbol collision).
- Apps: build + typecheck + lint (51 files) + `npm test` -> 92/92 pass, including
  11 new `guard-status` tests (off-chain mirror of the on-chain gate).
- Docs: `bun run build` -> green, mint-guard page + integration page wired into nav.
- Demo: `setup/mint-guard-demo.sh` -> runs green, narrates blocked -> attest -> allowed.

DEFERRED (named, not done):
- Standalone deployable guard WASM. The `SolvencyGatedToken` is `#[cfg(test)]`-only
  because two `#[contract]` types in one crate collide on the bare `init` symbol at
  wasm32v1-none, and the guard depends on the attestation's generated client. A real
  crate split is required. THIS IS MILESTONE A BELOW.

BLOCKED on user/external input:
- Any live testnet deploy: no `stellar`/`soroban` CLI installed in this environment,
  and no funded testnet account/keys. THIS IS MILESTONE B BELOW.

---

## Milestone A — Guard crate split (unblocks a deployable guard)

GOAL: ship `SolvencyGatedToken` as its own deployable WASM without weakening the
real-proof test.

Tasks:
1. Create `stellaris-core/contracts/mint-guard/` as a separate crate
   (`crate-type = ["cdylib"]`), moving `mint_guard.rs` there.
2. Import the attestation contract's client via `contractimport!` from the built
   `stellaris_contract.wasm` (the vendored `cross_contract` example is the pattern).
3. Preserve the real e2e test: either (a) a `testfixtures` non-default feature on the
   stellaris crate that re-exports `VK_V3`/`SOLVENT_V3` + the `g1_from`/`g2_from`
   helpers so the guard crate's test builds a real attestation, or (b) keep the
   headline real-proof e2e in the stellaris crate (as today) and add a guard-crate
   test that drives the imported client against a seeded attestation.
4. CI: build BOTH cdylibs; assert two distinct WASM artifacts; assert no symbol
   collision; keep the 60/60 + 87/87 gates.

Exit gate: `stellaris_contract.wasm` AND `mint_guard.wasm` both build; the guard's
real-proof test still passes.

Effort: ~1-2 days. No external dependency. This is the highest-leverage next code task.

---

## Milestone B — Testnet deployment + live e2e (USER-GATED)

GOAL: a real testnet contract id, a real on-chain attestation, and a real mint that
is blocked then allowed — with explorer links.

BLOCKED until the user provides / confirms:
- `stellar` CLI installed (Stellar CLI >= the version matching soroban-sdk 25.x).
- A funded testnet account (friendbot) for admin + issuer.
- Whether demo keys may be generated locally (recommended: yes, testnet-only).

Tasks (once unblocked):
1. `stellar contract build` for both WASMs (post-Milestone A).
2. Deploy attestation contract; `init` + `init_v3` with the real v3 VK.
3. Deploy guard; `init` bound to the attestation contract id + issuer + policy.
4. Generate the deployment manifest (contract ids, passphrase, RPC, VK hash,
   artifact hashes, public-signal ABI) and wire `stellaris-apps` to it.
5. Live sequence: attempt mint (blocked) -> `attest_v3` real proof -> mint (allowed).
   Record tx hashes + explorer links into the demo + docs.

Exit gate: a public testnet tx where a mint reverts pre-attestation and succeeds
post-attestation, both linked.

Effort: ~3-5 days of work once the toolchain/account are available.

---

## Milestone C — Trust-input hardening (turns the honest caveat into product)

GOAL: make the C2/C3 bindings the default for regulated issuers, per the
GENIUS/MiCA mapping.

Tasks:
- Custodian (C2): document + script a real BLS custodian-signing flow; make
  `require_custodian_bound` the recommended policy for stablecoin issuers.
- Oracle (C3): integrate a real price-feed source for `publish_oracle_commitment`;
  make `require_oracle_bound` the recommended policy for multi-asset RWA.
- Liability provenance: document the boundary explicitly — the circuit binds the
  arithmetic over supplied inputs; the CPA still certifies the inputs.
- Add a "Trust Boundary vs GENIUS/MiCA" page to the public docs (from the plan doc).

Exit gate: an issuer can run a fully-bound attestation (oracle + custodian) on
testnet and a guard that requires both.

---

## Milestone D — Security review (pre-mainnet)

- Circuit review (Circom por_v3 + components): constraint soundness, range checks.
- Trusted setup: replace the single-contributor DEMO ceremony with a multi-party
  ceremony; publish contributions + transcript.
- Contract audit: attestation + guard (auth, replay, staleness, cross-contract
  read cost, supply accounting i128 overflow).
- SDK + transport review: byte-encoding invariants, manifest/artifact hash checks.
- Threat-model review against the risk register (false inputs, stale attestations,
  compromised issuer/oracle/custodian keys, manifest drift, ABI drift).

Exit gate: external audit report(s) published; criticals/highs resolved.

---

## Milestone E — Mainnet pilot

- Limited pilot with one design-partner issuer (BENJI/Spiko-class tokenized fund or
  a Soroban stablecoin).
- Operational monitoring: attestation freshness alerts, failed-mint dashboard,
  registry indexer, incident response runbook.
- Public status dashboard; published VK hash + deployment manifest.
- KMS/HSM signer for issuer + custodian keys (no raw seeds in env).

Exit gate: a real issuer mints under the guard on mainnet for N consecutive
periods with monitored freshness.

---

## Risk register (carried forward)

| Risk | Mitigation | Milestone |
|---|---|---|
| Guard not independently deployable | Crate split | A |
| Demo trusted setup not production-safe | Multi-party ceremony | D |
| Input truthfulness (false reserves) | C2 custodian + C3 oracle bindings | C |
| Stale attestation used to mint | Period + max-age gate (built, tested) | done / B live |
| Cross-contract read cost on-chain | Measure on testnet; cache period in guard if needed | B |
| ABI / public-signal drift | Cross-file invariants + byte-equality test (in place) | ongoing |
| Issuer/oracle/custodian key compromise | KMS/HSM signer; rotation policy | E |
| Manifest points at wrong contract | Manifest + artifact hash validation | B/C |
| No adoption (the Summa failure) | SCF grant + one design partner + mint-guard demo | B/C/E |

---

## Sequencing summary

1. Milestone A (crate split) — now, no blocker, ~1-2 days.
2. Milestone B (testnet e2e) — as soon as the user provides CLI + funded account.
3. Milestone C (trust-input hardening) — alongside/after B.
4. Milestone D (security review) — before any mainnet exposure.
5. Milestone E (mainnet pilot) — gated on D + a design partner.

The protocol, SDK, guard logic, docs, and demo are proven against real proofs
today. The remaining path is packaging (A), live proof (B), trust-input defaults
(C), and the audit/pilot discipline (D, E) that separates a strong prototype from
production infrastructure.
