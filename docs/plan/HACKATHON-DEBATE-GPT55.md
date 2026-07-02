# Cross-Model Debate — Hackathon + Buildathon Strategy (GPT-5.5 review)

Reviewer: GPT-5.5 via 9Router-Proxy, prompted as a ruthless Stellar-hackathon /
SCF reviewer. Date: 2026-06-30. Full prompt: `build/tmp/debate-hackathon.txt`.

This is an ADVERSARIAL review of the dual-track strategy
(`HACKATHON-BUILDATHON-STRATEGY.md`). It is recorded verbatim-in-summary so the
findings can be tracked. Severity tags are the reviewer's.

## Findings that CONFIRM our own audit (independent agreement)

- **BLOCKER — core/apps not in git.** Matches AUDIT-FINDINGS C1. No public repo =
  not submittable; SCF milestone review needs auditable history. Fix: init repos,
  commit deployed source + VK + circuits + SDK + scripts, tag
  `hackathon-submission-v0.1`, add `DEPLOYMENTS.md`, licenses, CI running the
  60/60 + 87/87 suites.
- **BLOCKER/near-fatal — no visual UI.** Matches AUDIT-FINDINGS C-apps. CLI + tx
  hashes satisfy protocol reviewers, NOT hackathon Design/Presentation axes. Fix:
  build ONE polished demo app (attestation status + blocked-mint + submit-proof +
  allowed-mint + explorer links), not three. "Three-app roadmap is scope poison."
- **MAJOR — roadmap overclaims 3 nonexistent apps.** Matches our roadmap-reconcile
  fix. "Judges punish vapor UI." Demote issuer-portal/verifier-dashboard/
  rwa-treasury to buildathon/future.
- **MAJOR — trusted setup is single-contributor.** Already disclosed in JUDGE-QA;
  reviewer agrees it must stay explicitly labeled "demo proving key" + a buildathon
  ceremony milestone.
- **MAJOR — GENIUS/MiCA framing can backfire** if it sounds like compliance
  cosplay. Use a threat-model table; never imply statutory compliance.

## NET-NEW findings we had NOT flagged (the valuable part)

- **BLOCKER (SCF) — no committed integration partner.** The most likely SCF
  Integration rejection is not technical: "interesting prototype, no evidence a
  real Stellar issuer/anchor/RWA/custodian will integrate." Fix: secure a named
  testnet design partner or LOI BEFORE applying; structure M3 as a concrete pilot.
  If none, apply as Developer Tooling/R&D for a smaller ask, not Integration.
- **MAJOR — bypass-mint-path proof.** A "blocked mint" demo is weak if the token
  admin can mint through ANOTHER path. Must show (code + docs) the guarded mint is
  the ONLY mint path, and admin cannot bypass attestation — or disclose it as
  demo-only and fix it. This is critical and currently unaddressed.
- **MAJOR — liability completeness.** PoR is meaningless if the issuer can omit
  liabilities (off-chain obligations, pending redemptions, encumbrances). The
  circuit proves `reserves >= committed liabilities`; it does NOT prove the
  liability figure is complete. Most dangerous overlooked judge question:
  "how do I know all liabilities are included AND the issuer can't mint another way?"
- **MAJOR — SAC / native-asset integration story.** A standalone SEP-41-shaped
  Soroban token can look like a "toy token" isolated from Stellar's real asset
  graph (classic assets, SAC, anchors, SEP standards). Need an explicit answer:
  native Soroban token only / SAC wrapper / attachable issuer-mint pattern — plus
  a migration path for SCF.
- **MAJOR — admin & upgrade trust model.** If an admin can swap the attestation
  contract, rotate VK, change freshness windows, or upgrade the guard, the
  guarantee is weak. Publish the admin model: who owns/ mints / sets config /
  rotates keys; timelock/multisig; whether upgrades are disabled/controlled.
- **MAJOR — Soroban economic feasibility.** Judges/SCF will ask what `attest_v3`
  COSTS: CPU instructions, ledger read/write counts, testnet fee, proof size,
  verification time, storage footprint. We have none of these numbers yet. Get
  them before submission — it's a concrete strength if cheap.
- **MAJOR — freshness semantics must be unambiguous.** Define exactly what a
  "period" is (ledger seq vs timestamp bucket vs epoch), who may attest, whether
  backdating is possible, one-attestation-per-issuer-per-period, replay across
  periods, and VK scope (issuer/asset/global).
- **MAJOR — asset valuation / haircuts (v3 multi-asset).** Multi-asset reserves
  need approved-asset list, price source, decimals, haircuts, staleness threshold,
  FX rules. A basket can be solvent under one price source and insolvent under
  another.
- **MINOR — "Chainlink Secure Mint parity" is risky positioning.** Invites
  comparison to a much larger product and reads as derivative; not a Stellar-native
  reference. Use sparingly; lead with "Stellar-native issuance control."
- **MAJOR — demo failure mode must be rehearsed + deterministic.** Live testnet
  demos fail (RPC lag, sequence races — we already hit these). Prepare a recorded
  90s video + static tx links + seeded accounts + CLI fallback reading already-
  confirmed txs.
- **MAJOR — verifier/explorer story, not just issuer.** A mint gate helps adoption
  only if external users can SEE current attestation state. Add a public verifier
  card (asset, issuer, period, last attestation, solvent y/n, fresh-until, supply,
  gate-active) — can live in the same single demo app.

## How this changes the plan

1. The single demo app (C-apps fix) should include BOTH an issuer panel (blocked->
   attest->allowed) AND a public verifier card — kills two MAJORs with one app.
2. Add a "what we do NOT prove" threat-model TABLE (not prose) to docs +
   submission: arithmetic solvency YES, freshness YES, mint-gate YES; custodian
   holds assets NO, prices correct NO, liabilities complete PARTIAL. (Extends the
   existing REGULATORY-TRUST-BOUNDARY doc into a crisp table.)
3. Add a bypass-path proof + admin-model section to the contract docs — this is a
   correctness claim, gettable today by reading the guard source.
4. Add a Soroban cost-benchmark capture step (run `attest_v3` with `--cost` / read
   the resource metering) before submission.
5. SCF: do not apply Integration without a named partner; otherwise frame as
   Developer Tooling / Open track with a smaller ask and a partner-acquisition M1.
6. Demote the three unbuilt apps everywhere (done in roadmap; mirror in any pitch).

## What the reviewer got slightly wrong / needs our context

- It assumed "no real testnet" in one place then corrected — we DO have a live
  deployment (see LIVE-ON-TESTNET). That strengthens M1 and the demo materially;
  the debate's "blocked mint must prove no alternate path" still stands and is the
  top correctness item to verify next.
