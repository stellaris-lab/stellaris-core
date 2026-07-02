# 05 — Competitor Deep Dive: What People Are Actually Building

This is a competitor-intelligence pass for Stellaris. It updates the earlier
idea research with live evidence from DoraHacks, Stellar ecosystem projects,
adjacent proof-of-reserves products, and privacy/KYC builders.

## Executive Finding

The public Stellar Hacks BUIDL list is currently private, so we cannot inspect
competitor submissions directly. However, the market signal is still strong:

1. **Inside this hackathon, competitors are likely clustered around the official
   starter paths:** private payments/privacy pools, zkKYC/identity, proof of
   balance, allowlists, voting, games/verifiable computation.
2. **Outside this hackathon, proof-of-reserves is a proven real market category:**
   Binance uses zk-SNARK/Merkle PoR, and Chainlink sells Proof of Reserve as an
   institutional product for stablecoins, tokenized assets, wrapped assets, and
   secure minting.
3. **The gap for Stellaris is not whether PoR demand exists. It does. The gap is
   bringing a small, ZK-native, Stellar/Soroban on-chain attestation layer to the
   exact ecosystem SDF cares about: stablecoins, RWAs, anchors, institutional
   settlement.**

## Direct Hackathon Competitor Visibility

### DoraHacks BUIDL list

Source: `https://dorahacks.io/hackathon/stellar-hacks-zk/buidl`

Verified facts:
- Hackers visible: 365 at time of extraction.
- BUIDLs page says: **"Private BUIDLs list. Submissions are set private by the
  hackathon organizer."**
- Therefore, direct competitor submissions are not publicly inspectable yet.

Implication:
- We cannot truthfully say "no one is building PoR" in this hackathon.
- We can say the public idea board and official resources create strong
  gravitational pull toward certain categories.

## Category Map: Where Builders Are Being Pulled

| Category | Evidence | Expected competitor density | Stellaris implication |
|---|---|---:|---|
| Private payments / privacy pools | Official resources heavily feature Nethermind Stellar Private Payments; ready PoC exists | Very high | Avoid looking like a fork; position as issuer solvency, not transfers |
| zkKYC / identity | SAK exists; Stellar anchors/SEP-12 docs emphasize reusable KYC | High | Avoid generic zkKYC; Stellaris is not user identity |
| Proof of balance / proof of funds | Listed as mild official idea | High | Stellaris is stronger: issuer-level solvency, not single-account balance |
| Private allowlists / membership | Listed as mild official idea; common Merkle/nullifier pattern | Medium-high | Use only as fallback, not lead |
| Verifiable computation / RISC Zero | Official resources include RISC Zero verifier | Medium | More technical but heavier; not the simplest win path |
| Proof of reserves / issuer solvency | Official ideas mention it, but no Stellar PoR starter PoC surfaced | Lower | Best white space: known market demand + less hackathon crowding |

## Competitor 1: Stellar Private Payments / Privacy Pools

Sources:
- `github.com/NethermindEth/stellar-private-payments`
- `nethermindeth.github.io/stellar-private-payments`
- Stellar privacy-pools blog/resources

What they build:
- Private deposits, transfers, and withdrawals on Stellar.
- Circom Groth16 proofs generated in browser via WebAssembly.
- Soroban contracts: Pool, Groth16 verifier, ASP membership, ASP non-membership.
- Association Set Providers maintain approved/blocked sets for compliance.

Why it matters:
- This is the most obvious fork path for competitors.
- It is official-resource-backed, concrete, and demoable.
- It already has the exact ingredients many hackathon teams want: ZK, privacy,
  compliance, Stellar.

Weaknesses / openings:
- It is explicitly WIP, unaudited, and not for production assets.
- It is transfer/pool complexity, not issuer solvency.
- Many forks will look similar: deposit -> transfer -> withdraw.
- It has known demo limitations such as event retention and browser storage.

Stellaris positioning against it:
- "We are not building another privacy pool. We build issuer solvency
  attestation: a simpler, sharper financial guarantee that does not require a
  shielded transfer system."
- The demo is cleaner: accepted solvent proof, rejected insolvent proof.

## Competitor 2: SAK — Stellar Anchor KYC

Source: `github.com/SAK-Stellar-Anchor-KYC`

What they build:
- Unified KYC infrastructure for Stellar anchors.
- User completes KYC once; anchors verify identity via SEP-12 without handling
  raw sensitive data.
- ZK-powered status/tier verification.
- Supports SEP-10, SEP-12, SEP-24.
- Origin: Casa Stellar Argentina Hackathon 2025.

Why it matters:
- Generic zkKYC is not white space.
- The "complete KYC once, transact everywhere" story is already occupied.
- Anchor data-minimization demand is real, but SAK is already an ecosystem
  answer.

Weaknesses / openings:
- It addresses identity/KYC, not issuer balance backing.
- Its user is the individual/anchor KYC flow. Stellaris's user is the issuer,
  auditor, or protocol relying on reserve coverage.

Stellaris positioning against it:
- "SAK proves a customer is eligible. Stellaris proves an issuer is solvent."
- Complementary, not directly competing.

## Competitor 3: Binance zk-SNARK Proof of Reserves

Source: `binance.com/en/proof-of-reserves`

What they build:
- Exchange PoR system proving user assets are backed 1:1.
- Uses Merkle tree + zk-SNARKs.
- Users verify inclusion via Merkle leaf / record ID.
- Circuit ensures account balances contribute to total net balance, total net
  balance is non-negative, and Merkle root updates are valid.

Why it matters:
- This validates real user demand for ZK PoR.
- It proves that privacy-preserving reserve verification is not a made-up need.
- It gives Stellaris a mature reference story: exchanges already use this
  pattern; Stellar issuers need a Soroban-native version.

Weaknesses / openings:
- Binance PoR is centralized-exchange-specific, not a reusable Stellar contract
  pattern for stablecoin/RWA issuers.
- It is not designed around Soroban attestations, anchors, or Stellar assets.
- It emphasizes user inclusion in liabilities; Stellaris MVP emphasizes issuer
  reserve coverage and on-chain attestation.

Stellaris positioning:
- "Binance proved the demand. Stellaris adapts the solvency proof pattern to
  Stellar issuers and on-chain attestations."

## Competitor 4: Chainlink Proof of Reserve

Source: `chain.link/proof-of-reserve`

What they build:
- Automated reserve monitoring for stablecoins, tokenized assets, wrapped assets,
  and DeFi protocols.
- Used for secure minting, circuit breakers, and real-time transparency.
- Partners/integrations include Backed, 21.co, Bedrock, Wenia/Bancolombia,
  21Shares, Misyon Bank, OpenEden, xStocks, Aave.
- SOC 2 Type 2 and ISO 27001 positioning.

Why it matters:
- This is the strongest market-demand evidence.
- Chainlink is selling PoR to exactly the buyer class Stellaris targets: stablecoin
  issuers, tokenized asset issuers, DeFi protocols, institutions.
- Their messaging says on-chain PoR is critical for digital asset adoption.

Weaknesses / openings:
- Chainlink is an oracle/data-feed product, not a hackathon-scale ZK/Soroban
  circuit demo.
- It focuses on data feeds and automated monitoring; Stellaris focuses on a
  privacy-preserving proof statement verified natively by Stellar.
- Chainlink can be a future data source/oracle partner, not just a competitor.

Stellaris positioning:
- "Chainlink proves the institutional demand for reserve verification. Stellaris
  proves the missing ZK attestation layer on Stellar: don't reveal the reserve
  vector, verify the solvency statement on-chain."

## Competitor 5: Stellar compliance-friendly privacy stack

Sources:
- Stellar privacy strategy/blogs
- Stellar Private Payments
- Confidential Token Association context
- x402 on Stellar page

What the ecosystem is building:
- Privacy pools with ASPs.
- View-key disclosure.
- Confidential tokens.
- ZK verifiers for RISC Zero/Groth16 and Noir/UltraHonk.
- Compliance-ready private payments.

Why it matters:
- SDF's strategic direction is not anonymous consumer privacy only. It is
  configurable, compliance-ready institutional privacy.
- Stellaris fits this direction if framed as "institutional disclosure privacy,"
  not as a consumer wallet.

Stellaris positioning:
- "Same strategic thesis, different workflow: private proof of issuer solvency
  instead of private user transfer."

## What Competitors Are Actually Building vs What Users Demand

### What builders are building
- Private transfer systems.
- Identity/KYC status proofs.
- Membership proofs and allowlists.
- Toy examples / verifier demos.
- zkVM game/computation examples.

### What real users pay for
- Reserve verification for stablecoins and tokenized assets.
- Secure minting / prevention of unbacked issuance.
- Auditability without leaking internal treasury data.
- Compliance-compatible privacy.
- Lower-friction anchor/KYC flows.

Stellaris sits closer to the second list than most likely hackathon projects.
That is its strategic advantage.

## Bottom Line

The market says proof-of-reserves is real: Binance built it, Chainlink sells it,
and institutions use it. The hackathon field is likely crowded around private
payments and KYC because those are the most visible official examples. Stellaris
threads the needle: it uses a known-demand category but expresses it as a
small, original, Stellar-native ZK attestation product that is feasible in the
remaining time.
