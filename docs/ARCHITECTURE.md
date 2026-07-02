# Stellaris Architecture

Stellaris is organized like a protocol SDK rather than a single hackathon demo.
The goal is not code volume for its own sake; the goal is clear boundaries that
allow the circuit, contract, SDK, transport, and future frontend to evolve
independently.

## Layers

1. `circuits/` - ZK arithmetic layer.
   - Defines the proof statement and public signal ABI.
   - Must remain synchronized with `client/src/constants.ts` and
     `contracts/stellaris/src/types.rs`.

2. `contracts/stellaris/` - Soroban verification and registry layer.
   - `lib.rs` exposes public contract methods only.
   - `signals.rs` validates and parses public signals.
   - `storage.rs` owns storage keys and persistence.
   - `admin.rs` owns initialization/auth helpers.
   - `verifier.rs` is the only module touching BLS12-381 primitives.

3. `client/src/` - TypeScript SDK.
   - `domain.ts` contains transport-free business/domain types.
   - `policy.ts` validates issuer snapshots before proving.
   - `manifest.ts` validates artifact/deployment manifests.
   - `signals.ts` parses the public-signal ABI.
   - `prove.ts` builds witnesses and generates Groth16 proofs.
   - `codec.ts` converts proofs/signals to contract-call arguments.
   - `operations.ts` defines the typed contract operation registry.
   - `transport.ts` adapts generated bindings/RPC invokers with validation + retry.
   - `stellar.ts` composes the high-level contract client.
   - `audit.ts` defines redacted operational audit records.
   - `pipeline.ts` orchestrates normalize -> policy -> prove -> verify -> attest.
   - `registry.ts` reconciles contract attestations into queryable indexed state.
   - `persistence.ts` checkpoints registry state with JSON-safe BigInt encoding.
   - `reconciler.ts` runs deterministic issuer refresh jobs with backoff, audit, and checkpoints.
   - `events.ts` provides a typed event bus and replayable event log for indexer consumers.

## Development Principles Borrowed From Mature SDKs

- Small modules with one reason to change.
- Stable domain types at the edge of every subsystem.
- Explicit encoding boundaries for blockchain-specific data.
- Policy separate from mechanism: a valid proof may still violate product rules.
- Manifest-driven artifacts so deployment details do not leak everywhere.
- Transport abstraction so the SDK can be used by frontend, backend, CLI, or tests.

## Non-Goals In This Repository

- No UI/frontend/demo mockups.
- No custodial balance oracle yet.
- No production trusted setup.
- No mainnet deployment defaults.

## Current Hardening Gaps

- Implement concrete `SorobanTransport` with Stellar SDK XDR encoding.
- Replace demo trusted setup with multi-party ceremony outputs.
- Parse fixture JSON into exact contract types in Rust tests.
- Add generated contract bindings once the contract ID and network are fixed.
