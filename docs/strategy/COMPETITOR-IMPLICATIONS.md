# Competitor Implications for Stellaris

Short synthesis from `research/05-COMPETITOR-DEEP-DIVE.md`: how competitor data
changes the pitch, product scope, and demo.

## What changed after competitor research

The recommendation is still Stellaris, but the pitch should be sharpened.
Originally the story was:

> ZK proof-of-reserves on Stellar.

After competitor research, the better story is:

> Chainlink and Binance prove reserve verification is a real market. Stellaris
> brings the same trust category to Stellar as a privacy-preserving, Soroban-
> verified issuer solvency attestation.

This is stronger because it uses market evidence instead of only hackathon
logic.

## Strongest evidence of real demand

| Evidence | What it proves | How to use in pitch |
|---|---|---|
| Chainlink Proof of Reserve | Stablecoin/RWA/tokenized-asset issuers pay for reserve verification | "This is already an institutional category; Stellar needs a ZK-native version." |
| Binance zk-SNARK PoR | Large exchanges use ZK to prove backing without exposing user data | "The privacy-preserving PoR pattern is battle-tested at exchange scale." |
| Stellar focus on stablecoins/RWAs/anchors | Target users are chain-native, not imported from another ecosystem | "Stellaris fits Stellar's actual financial rails." |
| Private BUIDL list | We cannot inspect direct submissions | Avoid claiming no competitor; claim lower visible crowding than privacy pools/KYC |

## What to avoid saying

Do NOT say:
- "Nobody is building proof-of-reserves."
- "We solved full proof-of-reserves."
- "The proof proves the bank balances are real."
- "Chainlink is obsolete."

Say instead:
- "Direct BUIDLs are private, but the visible starter-code gravity points toward
  private payments and KYC."
- "Stellaris builds the ZK + Soroban attestation layer for issuer solvency."
- "Production would connect custodian-signed balance inputs or oracles."
- "Chainlink validates the market and could be a future data source; Stellaris is
  the privacy-preserving proof layer."

## Updated demo narrative

1. Start with market proof: "Reserve verification is already a real category:
   Binance built zk-SNARK PoR, Chainlink sells PoR for stablecoins/RWAs."
2. Narrow to Stellar: "Stellar is strong in stablecoins, RWAs, anchors, and
   institutional settlement."
3. State the gap: "But an issuer still needs a way to prove solvency on Stellar
   without publishing every reserve balance."
4. Show Stellaris: local proof -> Soroban verification -> on-chain attestation.
5. Show rejection: reserves below liabilities -> contract refuses `NotSolvent`.
6. State honest limitation: raw balance truth needs custodian/oracle signatures.

## Product scope correction

The MVP should not be positioned as a full Chainlink replacement. It is:
- a ZK proof circuit,
- a Soroban verification/attestation contract,
- a minimal issuer UI,
- a roadmap to custodian/oracle inputs.

Production expansion could integrate:
- Chainlink PoR feeds or another reserve data oracle,
- custodian-signed statements,
- RWA asset composition proofs,
- liabilities privacy,
- auditor/regulator selective disclosure.

## Competitive wedge

Private payments competitors answer:
> Can users transfer privately?

SAK/zkKYC competitors answer:
> Can users prove eligibility without exposing identity?

Stellaris answers:
> Can an issuer prove it is solvent without exposing treasury details?

That is the cleanest non-crowded wedge for this hackathon.

## Recommendation after this pass

Keep Stellaris as the lead idea. Add competitor-market proof to README, demo
script, and judge Q&A before implementation.

Priority edits before coding:
1. README: one paragraph citing Chainlink/Binance category validation.
2. DEMO-SCRIPT: open with the market proof line.
3. JUDGE-QA: answer "How do you compete with Chainlink/Binance?"
4. FEASIBILITY-AUDIT: clarify Chainlink/oracle is roadmap, not MVP.
