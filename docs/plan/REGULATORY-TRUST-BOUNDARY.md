# Stellaris Trust Boundary vs GENIUS Act / MiCA

Status: reference artifact (research-grounded, 2026-06-29). Intended to become a
public docs page ("Security & Limitations" -> "Regulatory Trust Boundary"). This
document maps each Stellaris protocol component to the exact boundary regulators
already draw between a management assertion and an independent examination, and
states precisely what Stellaris does and does NOT replace.

The framing thesis (from the research-grounded debate, E5): Stellaris is a
*cryptographic supplement that runs between the periodic CPA attestations* — a
continuous, on-chain, privacy-preserving freshness signal — NOT a replacement for
the auditor. The honest limitation "proves arithmetic over supplied inputs, not
bank truth" maps exactly onto the regulatory line "the CPA still certifies the
inputs; Stellaris makes the in-between continuously verifiable."

---

## 1. What the regulations actually require

### GENIUS Act (US) — payment stablecoin issuers (PPSIs)
- Strict 1:1 reserves at all times; no fractional reserve.
- MONTHLY reserve-composition disclosure, published on the issuer's website,
  EXAMINED by a registered public accounting firm.
- CEO/CFO personal certification of accuracy to regulators.
- Annual PCAOB-standard audited financial statements.
- Sources: federalregister.gov 2026-04-10 (FDIC NPRM); spark.money;
  tokenizationcompliance.com.

### MiCA (EU) — asset-referenced / e-money tokens (ARTs/EMTs)
- 1:1 backing; reserve composition constraints (e.g. bank-deposit minimums).
- ART reserves AUDITED every six months; results published within three months.
- In force since Jan 2025. Source: esma.europa.eu.

### The gap both regimes leave open
Both mandate PERIODIC (monthly / six-monthly) independent verification. Between
those points, a holder has only the issuer's word. The reserve can deteriorate
the day after an attestation and no one sees it on-chain until the next cycle.
That inter-attestation window is the gap Stellaris addresses.

---

## 2. The trust boundary, drawn precisely

There are three distinct trust questions for any reserve claim:

  Q1 (arithmetic): given a set of balances, do reserves >= liabilities?
  Q2 (input truth): are those balances the real, complete bank/custody balances?
  Q3 (freshness):   is the verified claim current, or stale?

Regulators assign Q2 to the CPA/auditor (examination of management's assertion).
Stellaris's cryptography answers Q1 and Q3 continuously and privately. Stellaris
does NOT answer Q2 by itself — and says so. C2 (custodian binding) and C3 (oracle
binding) are the on-chain analogues that let a NAMED third party attest to inputs,
narrowing Q2, but they do not replace the CPA's independent examination.

```
                         Q1 arithmetic     Q2 input truth        Q3 freshness
                         (reserves>=liab)  (balances are real)   (claim is current)
  ---------------------- ----------------- --------------------- -----------------
  CPA / auditor          yes (periodic)    YES (the core role)   no (point-in-time)
  Stellaris v1/v2/v3     YES (continuous,  no (by itself)        YES (per-period,
   Groth16 proof          private)                                on-chain ts)
  Stellaris C2 custodian  -                partial: a NAMED      -
   BLS binding                              custodian signed the
                                            reserve commitment
  Stellaris C3 oracle     -                partial: prices bound -
   price binding                            to a designated feed
  Mint-guard (Sprint A)   enforces Q1+Q3 at issuance time: mint reverts unless a fresh,
                          solvent attestation exists for the current period
```

---

## 3. Component-by-component regulatory mapping

### C1 — multi-asset solvency with oracle-priced aggregate (por_v3, 8 signals)
- Regulatory support: provides continuous, privacy-preserving evidence for the
  1:1 (>=1:1) reserve requirement BETWEEN periodic attestations, including the
  multi-asset case where the reserve basket is priced (Treasuries, cash, MMFs).
- Does NOT support: the GENIUS reserve-composition *disclosure* itself (that is a
  public CPA-examined report). Stellaris keeps composition PRIVATE by design; it
  proves the aggregate inequality, not the public breakdown the regulation wants
  published monthly. These are complementary, not substitutes.
- Honest scope: proves the aggregate was computed with the COMMITTED prices and
  balances — not that the prices or balances are independently real (-> C2/C3).

### C2 — custodian BLS-signed reserve attestation (attest_v3_signed)
- Regulatory support: narrows Q2 on the RESERVE side. A designated custodian
  (the bank/exchange holding the assets) signs the reserve commitment with a real
  BLS12-381 key, verified on-chain. This is the cryptographic analogue of "an
  independent party attests the assets exist," and maps toward the custodian /
  third-party-attestation expectations in both regimes.
- Does NOT support: it is NOT a CPA examination. A custodian signature says
  "custodian X vouches for this reserve commitment"; it does not provide the
  accounting assurance, completeness testing, or independence a registered public
  accounting firm provides. `custodian_bound=true` is a provenance flag, not an
  audit opinion.

### C3 — designated-oracle price-commitment binding (attest_v3)
- Regulatory support: narrows Q2 on the PRICE side. Binds the prices used in the
  aggregate to a designated oracle authority authenticated at the contract
  boundary, so the issuer cannot cherry-pick favorable prices unobserved.
- Does NOT support: oracle pricing is weaker than C2's in-circuit signature; the
  `oracle_bound` flag makes the binding explicit. A consumer requiring oracle
  pricing MUST check the flag. It does not certify the oracle's own correctness.

### Mint-guard (Sprint A) — solvency-gated issuance
- Regulatory support: this is the ENFORCEMENT primitive. It turns a passive
  attestation into a hard control: an issuer's token cannot mint beyond a fresh,
  solvent attestation for the current period (Q1 + Q3 enforced at issuance). This
  directly supports the "prevent unbacked issuance / infinite-mint" risk both
  regimes care about, and mirrors the Chainlink "Secure Mint" pattern — but on
  Stellar, with private reserve composition.
- Does NOT support: it enforces the attestation's verdict; it does not improve the
  attestation's input truth (Q2). A mint-guard over a non-custodian-bound
  attestation enforces solvency over self-asserted balances. Configurable
  `require_custodian_bound` / `require_oracle_bound` let an issuer raise the bar.

---

## 4. The one-paragraph honest positioning (for docs + GTM + SCF)

Stellaris does not replace your auditor. Under GENIUS and MiCA a registered
public accounting firm still examines your reserves monthly (US) or semi-annually
(EU) and certifies that the balances you assert are real and complete. Stellaris
makes the time BETWEEN those examinations continuously verifiable on-chain: a
privacy-preserving zero-knowledge proof shows your reserves still cover your
liabilities, for the current period, without revealing your reserve composition;
and a solvency-gated mint refuses to issue new tokens unless that fresh proof
exists. Where you want stronger input assurance between audits, a designated
custodian can BLS-sign the reserve commitment (C2) and a designated price oracle
can bind the prices (C3) — both surfaced as explicit, checkable provenance flags.

---

## 5. Claims we must NOT make (compliance honesty ledger)

- DO NOT claim Stellaris "satisfies" or "replaces" the GENIUS monthly attestation
  or the MiCA six-month audit. It supplements them.
- DO NOT claim a zk proof establishes that the balances are real. It establishes
  the arithmetic over committed inputs. Input truth is C2/C3 (partial, named-party)
  and ultimately the CPA's role.
- DO NOT claim `oracle_bound` / `custodian_bound` are audit opinions. They are
  cryptographic provenance flags about who signed/bound what.
- DO NOT claim the demo trusted setup is production-grade. It is a single-
  contributor DEMO ceremony (see AGENTS.md honest limitations).
- DO present the inter-attestation freshness gap as the specific, real problem
  Stellaris closes — that claim is defensible and evidence-backed.

---

## 6. Verified vs asserted in this document

- VERIFIED via external sources (2026-06-29): GENIUS monthly-CPA-attestation +
  annual PCAOB audit; MiCA six-month audit + three-month publication; the 1:1
  reserve mandates. Citations in NEXT-SPRINTS-DEBATE-RESEARCH.md (E5).
- VERIFIED via code: C1/C2/C3 behaviour and the mint-guard enforcement are
  exercised by 60 passing contract tests (incl. 11 mint-guard e2e tests against a
  real Groth16 proof).
- ASSERTED (legal judgment, NOT legal advice): the mapping of each component to a
  regulatory function is an engineering/product interpretation. It is not a
  compliance opinion and must be reviewed by qualified counsel before any
  issuer-facing or regulator-facing use.
