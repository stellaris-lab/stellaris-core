# Stellaris — Stellar Community Fund Application + GTM Wedge

Status: DRAFT for user review. Submission is user-gated (needs an SCF account,
a public repo URL, and the user's go-ahead). This document is the application
narrative + the go-to-market wedge it encodes. Evidence sources are the same
research base captured in `NEXT-SPRINTS-DEBATE-RESEARCH.md` (2026-06-29).

---

## 0. Why SCF, and why now (the distribution lever)

The research debate's single most important finding: Summa — an
Ethereum-Foundation-funded, cryptographically superior zk Proof-of-Solvency
protocol — was SUNSET because of non-adoption, not bad cryptography. Their
retrospective: "treated as a research project rather than a product",
"build it and they will come assumption failed", "custodians lacked incentive".

The correction is to lead with a funded distribution path and one real
integration, not with polish. The Stellar Community Fund is the most concrete
non-dilutive lever available: awards up to $150k worth of XLM, rounds every 4
weeks, explicitly for developers building on Soroban (SDF $100M Soroban adoption
fund context). This document frames Stellaris for exactly that.

---

## 1. One-paragraph pitch

Stellaris is solvency-gated minting infrastructure for Stellar RWA and stablecoin
issuers. An issuer's Soroban token refuses to mint beyond a fresh, privacy-
preserving zero-knowledge solvency attestation — the Stellar-native analogue of
Chainlink's "Secure Mint", but with private reserve composition and multi-asset
priced solvency. It turns a passive proof-of-reserves into an on-chain
enforcement primitive that blocks over-issuance in code, between the monthly CPA
attestations that GENIUS/MiCA already require.

---

## 2. The problem (specific, not generic)

- Stellar's on-chain RWA market is > $3B (≈300% surge from early 2025), with
  named issuers minting on Soroban today: Franklin Templeton BENJI (~$654M),
  Spiko (>$1B), Circle USDC/EURC, MoneyGram MGUSD, Figure YLDS.
- GENIUS Act (US) and MiCA (EU) now mandate frequent reserve attestation
  (monthly CPA examination under GENIUS; six-month audit under MiCA) and strict
  1:1 backing at all times.
- Between those periodic attestations there is no continuous, cryptographic,
  on-chain check that issuance has not outrun reserves. Manual attestations are
  delayed and opaque; the "infinite mint" failure mode is real.
- Existing on-chain PoR (Chainlink) publishes a reserve FIGURE and gates minting
  on it — but it does not preserve reserve composition privacy, and it is not
  Soroban-native for the Stellar issuer base.

## 3. The wedge (what we build, narrowly)

A reference SEP-41 Soroban token whose `mint` path is gated by a fresh, solvent
Stellaris attestation for the current reporting period. Fail-closed on: no
attestation, stale period, stale age, non-solvent, or (configurable) missing
oracle/custodian binding. One persona first: a Soroban tokenized-fund or
stablecoin issuer who already mints on Stellar and now faces reserve-transparency
pressure.

This is deliberately NOT "PoR for exchanges" (Summa's graveyard) and NOT a broad
exchange/custodian/auditor platform. It is one enforcement primitive for one
funded market.

## 4. Differentiation (honest, three concrete points)

1. Private reserve COMPOSITION. Chainlink publishes a figure; Bitso proves
   solvency on Ethereum. Stellaris proves multi-asset priced solvency
   (`sum_a price[a]*reserve[a] >= sum_a price[a]*liab[a]`) while revealing
   neither per-asset balances nor composition — the v3 circuit already does this
   (one asset can be individually underwater while the priced aggregate stays
   solvent, proven without disclosure).
2. Stellar/Soroban-native mint-guard. The enforcement lives in the issuer's own
   Soroban token via a cross-contract read — no external oracle network
   dependency for the solvency verdict itself.
3. Explicit trust-boundary bindings. C2 (custodian BLS signature over the
   reserve commitment, verified on-chain via the pairing host function) and C3
   (designated-oracle price commitment) map to the GENIUS/MiCA boundary between
   management assertion and independent examination — see
   `REGULATORY-TRUST-BOUNDARY.md`.

## 5. What already works (proof of execution, not promises)

- Real Groth16/BLS12-381 trusted setup + circuits (v1 single-asset, v2
  SNARK-proven liabilities, v3 multi-asset priced solvency).
- Soroban contract verifying REAL proofs on-chain through the pairing check;
  C2 custodian BLS + C3 oracle binding implemented and tested.
- Mint-guard vertical slice: `SolvencyGatedToken` with a real two-contract
  end-to-end test — mint blocked with no/stale attestation, allowed after a real
  solvent v3 proof is recorded. Verified 60/60 contract tests, clean
  26.8 KB attestation WASM.
- TypeScript SDK + integration monorepo (transport, signer, manifest loader,
  attestation service, registry indexer, operator CLI): 76/76 tests.
- Documentation website (Fumadocs) building clean.

## 6. What the grant funds (milestones, deliverable-based)

M1 — Standalone deployable guard + testnet e2e.
  Crate-split the guard into its own deployable WASM; deploy attestation + guard
  to Stellar testnet; demonstrate blocked-then-allowed mint with real tx hashes
  and explorer links.

M2 — Issuer integration kit.
  A <30-minute "add solvency-gated minting to your existing SEP-41 token"
  integration path: SDK recipe, reference token, migration notes, SAC-adapter
  note for classic assets.

M3 — Trust-binding production hardening.
  Production custodian (C2) and oracle (C3) binding flows; verification-key +
  manifest + artifact hash publication; KMS/HSM signer abstraction.

M4 — Design-partner pilot.
  Onboard one Stellar RWA/stablecoin issuer (BENJI/Spiko-class outreach) against
  a synthetic fixture first, then live testnet, with a published trust-boundary
  statement mapped to GENIUS/MiCA.

## 7. Milestone acceptance (what "done" means)

- M1: a public testnet transaction that REVERTS on over-mint and SUCCEEDS after
  re-attestation, both linked on a block explorer.
- M2: an external developer integrates the guard into a fresh SEP-41 token in
  under 30 minutes following only the published docs.
- M3: published VK/manifest/artifact hashes; a custodian-bound and an
  oracle-bound attestation demonstrated on testnet.
- M4: a signed design-partner statement + a public pilot writeup.

## 8. Budget framing (for the user to set)

SCF awards up to $150k worth of XLM per round. Suggested split to be set by the
user: M1 + M2 are the credibility-and-adoption core (recommend the majority of
the request); M3 + M4 are hardening + pilot. Keep the ask proportional to the
milestones; do not pad.

## 9. Risks and honest unknowns

- Adoption is the real risk (the Summa lesson). M4's design-partner pilot is the
  test, not an assumption — if no issuer engages against a working testnet demo,
  that is the signal to re-scope.
- The standalone guard WASM (M1 crate-split) is real remaining engineering, not
  done today; the current guard is proven on the host target only.
- Stellaris is a COMPLEMENT to CPA attestation, not a replacement; the grant
  narrative must not overclaim regulatory sufficiency.
- Trusted setup is currently single-contributor (demo); a production ceremony is
  out of grant scope and must be disclosed.

## 10. User action items before submission

1. Confirm the wedge framing (solvency-gated minting for Stellar RWA/stablecoin
   issuers) is the public positioning.
2. Provide the public GitHub org/repo URL (replaces the placeholder
   `stellaris-protocol/stellaris`).
3. Decide the budget split across M1-M4.
4. Confirm whether to pursue a named design partner now or after M1's testnet
   demo (recommended: after).
5. Create/confirm the SCF account and target round; give go-ahead to submit.
