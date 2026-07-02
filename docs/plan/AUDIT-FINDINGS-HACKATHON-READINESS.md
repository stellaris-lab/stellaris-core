# Stellaris Codebase + Docs Audit — Hackathon Readiness

Date: 2026-06-30. Method: truth audit (measured, not claimed). Every number below
was produced by running the actual gate, not read from a doc.

---

## 1. CI GATE STATUS (measured 2026-06-30)

| Repo | Gate | Result |
|------|------|--------|
| stellaris-core | `cargo test` (contracts/stellaris) | **60 passed / 0 failed** |
| stellaris-core | guard WASM `cargo build --release --target wasm32v1-none` | **builds clean** |
| stellaris-apps | `npm test` | **87 passed / 0 failed** (12 suites) |
| stellaris | `bun run build` (docs) | **success**, 13 doc pages |

Source inventory: 19 contract `.rs`, 21 SDK `.ts` (client/src), 16 `.circom`.

Verdict: all build/test gates are GREEN. The code is healthy. The gaps are NOT
in code quality — they are in version control, doc-vs-reality drift, and the
visual/demo surface judges actually score.

---

## 2. CRITICAL FINDINGS (ranked by hackathon impact)

### C1 — Two of three repos are UNVERSIONED (submission-blocking)
- `stellaris-core`: NO git repo. The entire protocol + SDK + contracts is unversioned.
- `stellaris-apps`: NO git repo. The entire showcase monorepo is unversioned.
- `stellaris` (docs): IS a git repo, but on the initial "Create Fumadocs App"
  commit (`345d39a`) with 41 uncommitted files and NO remote.
- Impact: every hackathon (DoraHacks, SCF) requires a public repo link. Right now
  there is nothing pushable for the two repos that contain the actual work.
- Fix: mechanical (`git init` + `.gitignore` + structured commits + remote).
  AWAITING USER OK — standing rule: never touch repo state uninvited.

### C2 — The live testnet deployment is INVISIBLE in the docs (proof-point gap)
- The system is live on Stellar testnet: attestation `CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H`,
  guard `CCXJQ77B5G7PVIOOBCWXVPERD7Q35WKDRU5744G5QA6DQX6TSYWG4OIQ`, with the full
  blocked->attest->allowed mint proven on-chain (tx hashes in TESTNET-E2E-EVIDENCE.md).
- But: `grep` across `content/` and `src/` of the docs site finds ZERO mention of
  these contract IDs or the live deployment.
- Impact: the single most credible thing this project has — a working on-chain
  demo, which most hackathon entries never achieve — is not shown to judges.
- Fix: add a "Live on Testnet" section to the docs homepage + mint-guard page with
  contract IDs, explorer links, and the tx hashes. High ROI, low effort.

### C3 — The judge-facing curve contradiction (FIXED this session)
- JUDGE-QA / DEMO-SCRIPT / PLAN-COMPANION said "BN254 host functions"; the contract
  uses `soroban_sdk::crypto::bls12_381`. Fixed all 5 occurrences; `strategy/` now
  has 0 misleading BN254 matches. Kept here as a closed finding for traceability.

---

## 3. ROADMAP vs REALITY (showcase apps gap)

The `NEXT-SPRINTS-ROADMAP.md` "recommended workspace shape" lists six showcase apps.
Measured reality in `stellaris-apps/apps/`:

| Roadmap-listed app | Exists? |
|--------------------|---------|
| attestation-service | YES (backend) |
| registry-indexer | YES (backend) |
| operator-cli | YES (CLI) |
| issuer-portal | **NO — never built** |
| verifier-dashboard | **NO — never built** |
| rwa-treasury | **NO — never built** |

packages/ (all exist, all tested): common, keypair-signer, manifest-loader, soroban-transport.

Implication: there is NO visual/UI surface. Every existing app is backend/CLI.
For a hackathon "Design" and "Presentation" axis, this is the biggest scoring gap.
The roadmap is honest about intent, but a reviewer comparing the roadmap's diagram
to the repo will see 3 of 6 apps missing. Two options:
  (a) build ONE visual app (verifier-dashboard is highest-leverage — it shows the
      blocked/allowed state a judge can see), or
  (b) trim the roadmap's claimed shape to what exists + mark the visual apps as
      explicitly "planned, not built" so there is no claim/reality gap.

Recommendation: do BOTH — trim the claim now (honesty), build the verifier-dashboard
as the hackathon visual centerpiece (it consumes the already-built guard-status.ts
off-chain mirror, so it is mostly wiring).

---

## 4. WHAT IS GENUINELY STRONG (lead with these)

- Real ZK, not decorative: 60/60 contract tests run the actual BLS12-381 Groth16
  pairing check on real fixtures. The insolvent path is provably rejected on-chain.
- Live testnet proof: blocked -> attest(real proof) -> allowed mint, with tx hashes.
  Most submissions never get here.
- The mint-guard wedge: solvency-gated minting (Chainlink Secure-Mint parity on
  Stellar, with private composition) is a sharper, more defensible story than
  generic proof-of-reserves — and it is research-grounded (Summa post-mortem).
- Honest trust boundary: the C2/C3 custodian/oracle binding story maps cleanly to
  the GENIUS/MiCA management-assertion-vs-CPA boundary. Judges reward honesty here.
- Three-layer architecture (circuits + Soroban contracts + TS SDK + apps) is real
  and tested end to end, not a single-file demo.

---

## 5. PRIORITIZED ACTION LIST (hackathon-critical first)

P0 (blockers — do before any submission):
  1. [USER OK NEEDED] git init core + apps; commit docs; add remotes; push public.
  2. Add "Live on Testnet" content to docs (C2) — contract IDs + explorer + tx hashes.

P1 (scoring leverage — do if time before deadline):
  3. Build the verifier-dashboard visual app (consumes guard-status.ts; the on-camera
     blocked->allowed state for the Design/Presentation axes).
  4. Reconcile roadmap "showcase apps" claim with reality (mark unbuilt apps as planned).
  5. Record a 2-3 min demo video following the (now curve-corrected) DEMO-SCRIPT.

P2 (grant follow-on — after hackathon):
  6. SCF Build Award (Integration track) — the SCF-GRANT-APPLICATION.md draft + the
     live testnet proof + the mint-guard wedge is a strong package.
  7. Multi-party trusted setup ceremony (replaces the single-contributor demo setup).
  8. The guard crate-split is done; next prod step is the custodian/oracle input
     binding (C2/C3) hardening toward a real issuer pilot.

---

## 5b. CROSS-MODEL DEBATE — net-new findings (GPT-5.5, see HACKATHON-DEBATE-GPT55.md)

The debate confirmed C1 (git = BLOCKER) and the no-UI weakness, and surfaced
findings not in the original audit. Verified ones first:

  - [VERIFIED — source read] NO bypass mint path. mint-guard/src/lib.rs exposes
    only `mint` (issuer-auth + full attestation gate) and `set_current_period`
    (issuer-auth) as state-mutating entrypoints. No admin mint, no set_supply,
    no set_balance, no upgrade fn. The guarded mint IS the only issuance path —
    a strong, now-confirmed answer to the judge question "can admin bypass it?"
    This should be stated explicitly in the demo + docs.

  - [GAP] No Soroban cost/feasibility benchmark for attest_v3 (CPU insns, ledger
    read/write, fee, proof size). Judges/SCF will ask. Capture from the live
    testnet txs (already have the tx hashes) before submission.

  - [GAP] Liability completeness is under-stated: the circuit proves
    reserves >= a supplied liabilities scalar; it does not prove the liabilities
    figure is complete (off-chain obligations, pending redemptions). The threat
    model must say this plainly (table form).

  - [POSITIONING] Lead with "Stellar-native issuance control," not generic zk-PoR
    and not "Chainlink Secure-Mint parity" (invites derivative comparison; not a
    Stellar-native reference). Use the regulatory framing ONLY to LIMIT claims
    (threat-model table), never to imply statutory compliance.

  - [SAC GAP] Clarify whether the guarded token is native-Soroban-only vs a SAC
    wrapper vs an attach-to-issuer-mint pattern. A standalone SEP-41 token can
    read as a "toy token" to Stellar judges. Document the SAC/issuer migration path.

  - [SCF] Most likely Integration-track rejection reason is NO named integration
    partner — not a technical gap. Secure an LOI / design partner / pilot issuer
    before applying, or frame the ask as Developer-Tooling/R&D and ask for less.

## 6. VERDICT

Status: CODE is hackathon-ready (all gates green, real on-chain proof, no bypass
mint path confirmed by source). The project is NOT submission-ready yet, for two
mechanical/visible reasons, both fixable fast:
  - version control (C1) — nothing is pushable for 2 of 3 repos [USER OK NEEDED], and
  - the live deployment was invisible in the docs (C2) — FIXED this pass:
    content/docs/live-on-testnet.mdx added + wired to nav, docs build clean.

Neither was a code problem. With git done (C1) and one visual app, this is a
strong, honest, technically-real hackathon entry with a clear SCF grant follow-on.
The single highest-leverage remaining build item is ONE polished demo app showing
blocked -> attest -> allowed; the single highest-leverage SCF item is a named
issuer/custodian pilot partner.
