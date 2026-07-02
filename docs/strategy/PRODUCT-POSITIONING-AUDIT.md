# Stellaris Product Positioning and Scale Audit

## Verdict

Stellaris should be positioned as a productized protocol SDK, not only a developer tool and not yet a full production reserve-audit product.

The current repository already has more than a hackathon proof-of-concept:

- a Circom proof system for private reserve arithmetic,
- a Soroban verification and attestation contract,
- a TypeScript SDK with domain, policy, proof, transport, registry, audit, persistence, event, pipeline, and reconciliation layers,
- strategy documentation tied to real market demand from stablecoins, RWAs, custodians, anchors, and auditors.

That means the strongest story is:

> Stellaris is the privacy-preserving solvency attestation layer for Stellar issuers. It gives stablecoin, RWA, and custodian teams a repeatable way to prove reserve coverage on-chain without exposing treasury composition.

## Tooling vs Product

### If framed as tooling only

Stellaris looks like:

- a Groth16/Soroban verifier wrapper,
- a proof-generation SDK,
- an example circuit,
- developer plumbing for attestations.

This is useful, but it weakens the market story. Judges or users may ask why this is not just another verifier example.

### If framed as a full product today

Stellaris overclaims unless it can prove real-world balances and liabilities are complete. The current MVP does not yet include:

- custodian-signed reserve inputs,
- oracle-backed asset valuations,
- auditor workflows,
- production trusted setup,
- mainnet deployment,
- a user-facing issuer dashboard.

So it should not claim to be a complete proof-of-reserves audit platform yet.

### Best positioning

Stellaris is a productized protocol SDK:

- Productized because it solves a concrete issuer/auditor problem and has a clear buyer/user.
- Protocol because the proof statement, public signal ABI, and on-chain attestation are reusable primitives.
- SDK because developers, issuers, dashboards, and backend services can integrate it without depending on one frontend.

This framing supports both the hackathon demo and a credible post-hackathon roadmap.

## Current Complexity Assessment

### Strong complexity that helps market fit

The TypeScript SDK is intentionally more mature than a simple demo client. It has separate modules for:

- `domain.ts` - transport-free business types,
- `policy.ts` - issuer snapshot validation before proving,
- `manifest.ts` - artifact/deployment configuration,
- `signals.ts` - public signal ABI parsing,
- `prove.ts` - witness/proof generation,
- `codec.ts` - contract argument encoding,
- `operations.ts` - typed contract operation registry,
- `transport.ts` - retryable invocation abstraction,
- `stellar.ts` - high-level contract client,
- `audit.ts` - redacted operational audit records,
- `pipeline.ts` - full attest workflow,
- `registry.ts` - indexed attestation state,
- `persistence.ts` - checkpoint persistence,
- `events.ts` - typed event bus,
- `reconciler.ts` - periodic issuer refresh with backoff.

This supports the claim that Stellaris can scale beyond a one-off proof demo.

### Complexity that previously confused users

The repository previously mixed the Stellaris brand with legacy internal `attestor` names. That made the project look split between two identities.

P7 fix completed:

- Rust contract directory is now `contracts/stellaris/`.
- Rust package is now `stellaris-contract`.
- Source/docs/scripts no longer use the legacy `Attestor` or `attestor` names outside generated build artifacts.

Remaining naming is now domain-specific: `Attestation`, `AttestationRegistry`, and related terms describe the product's core record type, not the old brand.

## Market Gap Fit

Stellaris maps well to a real gap:

- Stablecoin and RWA issuers need reserve transparency.
- Public reserve disclosure can leak treasury strategy and account composition.
- Existing PoR products validate demand, but Stellar needs a native ZK/Soroban attestation layer.
- Hackathon competitors are likely to cluster around private payments, proof-of-balance, and zkKYC.

The strongest wedge remains:

> Can an issuer prove it is solvent without exposing treasury details?

That is a stronger and less crowded problem than a generic proof-of-balance demo.

## Gaps Blocking Product-Grade Scale

### P0: Real transport

The SDK currently has a robust transport abstraction but not a concrete production `SorobanTransport` backed by `@stellar/stellar-sdk` XDR encoding. This is the most important engineering gap because it separates SDK architecture from live usability.

### P0: Naming consistency

Completed in this pass. The public brand, contract path, Cargo package, docs, and comments now consistently use Stellaris. Domain terms such as attestation remain because they describe the on-chain solvency record.

### P1: Real-world input trust

The proof proves reserve arithmetic. It does not prove bank balances, wallet ownership, liability completeness, or asset pricing truth. Production needs one or more of:

- custodian-signed balance statements,
- wallet ownership proofs,
- oracle-backed asset pricing,
- auditor-signed liability snapshots,
- selective disclosure for regulators.

### P1: Product workflow

The repo is SDK-heavy and product-light. To feel like a market product, it needs a simple issuer workflow:

1. Upload/import reserve snapshot.
2. Run policy checks.
3. Generate local proof.
4. Submit attestation.
5. Share verification URL or attestation record.
6. Show historical solvency timeline.

### P1: Deployment manifest

A market-facing SDK needs a single source of truth for network, contract ID, verification key hash, circuit version, and public signal ABI version.

### P2: Multi-issuer scale

The contract supports issuer + period lookup, and the SDK has reconciliation primitives. For scale, it should add:

- issuer metadata registry,
- attestation versioning,
- schema/circuit version fields,
- event indexing examples,
- historical pagination.

## Recommended P7 Submission Story

Use this language:

> Stellaris is not just a verifier example. It is a productized protocol SDK for issuer solvency attestations on Stellar. The MVP proves the hardest cryptographic path end-to-end: private reserve arithmetic, Groth16 proof generation, Soroban verification, replay protection, and an auditable attestation registry. The roadmap turns it into a full reserve-transparency product by connecting custodian/oracle inputs and an issuer dashboard.

## Immediate P7 Priority Order

1. Implement or stub clearly documented `SorobanTransport` integration.
2. Add demo script language that shows the product workflow, not only proof verification.
3. Add limitations language that distinguishes ZK arithmetic proof from real-world asset truth.
4. Add a deployment manifest example with network, contract ID, circuit version, and verification key hash.
5. Add a small issuer-facing workflow checklist for demo narration.
