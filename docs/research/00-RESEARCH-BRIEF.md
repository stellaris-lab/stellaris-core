# 00 — Research Brief

Source-backed facts about the hackathon. All claims tagged with evidence level.

## Event Facts (VERIFIED — DoraHacks detail/resources/ideas pages)

| Field | Value |
|-------|-------|
| Name | Stellar Hacks: Real-World ZK |
| Organizer | Stellar Development Foundation |
| Platform | DoraHacks (virtual) |
| Prize pool | $10,000 USD (paid in XLM) |
| Submissions open | 2026-06-15 07:00 |
| Deadline | 2026-06-29 19:00 (June 29, 12:00PM PST) |
| Tags | Stellar, ZK, Rust, Noir, RISC Zero, Soroban, Circom |

### Prize breakdown (VERIFIED)
- 1st: $5,000
- 2nd: $2,000
- 3rd: $1,250
- 4th: $1,000
- 5th: $750

Five paid places out of one pool. INFERRED: a sharp, complete "Mild/Medium"
project realistically targets places 1-3; the field will be thin on *finished*
real-world projects because most teams fork the privacy-pool PoC.

## Time Budget (VERIFIED timeline + current date)

Current date in this research session: 2026-06-22. Deadline 2026-06-29.
**~7 days remain.** This is the single most important design constraint.

INFERRED consequence: scope must be a single ZK circuit + single Soroban
verifier + a thin, legible demo. Anything requiring a multi-circuit system,
recursive proofs, or a from-scratch UTXO design ("Wild" tier) is too risky to
finish and polish in 7 days. Win condition = sharp Mild/Medium execution.

## Hard Submission Requirements (VERIFIED — detail page)

1. **Open-source repo** (GitHub/GitLab/Bitbucket) with full source + detailed
   README. Unfinished work / mock data acceptable IF clearly documented.
2. **Demo video** 2-3 min: walkthrough + explicitly explain the ZK integration.
   On-camera presence optional.
3. **ZK + Stellar integration must be LOAD-BEARING** — ZK powers core
   functionality, not just mentioned in docs. Must verify proofs in a Stellar
   smart contract OR integrate with Stellar testnet/mainnet.

The phrase "ZK must be load-bearing" is the disqualifier filter. Any idea where
you could delete the ZK and still have a working product loses. Pick a problem
where the proof IS the product.

## Theme & What Scores (VERIFIED — detail/ideas pages)

> "build anything you want with zero-knowledge on Stellar... if it uses ZK and
> runs on Stellar, it counts."

Officially open, BUT strongly steered:
> "Strongly encouraged to target Stellar's core strengths: stablecoins,
> cross-border payments, tokenized real-world assets, and institutional
> settlement."

VERIFIED advice from organizers:
> "'Mild' projects win hackathons all the time when they're sharp and
> well-executed. Pick something you can actually ship... make the ZK genuinely
> essential, and document it clearly."

INFERRED judge priority order for THIS hackathon:
1. Is the ZK load-bearing and actually working on Stellar? (gate)
2. Does it hit a real-world Stellar strength (payments/RWA/compliance)?
3. Is it sharp, finished, and clearly demoed in 2-3 min?
4. Is it differentiated from the obvious fork-the-PoC crowd?

## Judging Criteria Signal (VERIFIED — DoraHacks judging guides + comparable Stellar/DoraHacks rounds)

DoraHacks hackathons do not always publish exact weights up front, but the
platform's own guidance and comparable rounds converge on these axes:
- **Technical Implementation** — clean, complete, technically sound; correct use
  of the sponsor's tech (here: real on-chain ZK verification on Soroban).
- **Creativity** — solves a real problem in a novel way.
- **Design / UX** — delightful, easy to use.
- **Adoption & Market** — fills a real gap, plausible real-world traction.
- **Overall Presentation** — demo video + docs clarity.

ASSUMPTION: weights are roughly even with a technical-correctness gate. Optimize
for "obviously works on-chain + obviously useful + obviously finished."

## Anti-Scam Note (VERIFIED)
> "The team will never DM you first asking for keys, seed phrases, or payment."
Operational note only; no design impact.

## Open Questions (UNKNOWN — confirm before/while building)
- Exact judging weights and whether there is a community MACI voting round on
  top of judge scoring (DoraHacks often adds quadratic-funding voting). If yes,
  a legible consumer-facing story matters more (shareability).
- Whether mainnet deployment scores higher than testnet. ASSUMPTION: testnet is
  fine given the "research prototype, not audited" framing throughout the docs.
