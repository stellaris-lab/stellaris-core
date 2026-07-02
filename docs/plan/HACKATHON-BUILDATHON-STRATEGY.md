# Stellaris — Hackathon + Buildathon Strategy (Dual-Track)

Status: living strategy. Authoritative for GO-TO-MARKET sequencing. For build
status the CHANGELOG wins; for protocol intent NEXT-SPRINTS-ROADMAP.md wins.
This doc connects the verified technical baseline to two funding/visibility
tracks: a hackathon as the near-term proof point, and the Stellar Community Fund
(SCF) Build Award as the follow-on funding path.

Date of synthesis: 2026-06-29.

---

## 0. The one-sentence pitch (use everywhere, verbatim)

> Stellaris is solvency-gated minting infrastructure for Stellar RWA and
> stablecoin issuers: a Soroban token that refuses to mint beyond a fresh,
> privacy-preserving on-chain solvency proof for the period.

The mint-guard is the wedge. The attestation protocol is the capability beneath
it. Lead with the guard, because "your token cannot over-issue past its proven
reserves" is a thing the market already buys (Chainlink Secure-Mint parity),
whereas "a proof-of-reserves SDK" is a thing the market already ignored (Summa).

---

## 1. Verified technical baseline (what we can claim without lying)

These are confirmed by code + a live testnet run, not aspiration:

- Real Circom circuit + Groth16/BLS12-381 trusted setup; snarkjs-verified proofs
  in `fixtures/`. The on-chain verification is the REAL Soroban
  `crypto::bls12_381` pairing check (NOT BN254 — earlier docs that said BN254
  were corrected 2026-06-29; the curve is BLS12-381 across circuit, contract, SDK).
- Attestation contract verifies real proofs on-chain; v1/v2/v3 statements
  (v3 = multi-asset, oracle-priced aggregate solvency with per-asset flags).
- SolvencyGatedToken (mint-guard): a SEP-41-shaped Soroban token whose `mint`
  fails CLOSED unless a fresh, solvent v3 attestation exists for the period.
- LIVE ON STELLAR TESTNET (2026-06-29), proven end to end with tx hashes:
  - attestation contract: CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H
  - guard (SolvencyGatedToken): CCXJQ77B5G7PVIOOBCWXVPERD7Q35WKDRU5744G5QA6DQX6TSYWG4OIQ
  - sequence: mint BLOCKED (NoAttestation) -> attest_v3 (real Groth16 proof
    accepted by the on-chain pairing check) -> same mint ALLOWED, supply=2,000,000.
  - evidence: docs/plan/TESTNET-E2E-EVIDENCE.md.
- Three-repo split: stellaris-core (protocol/SDK/contracts), stellaris (docs),
  stellaris-apps (integration showcase).

### The honest boundary (state it before a judge asks)

Stellaris proves arithmetic + non-negativity over SUPPLIED reserve inputs. It
does not independently prove those inputs match real, exclusively-controlled
assets. C2 (custodian BLS signature) and C3 (oracle price commitment) are the
on-chain input-attestation hooks that close this gap; full closure needs a
custodian/oracle integration. This is the SAME boundary regulators draw between
a management assertion and a CPA examination (GENIUS/MiCA). Framing the limit as
a regulatory-aligned trust boundary turns the weakness into positioning.

---

## 2. Why dual-track (hackathon -> buildathon/SCF)

- A hackathon forces a crisp, judged, time-boxed PROOF POINT and a public repo.
  It produces exactly the artifacts SCF reviewers want to see: a working demo,
  on-chain evidence, and an honest scope statement.
- SCF Build Award is the FUNDING path (up to $150k XLM, milestone-based, 3-5mo
  to mainnet, Audit Bank for eligible teams). It rewards traction + a credible
  roadmap — which the hackathon win/demo supplies.
- The Summa lesson (EF-funded, cryptographically superior zk-PoR that died of
  non-adoption) says: distribution + a concrete integration beats polish. The
  hackathon is distribution rehearsal; SCF is the distribution engine.

Sequence: WIN/SHIP the hackathon with the mint-guard demo -> convert the same
artifacts into an SCF Build submission (Integration or Open track) within the
same quarter.

---

## 3. Track A — Hackathon (near-term proof point)

### 3.1 Target

DoraHacks-style Stellar hackathon (recurring; judging axes: Technical
Implementation, Creativity, Design, Adoption/Market, Presentation). The existing
docs/strategy/JUDGE-QA.md is already structured around these axes.

### 3.2 The demo (4 minutes, rehearsed)

1. [0:00-0:30] Problem: issuers must prove solvency without leaking the balance
   sheet; post-FTX this is table stakes; current PoR is an off-chain PDF.
2. [0:30-1:00] The guard: show a Soroban token whose mint() is gated. Attempt a
   mint -> it REVERTS with NoAttestation. "The token cannot over-issue."
3. [1:00-2:30] The proof: generate a Groth16 multi-asset solvency proof
   client-side (no balances leave the machine); submit attest_v3; show the
   on-chain pairing check ACCEPT it (AttestationRecordedV3, aggregate_solvent).
   Show the testnet explorer link (real tx hash).
4. [2:30-3:15] The flip: re-run the identical mint -> it now SUCCEEDS;
   total_supply moves to 2,000,000. Blocked -> proven -> allowed, live.
5. [3:15-4:00] Honest boundary + roadmap: C2/C3 input binding, multi-party
   ceremony, mainnet pilot. Tie to GENIUS/MiCA. "Here is the production path."

The differentiator beat is step 4: the SAME mint that failed now works, gated by
a real ZK proof, on a public ledger. That is the 15-second clip.

### 3.3 Judging-axis mapping

- Technical: real BLS12-381 Groth16 verified on-chain; cross-contract guard read;
  live testnet txs. Not a mock.
- Creativity: solvency-GATED MINTING (enforcement) rather than passive PoR
  (reporting). Chainlink Secure-Mint parity, Stellar-native, privacy-preserving.
- Design: institutional-fintech visual system; blocked->allowed mint card.
- Adoption/Market: Stellar's named core customers (stablecoin/RWA issuers);
  $3B+ Stellar RWA; GENIUS/MiCA monthly-attestation mandates.
- Presentation: one-sentence pitch; honest boundary; live evidence; clear roadmap.

### 3.4 Submission checklist (hard requirements first)

- [ ] PUBLIC GIT REPO(S) with a clear README (BLOCKER — see section 5).
- [ ] Live testnet contract IDs + tx links in the README and docs.
- [ ] 4-min demo video following docs/strategy/DEMO-SCRIPT.md.
- [ ] One-paragraph honest-limitations statement (already drafted).
- [ ] Reviewer quickstart: how to run the demo / read the chain.
- [ ] Architecture diagram (issuer -> prover -> SDK -> contract -> guard).

---

## 4. Track B — Buildathon / SCF Build Award (funding follow-on)

### 4.1 Which SCF track

- Integration Track — best fit IF we can show traction (the hackathon
  result + live testnet + any design-partner interest counts). Integration also
  fits because the guard INTEGRATES into issuers' existing token stacks.
- Open Track — fallback; "brand-new protocol primitive on Stellar." Goes to
  community vote (Neural Quorum Governance), so it rewards a strong public story.
- RFP Track — only if a published Q2/Q3 RFP matches. Current Q2 RFPs lean
  smart-account / contract-verification / agent-readiness; mint-guard is not a
  direct RFP match today, so do NOT force it. Watch new quarterly RFPs.

Recommended: signal Integration interest now (rolling), with Open as fallback.

### 4.2 What SCF reviewers weight (and our answer)

- Ecosystem value: solvency-gated minting is reusable infrastructure for every
  Stellar stablecoin/RWA issuer, not a single app.
- Technical feasibility: already live on testnet; the hard ZK + on-chain
  verification is DONE, not promised.
- Roadmap clarity: see PRODUCTIONIZATION-ROADMAP.md (freeze -> testnet pilot ->
  trust-input binding -> security review -> mainnet pilot) with milestone gates.
- Team capability: shipped a real ZK protocol + live testnet e2e solo.

### 4.3 SCF milestone plan (maps to tranches)

- M1 (weeks 1-4): protocol freeze (ABI/manifest/VK hash) + public repo + audited
  test suite + 1 design-partner conversation. Deliverable: frozen v3 spec tag.
- M2 (weeks 5-9): custodian (C2) + oracle (C3) binding productionized; a real
  issuer fixture wired end to end; KMS/HSM signer abstraction.
- M3 (weeks 10-14): security review prep (threat model -> adversarial tests
  mapped), Audit Bank engagement, mainnet-pilot runbook.
- M4 (weeks 15-18): limited mainnet pilot with 1 issuer; public status page;
  incident-response + monitoring.

Pre-existing assets: docs/plan/SCF-GRANT-APPLICATION.md (draft),
REGULATORY-TRUST-BOUNDARY.md (GENIUS/MiCA mapping), PRODUCTIONIZATION-ROADMAP.md.

---

## 5. Blockers and must-fixes (ordered)

1. CRITICAL — VERSION CONTROL. stellaris-core and stellaris-apps have NO git
   repo (entire protocol+SDK+apps unversioned). stellaris (docs) is a git repo
   on the initial Fumadocs commit with ~41 uncommitted files and no remote. No
   hackathon or SCF submission can link a public repo until this is fixed. This
   is mechanical but requires the user's explicit OK before any git init / commit
   / remote (standing rule: never touch repo state uninvited).
2. FIXED (2026-06-29) — BN254 vs BLS12-381 contradiction in judge-facing docs
   (JUDGE-QA, DEMO-SCRIPT, PLAN-COMPANION). Corrected to BLS12-381 to match code.
3. Docs content gap — the docs site does not yet surface the LIVE testnet
   deployment (contract IDs, tx links). Reviewers reward live evidence; add a
   "Live on Testnet" page/section citing TESTNET-E2E-EVIDENCE.md.
4. Standalone guard deployability — RESOLVED via the crate split; the guard ships
   as its own WASM. Keep this visible as a completed productionization item.

(Audit subagents are measuring exact test counts, lint/build status, and app
inventory; their numbers will be folded into the consolidated findings doc.)

---

## 6. Immediate action list (what to do next, in order)

1. [USER OK NEEDED] Initialize git for stellaris-core + stellaris-apps; commit
   the docs repo's 41 files; add remotes; push. Public repo is the gate.
2. Add a "Live on Testnet" docs section with the two contract IDs + tx links.
3. Record the 4-minute demo video per DEMO-SCRIPT.md (now BLS12-381-correct).
4. Signal SCF Integration-track interest (rolling) with the live demo as traction.
5. Finalize the consolidated audit-findings doc once subagent numbers land.
6. Run the cross-model debate on positioning + the M1-M4 milestone plan before
   committing the SCF submission.

---

## 7. What NOT to do (anti-patterns from the evidence)

- Do not lead with "privacy-preserving proof-of-reserves SDK." That is the Summa
  framing that died. Lead with the mint-guard enforcement primitive.
- Do not hide the input-trust boundary. State it first; frame it as the
  GENIUS/MiCA management-assertion-vs-CPA line. Honesty is a credibility asset.
- Do not force an RFP-track fit that does not exist. Integration/Open are the fit.
- Do not claim "audited" or "production-ready." Claim "live on testnet, honest
  production roadmap, Audit Bank next."
