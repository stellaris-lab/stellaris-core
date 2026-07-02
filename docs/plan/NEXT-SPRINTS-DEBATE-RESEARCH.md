# Stellaris Next-Sprints Debate — Research-Grounded Revision

This document supersedes the reasoning-only debate in `NEXT-SPRINTS-DEBATE.md`.
Every major claim here is anchored to external evidence gathered on 2026-06-29
(competitive landscape, Stellar market data, and the US/EU regulatory regime).
The headline conclusion changed materially once real evidence was applied.

---

## 0. Why this revision exists

The first debate was an internal stress-test with no external grounding. It
optimized sprint *ordering* but never asked the only question that decides
whether Stellaris lives: **do issuers have any incentive to adopt it, and what
does the incumbent already give them for free?**

Researching that question flipped the plan's center of gravity from
"documentation + demo polish" to "distribution wedge + mint-guard integration +
regulatory framing." The evidence below explains why.

---

## 1. Evidence base (sources and what each one proves)

### E1 — Summa (PSE / Ethereum Foundation) is SUNSET. Adoption killed it, not crypto.
- PSE project page: status **Inactive** — "This project has been sunset and is
  not actively worked on anymore." (pse.dev/en/projects/summa)
- Retrospective (mirror.xyz/privacy-scaling-explorations.eth): Summa was a
  technically deep zk Proof-of-Solvency protocol (Halo2 -> univariate sumcheck +
  amortized KZG for ~10M users -> HyperPlonk), EF-funded, and it still stopped.
- Stated causes, in their words:
  - "Treated as a research project rather than a product; premature UX focus;
    'build it and they will come' assumption failed."
  - "Custodians lacked incentive due to low customer demand for transparency."
  - The problems it solved "were only one small part of a much larger problem
    space" — missing offchain asset verification, dispute resolution, and zk
    address-ownership.
- **Lesson for Stellaris:** the binding constraint is distribution and issuer
  incentive, NOT proof performance or docs quality. A better-documented Summa
  would still be dead. This is the single most important input to sprint order.

### E2 — Chainlink Proof of Reserve is the incumbent, and its product is "Secure Mint", not attestation.
- chain.link/proof-of-reserve and blog.chain.link/secure-mint: Chainlink PoR is
  wired *into the token's mint function* as a circuit breaker —
  `totalSupply() + amountToMint <= attestedReserves()` — so an issuer "cannot
  mint beyond verified reserves" and "infinite mint attacks" are blocked in code.
- Customer logos: Backed, 21.co, Bedrock, Wenia/Bancolombia; integrations across
  Aave, Lido, ether.fi. December 2025 institutional tokenization report frames
  PoR + composition + compliance as the minting gate.
- **Lesson for Stellaris:** standalone "here is an attestation" is commoditized.
  The defensible product is the **mint/issuance guard**: a Soroban token whose
  mint path refuses to exceed a fresh Stellaris solvency attestation. That is a
  feature Stellaris does not yet have and Chainlink sells as the headline.

### E3 — Privacy-preserving zk-PoR is already in production (Bitso).
- bitso.com/proof-that-matters: Bitso publishes a zk-SNARK proof of solvency to
  an Ethereum smart contract, explicitly pairing reserves + liabilities while
  preserving customer privacy.
- **Lesson for Stellaris:** "zk + privacy" is not, by itself, a differentiator.
  Differentiation must come from (a) Stellar/Soroban-native issuance integration,
  (b) the mint-guard, and (c) multi-asset RWA priced solvency (the existing v3
  circuit) — not from the novelty of using a SNARK.

### E4 — Stellar is a large, specific, growing RWA/stablecoin market.
- Stellar on-chain RWA market cap > $3B, ~300% surge from early 2025
  (cryptobriefing.com, 2026-06-25). Earlier checkpoint: RWAs +22% to $2.83B,
  monthly transfer volume +155% to >$672M (coinmarketcap, 2026-06-18).
- Named issuers/assets: Franklin Templeton BENJI (~$654M), Spiko (>$1B), Circle
  USDC + EURC, MGUSD (MoneyGram, launched 2026-06-02), Figure YLDS.
- Infrastructure tailwinds: DTCC closed testnet for tokenizing US assets;
  Protocol 23 "Whisk" parallel Soroban execution; SDF $100M Soroban adoption
  fund; Stellar Community Fund grants up to $150k every 4 weeks.
- **Lesson for Stellaris:** the beachhead is not "CEX proof of reserves" (Summa's
  graveyard) — it is **Stellar-native RWA + stablecoin issuers** who already mint
  on Soroban and now face reserve-transparency pressure. Target BENJI/Spiko-class
  tokenized-fund issuers, not Binance.

### E5 — GENIUS Act (US) + MiCA (EU) mandate frequent reserve attestation.
- GENIUS Act: strict 1:1 reserves at all times; **monthly** reserve-composition
  disclosure examined by a registered public accounting firm; CEO/CFO personal
  certification; annual PCAOB audit (federalregister.gov 2026-04-10; spark.money;
  tokenizationcompliance.com).
- MiCA: 1:1 backing; ART reserves audited every six months; results published
  within three months; in force since Jan 2025 (esma.europa.eu).
- **Lesson for Stellaris:** position as a **cryptographic supplement that runs
  between the monthly CPA attestations** — continuous, on-chain, privacy-
  preserving freshness signal — NOT a replacement for the auditor. The honest
  "proves arithmetic over supplied inputs, not bank truth" limitation maps
  exactly onto "the CPA still certifies the inputs; Stellaris makes the in-between
  continuously verifiable." Regulation is a tailwind, but only if framed as
  complement.

---

## 2. The eight perspectives, re-argued against the evidence

### P1 — Protocol Architect
- Original stance: seam/ABI hygiene, freeze public signals, version tags.
- Evidence update (E2): the architecture is missing the one load-bearing
  integration the market actually buys — a **mint-guard entrypoint**. The v3
  multi-asset priced-solvency circuit (already built) is the right primitive for
  RWA, but nothing consumes the attestation at mint time.
- Revised position: add a reference **SEP-41/SAC token wrapper** whose `mint`
  reads the latest Stellaris attestation for the period and reverts if stale or
  insolvent. This is the architectural centerpiece, not a nice-to-have.

### P2 — Product Strategist
- Original stance: institutional-fintech positioning, issuer/verifier personas.
- Evidence update (E1, E4): "proof of reserves for exchanges" is a proven dead
  end; "RWA/stablecoin issuance integrity on Stellar" is a live, funded market.
- Revised position: narrow the wedge hard — **"Solvency-gated minting for Stellar
  RWA and stablecoin issuers, with private reserve composition."** One persona
  first: a Soroban tokenized-fund/stablecoin issuer. Drop the broad
  exchange/custodian/auditor fan-out from the front of the plan.

### P3 — Developer Experience Lead
- Original stance: SDK quickstart, examples, typed errors.
- Evidence update (E2): the highest-leverage example is not "issuer portal UI" —
  it is a **10-line mint-guard integration snippet** that an issuer drops into an
  existing Soroban token. DX should optimize for "embed in my existing token in
  an afternoon."
- Revised position: lead SDK docs with the mint-guard integration recipe; the
  portal UI is secondary.

### P4 — Security Reviewer
- Original stance: trusted-setup, input-truth gap, key management.
- Evidence update (E5): the input-truth gap is not a weakness to hide — it is the
  **exact boundary regulators already draw** between management assertion and CPA
  examination. Frame C2 (custodian BLS signature) and C3 (oracle price commitment)
  as the on-chain analogues of "independent input attestation."
- Revised position: ship a one-page "Trust Boundary vs GENIUS/MiCA" mapping that
  shows precisely which regulatory requirement each component supports and which
  it explicitly does NOT. This converts the limitation into a credibility asset.

### P5 — Demo / Launch Lead
- Original stance: short demo, screenshots, video.
- Evidence update (E2, E4): the demo that lands is **"watch a mint get blocked"**
  — attempt to mint beyond attested reserves on testnet and show the transaction
  revert, then top up reserves, re-attest, and watch the same mint succeed. That
  is visceral and maps to Chainlink's own headline.
- Revised position: the canonical demo is the mint-guard circuit-breaker, not a
  dashboard tour.

### P6 — Engineering Manager
- Original stance: sequencing, scope realism.
- Evidence update (E1): the program's risk is building a polished, well-documented
  artifact nobody adopts — i.e. re-running Summa with better docs. Sequencing must
  front-load a single real integration target and a grant/distribution path (SCF).
- Revised position: cut WIP. One vertical slice — issuer mints, guard blocks,
  re-attest, guard passes — end to end on testnet, before any breadth.

### P7 — Go-To-Market Reviewer
- Original stance: persona pages, competitor comparison.
- Evidence update (E4): there is concrete, non-dilutive distribution — **Stellar
  Community Fund grants up to $150k every 4 weeks** and the $100M Soroban adoption
  fund. GTM should target an SCF submission, not abstract "investor demo."
- Revised position: the GTM artifact that matters first is an **SCF application**
  framing Stellaris as solvency-gated minting infrastructure for the $3B+ Stellar
  RWA market, with the mint-guard demo as proof.

### P8 — Skeptical External Auditor
- Original stance: "is any of this verified end to end?"
- Evidence update (E3): privacy zk-PoR exists in production elsewhere, so reviewers
  will not be impressed by the SNARK alone; they will ask "what does this do on
  Stellar that Chainlink PoR + a CPA attestation does not?"
- Revised position: the defensible answer must be concrete and demonstrated:
  (1) private reserve *composition* (Chainlink publishes a figure, not a private
  multi-asset proof), (2) Stellar/Soroban-native mint-guard, (3) per-asset +
  aggregate priced solvency from the v3 circuit. If those three are not shown
  running, the project reads as "another zk-PoR."

---

## 3. What changed in the plan (delta vs the reasoning-only debate)

| Area | Old plan | Research-grounded revision | Driver |
|---|---|---|---|
| Core wedge | Generic privacy zk-PoR SDK | Solvency-gated **minting** for Stellar RWA/stablecoin issuers | E2, E4 |
| Missing primitive | (none flagged) | **Mint-guard token wrapper** (SEP-41/SAC) consuming attestations | E2 |
| Sprint order | Polish docs/demo first | Distribution + one real integration first | E1 |
| Limitation framing | "Honest caveat to disclose" | "Regulatory trust-boundary asset" mapped to GENIUS/MiCA | E5 |
| Canonical demo | Dashboard/portal tour | **Blocked-then-allowed mint** circuit breaker | E2 |
| First GTM artifact | Investor/judge deck | **Stellar Community Fund grant application** | E4 |
| Target persona | Exchange/custodian/auditor fan-out | One Soroban tokenized-fund/stablecoin issuer | E1, E4 |
| Differentiation claim | "zk + privacy" | Private *composition* + Soroban mint-guard + v3 priced multi-asset | E3 |

---

## 4. Revised execution order (evidence-ranked)

The Summa lesson (E1) forces distribution and a real integration ahead of polish.

1. **Sprint A — Mint-guard vertical slice (new, highest priority).**
   Reference SEP-41/SAC token whose mint reverts unless a fresh, solvent Stellaris
   attestation exists for the period. Testnet end-to-end: mint blocked -> re-attest
   -> mint allowed. (Driver: E2, E1, E6.)
2. **Sprint B — Live testnet e2e** (was Sprint 3). Real contract id, real
   attestation, manifest, explorer links — required to make Sprint A demonstrable.
3. **Sprint C — Regulatory trust-boundary doc + security mapping** (elevated
   from Sprint 4). One-page GENIUS/MiCA mapping; C2/C3 framed as input-attestation
   analogues. (Driver: E5, E4.)
4. **Sprint D — SCF grant application + GTM wedge** (elevated from Sprint 6).
   Submit to Stellar Community Fund; narrow persona; mint-guard demo as proof.
   (Driver: E4, E1.)
5. **Sprint E — Documentation productization** (was Sprint 1), now rewritten
   around the mint-guard story and the regulatory framing rather than generic PoR.
6. **Sprint F — Demo/launch package** (was Sprint 9), canonical demo = blocked mint.
7. **Sprint G — SDK DX**, lead with the mint-guard integration recipe.
8. **Sprint H — Showcase apps** (issuer portal, verifier dashboard, RWA treasury),
   now consumers of a proven mint-guard, not standalone mockups.
9. **Sprint I — Visual/brand system.**
10. **Sprint J — Productionization roadmap** (audit, mainnet pilot).

Compared to the prior "public clarity first" recommendation, clarity now comes
*through* a concrete integration and a funded distribution path, because the
evidence says clarity alone is what Summa already had when it died.

---

## 5. Open questions for the user (decision-gated)

1. Confirm the wedge: **solvency-gated minting for Stellar RWA/stablecoin issuers**
   as the single front-of-plan use case? (Recommended: yes.)
2. Is pursuing a **Stellar Community Fund** grant in scope? It reshapes Sprint D
   from "deck" to "application" and is the most concrete distribution lever found.
3. For the mint-guard reference: target a **SAC wrapper over an existing classic
   asset**, or a **fresh SEP-41 Soroban token**? (Recommended: SEP-41 reference +
   SAC adapter note.)
4. Any named design partner among Stellar RWA issuers (BENJI/Spiko-class), or do
   we build against a synthetic issuer fixture first? (Recommended: synthetic
   first, then outreach with the working demo.)

---

## 6. Honesty ledger (what is verified vs asserted here)

- VERIFIED via sources (2026-06-29): Summa sunset + stated causes; Chainlink
  Secure-Mint mechanism; Bitso production zk-PoS; Stellar RWA > $3B and named
  issuers; GENIUS monthly-attestation + MiCA six-month audit requirements.
- ASSERTED (engineering judgment, not externally verified): that a Soroban
  mint-guard is buildable on the existing v3 circuit/contract without an ABI break
  — this needs a spike in Sprint A to confirm (the D1 seam analysis suggests new
  entrypoints may be required, so treat as a design task, not a given).
- NOT verified: whether any specific Stellar issuer will adopt — that is exactly
  what Sprint D's outreach + SCF path is designed to test rather than assume.
