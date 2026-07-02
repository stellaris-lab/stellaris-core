# 02 — Competitive Gaps

Goal: avoid the crowd, find white space where ZK is load-bearing and the
real-world Stellar angle is strong.

## What 80% of teams will build (AVOID or differentiate hard)

INFERRED from the ideas board + the existence of ready-to-fork PoCs:

| Crowded path | Why crowded | Why risky for a win |
|--------------|-------------|---------------------|
| **Fork the Privacy Pools PoC -> "private payments"** | Nethermind PoC is linked everywhere; easiest copy | Judges see N identical forks; ZK is real but undifferentiated; "not audited" caps it |
| **Trivial proof-of-balance / proof-of-funds** | It's the #1 "Mild" example | Demo is a toggle that says "true"; weak product story; everyone does it |
| **Generic zkKYC credential** | On Stellar's own headline list (zkTokens/zkLogin/zkKYC/zkVoting/zkVM); SAK already building a reusable KYC layer | Crowded + an existing ecosystem project (SAK) occupies it; hard to out-execute in 7 days |
| **a*b=c / generic "verifiable computation" demo** | It's the tutorial circuit | Not a product; ZK present but not real-world load-bearing |
| **Sealed-bid auction / anonymous vote** | Classic ZK demo, MACI exists | Good but generic; not a Stellar real-world strength; DoraHacks already has MACI voting |

VERIFIED context for the KYC crowding: Stellar's own blog headlines the 5
canonical use cases (zkTokens, zkLogin, zkKYC, zkVoting, zkVM), and a project
"SAK — Stellar Anchor KYC" is already building "a unified KYC infrastructure...
reusable identity verification layer." Entering plain zkKYC means fighting an
incumbent on their turf with 7 days.

## Where the white space is (INFERRED)

The gap is NOT "add privacy to payments" (solved/forked). The gap is:
**use a proof as the load-bearing trust primitive for a real-world Stellar
money workflow that currently relies on a trusted third party or on leaking
data.** Specifically, three under-built intersections:

### Gap A — Proof-of-Reserves / Solvency for stablecoin & RWA issuers
- Ideas board lists it ("Proof-of-reserves for an issuer") but it is far LESS
  forked than private payments (no ready PoC exists to copy).
- Real-world Stellar strength: USDC/stablecoin issuers and RWA issuers are
  Stellar's actual customer base. Solvency attestation is a live industry pain
  (post-FTX, proof-of-reserves is a recognized real need).
- ZK is genuinely load-bearing: prove total backing >= total liabilities
  WITHOUT revealing per-account balances or the full reserve composition.
- Buyer exists: issuers/auditors. Strong "Adoption & Market" score.

### Gap B — Selective-disclosure / view-key compliance on a real transfer
- Ideas board lists "compliant private transfer with a view key" and
  "confidential payroll/invoicing... prove totals to auditors."
- White space: most teams will hide amounts (privacy) but skip the *auditor
  side*. The defensible product is the **compliance/disclosure layer**: prove a
  payment happened and is policy-compliant (e.g., recipient not sanctioned, sum
  under a threshold) while keeping amounts private, AND give an auditor a view
  key to reconstruct exactly what they're authorized to see.
- Real-world strength: cross-border payments + institutional settlement (both
  named in the docs as core Stellar strengths).

### Gap C — Off-chain computation attestation for RWA / credit (RISC Zero)
- "Verifiable off-chain computation: credit score, tax estimate" (Mild) and
  "Private RWA settlement" (Spicy).
- White space: prove a *computed financial fact* (e.g., "this borrower's
  off-chain credit metric >= threshold" or "this RWA's NAV was computed
  correctly from sealed inputs") and settle on Stellar — without revealing the
  underlying financials. Few teams will touch RISC Zero (medium cost, more
  setup) so the field is thin.

## Defensibility note (INFERRED)
The pattern that wins this specific hackathon:
> A proof that REPLACES a trusted third party in a real Stellar money flow,
> demoed end-to-end on testnet, where deleting the ZK breaks the product.

Proof-of-reserves and selective-disclosure compliance both fit this and are
materially less forked than private payments. They also map cleanly onto the
cheapest, most-documented Circom Groth16 + official verifier path.

## Cross-check against "invented demand" pitfall
- Stablecoin issuers and cross-border/institutional settlement are explicitly
  named by SDF as Stellar's real strengths (VERIFIED) — demand is chain-native,
  not analogized from another ecosystem. This avoids the failure mode logged in
  the hackathon-strategy skill (pitching behavior that lives on another chain).
- Proof-of-reserves demand is real-world (TradFi + crypto post-FTX) AND maps to
  Stellar's actual issuer base, so it is transferable, not merely analogized.
