# Judge Q&A — Stellaris (hostile questions, honest strong answers)

Anticipated judge/skeptic questions with defensible answers. Prep for the
DoraHacks judging axes: Technical Implementation, Creativity, Design,
Adoption/Market, Presentation.

## Technical / ZK rigor

**Q: Is the ZK actually load-bearing, or decorative?**
A: Delete the proof and the product is a trust-me claim — there is nothing left.
The contract's `attest` flow refuses to record solvency unless a valid Groth16
proof of `sum(reserves) >= liabilities` verifies on-chain via the Soroban
BLS12-381 host functions (the `soroban_sdk::crypto::bls12_381` pairing check).
The proof IS the trust primitive.

**Q: What stops an issuer lying about their balances?**
A: Nothing in the ZK layer, and we say so plainly. The proof binds the
arithmetic and non-negativity of the committed reserve vector — it does NOT
attest that those numbers match a real bank/custodian. Production needs a
signed custodian oracle feeding committed balances; that's explicitly out of
scope. This is the standard, well-understood boundary of every proof-of-reserves
system, including TradFi ones.

**Q: Why Circom/Groth16 and not Noir or RISC Zero?**
A: Cheapest on-chain verification (Groth16) and the most-documented Stellar
path (official soroban-examples verifier + a full E2E tutorial). For a 7-day
build, lowest integration risk. The official soroban-examples Groth16 verifier
uses BLS12-381, which the Soroban host exposes directly — so curve choice matches
the on-chain pairing host functions exactly.

**Q: Groth16 needs a trusted setup — isn't that a weakness?**
A: Yes, per-circuit. Our ceremony script is a single-contributor DEMO setup and
is labeled as such. Production would run a multi-party ceremony (the standard
fix). We chose to be honest rather than hide it.

**Q: Why is the commitment salted?**
A: Without a salt, a known commitment could be brute-forced against guessed
balances. The salt makes the Poseidon commitment hiding.

**Q: How do you prevent replaying an old solvent proof?**
A: Each attestation is keyed by `(issuer, period_id)` and `period_id` is bound
into the proof's public signals. A second attest for the same period is rejected
on-chain (`PeriodAlreadyAttested`).

## Creativity / differentiation

**Q: Isn't this just the privacy-pool PoC everyone forked?**
A: No. There are no notes, no shielded transfers, no pool. It's issuer-side
solvency attestation — a different category. Most teams will fork the private
payments PoC; proof-of-reserves has no ready PoC to copy and is materially less
crowded.

**Q: Proof-of-reserves exists elsewhere — what's new?**
A: Doing it as a native on-chain, ZK-verified, non-replayable attestation on
Stellar where issuers actually live, with the insolvent state provably
rejected by the contract. Most PoR is an off-chain auditor report; this is
verifiable by anyone reading the ledger.

## Adoption / market

**Q: Who pays for this?**
A: Stablecoin and RWA issuers on Stellar who need ongoing solvency assurance
for holders, exchanges, and regulators — Stellar's named core customer base.
Post-FTX, proof-of-reserves is a recognized requirement.

**Q: Why Stellar specifically?**
A: SDF explicitly targets stablecoins, cross-border payments, and RWAs — the
exact issuers who need this — and recent protocol versions shipped the BLS12-381
pairing + Poseidon host functions that make on-chain Groth16 verification cheap.

## Design / presentation

**Q: The UI is minimal — why?**
A: Deliberate. The product is the on-chain proof, not the UI. The attestation
card reads back FROM the chain (not the local result) to prove it's really
on-chain.

## Failure-mode honesty

**Q: What doesn't work / what would you do with more time?**
A: (1) Custodian oracle to bind raw balances to reality. (2) Multi-asset reserve
composition with per-asset price proofs. (3) A real multi-party ceremony.
(4) Liabilities privacy (currently public). All are clear next steps, none
change the core ZK demonstration.
