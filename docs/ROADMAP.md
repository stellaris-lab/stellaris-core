# Stellaris Protocol & SDK Roadmap

Status: living document. This roadmap turns Stellaris from a single-statement
Groth16 proof-of-reserves prototype into a native, modern ZK solvency protocol +
SDK for Stellar/Soroban. It is grounded in the real 2026 Soroban protocol surface
and the academic proof-of-solvency literature, but is written as first-development
/ native design — external systems are private background research only, never
branding or "inspired by" framing in shipped docs.

This document is authoritative for direction. `docs/CHANGELOG.md` [Unreleased]
is authoritative for what is actually built. When the two disagree, the
CHANGELOG wins for status and this file wins for intent.

---

## 0. Where we are (verified baseline, not aspiration)

The following are built and verified (see CHANGELOG):

- Real Circom circuit (`circuits/por.circom`, 2084 non-linear constraints):
  16-balance range checks, `SumGte` solvency, two-level Poseidon commitment,
  period binding. Compiles under circom 2.2.x with `-p bls12381`.
- Real Groth16/BLS12-381 trusted setup + proofs (`setup/ceremony.sh`,
  `setup/export-fixtures.sh`, `fixtures/`). snarkjs-verified.
- Soroban contract verifying REAL proofs through the on-chain BLS12-381 pairing
  check (`contracts/stellaris`, `cargo test` 11/11). No mock VK.
- TS SDK (`@stellaris/por-sdk`) with the single shared byte-exact encoder
  (`client/src/encoding.ts`) — G1 96B, G2 192B (`c1||c0` Fp2 order), U256 32B —
  matching the on-chain layout byte-for-byte and the CAP-0059 spec.
- Integration layers + example apps in `stellaris-apps` (transport, signer,
  manifest loader, attestation service, indexer, operator CLI), 40 tests.

### The honest boundary that defines the whole roadmap

The current proof binds **arithmetic and non-negativity** over a 16-slot reserve
vector against a **trusted scalar `liabilities_in`**. It does NOT prove:

1. that `liabilities_in` equals the true sum of per-user liabilities,
2. that the reserve balances correspond to real, exclusively-controlled
   on-chain assets,
3. anything for more than 16 reserve accounts.

Every milestone below is an attack on one of these three boundaries. That is the
definition of "harder and more real" for this protocol: closing the gap between
"arithmetic is consistent" and "solvency is true."

---

## 1. The real Soroban ZK surface we build on (verified 2026)

These are the protocol facts that constrain and enable the roadmap. They are
verified against the Stellar protocol CAPs, not assumed.

- **Protocol 22 / CAP-0059** shipped 11 BLS12-381 host functions: G1/G2 add, mul,
  MSM, map-to-curve, hash-to-curve, pairing, and Fr field arithmetic. Critically,
  the spec fixes Fp2 serialization as `be_bytes(c1) || be_bytes(c0)` — the
  high coefficient first. This is the protocol-level source of our encoder's
  `c1||c0` G2 ordering; our byte-equality test is the local guard for it.
- **Protocol 25** shipped PLONK-capable and post-quantum-relevant primitives;
  Stellar's own ZK working group demonstrated a Groth16 -> PLONK -> post-quantum
  progression for a group-membership contract on testnet. This validates our
  proving-system migration axis (Milestone D) as native to the platform, not a
  fork of someone else's stack.
- **Protocol 26 / CAP-0080** added `bls12_381_g1_is_on_curve`,
  `bls12_381_g2_is_on_curve`, `bn254_g1_is_on_curve`, plus BN254 MSM and modular
  arithmetic. The on-curve checks are the cheap, native way to validate untrusted
  proof/VK input points — directly relevant to Milestone A hardening.

Implication: every primitive Stellaris needs for a far more ambitious protocol
(MSM for batched commitments, hash-to-curve for nullifiers/Pedersen generators,
on-curve checks for input validation, Fr arithmetic for in-contract field work)
is already live in the host. The protocol is not blocked on the chain; it is
blocked on our circuits and contract logic. Good — that is the hard, real work.

---

## 2. Design invariants (never drift)

These extend AGENTS.md's cross-file invariants and govern all milestones.

1. **One shared encoder.** Byte serialization for any curve point lives once, in
   the SDK core (`encoding.ts`), guarded by a byte-equality test against Rust
   ground truth. Transports/codecs are thin adapters. No reimplementation.
2. **Public-signal ABI is generated, not assumed.** Any new circuit output is
   recorded in `circuits/PUBLIC_SIGNALS.md` first, then mirrored in
   `contracts/.../types.rs`, `client/src/constants.ts`, and `signals.ts`.
3. **Real artifacts only in core.** No mock VK, no fabricated proofs, no
   placeholder tests in the protocol/SDK. Mocks live ONLY in `stellaris-apps`
   example/test infrastructure (e.g. `MockSorobanTransport`).
4. **Every claim has a failing-case test.** A solvency protocol that cannot
   demonstrate rejection of an insolvent / malformed / replayed / under-summed
   input on camera and in CI is not done.
5. **Native-first docs.** No "inspired by / adapted from" framing of external
   protocols in shipped docs. External work is private background research.
6. **Deterministic core, ceremony at the edge.** Proving-key material and trusted
   setup are deployment concerns behind the manifest; the protocol logic stays
   deterministic and testable offline.

---

## 3. Milestone ladder

Milestones are ordered by dependency, not calendar. Each has a crisp exit gate.
Letters are stable references; sub-items may be reordered.

### Milestone A — Verifier & circuit hardening (foundation)

Goal: make the existing single-statement protocol unbreakable before adding
ambition on top of it.

- **A1. On-curve input validation.** Use CAP-0080 `is_on_curve` host functions to
  reject malformed proof/VK points before the pairing check, with typed contract
  errors. Add Rust tests feeding off-curve / wrong-subgroup garbage and asserting
  clean rejection (not a panic, not a silent false).
- **A2. Negative / overflow witness tests. [DONE]** Circuit-level tests proving
  the range checks actually bite: a balance >= 2^64, a forged negative, a
  liability that overflows the 68-bit comparison budget — each yields an
  unsatisfiable witness (no proof), verified via snarkjs failure, not asserted in
  prose. Implemented in `setup/negative-witness-check.sh` (4/4: 3 adversarial
  inputs rejected at the `Num2Bits` constraint, 1 control input accepted).
- **A3. Commitment binding test. [DONE]** Changing any balance changes the
  Poseidon commitment (verified for slots 0/1/7/15) and identical inputs are
  deterministic. Implemented in `setup/commitment-binding-check.sh` (5/5). The
  contract stores `C` so a proof cannot be replayed against a different reserve
  vector in the same period (contract-side replay guard covered by `cargo test`).
- **A4. VK provenance.** Record the ceremony transcript hash on-chain at `init`
  and expose `get_vk_digest()` so verifiers can confirm which setup produced the
  accepted proofs. Exit gate: a verifier can independently recompute the digest
  from `fixtures/verification_key.json`.

Exit gate for A: `cargo test` covers reject-paths for malformed points,
under-constrained witnesses, and commitment tampering; all real, no mocks.

### Milestone B — Proof of liabilities (the central hard problem)

> **Detailed plan:** `docs/plan/06-MILESTONE-B-PROOF-OF-LIABILITIES-RPD.md` —
> file-level RPD with threat model, per-file Role/API/flow, a 7-phase execution
> sequence (B-P0..B-P6) with exit gates, and a positive/negative test matrix.
>
> **Status: B-P0..B-P6 DONE/verified.** Merkle-sum circuit primitives built and
> compiled; inclusion soundness proven (real path verifies, tampering rejected);
> `por_v2` binds `sum(reserve) >= liabTotal` with `liabTotal` SNARK-bound to the
> tree (B1/B2/B4); attack defense proven (forged-sum/overflow → no witness);
> contract v2 (`attest_v2`) verifies real proofs on-chain (cargo test 18/18); the
> SDK + transport v2 path is byte-exact; the apps mock runtime mirrors the full v2
> contract state machine and `integration-v2.test.ts` drives the REAL depth-4
> fixtures through `client.attestV2()` end-to-end (apps 50/50). The user/verifier
> leg is also done: `setup/inclusion-prove.sh` produces a REAL Groth16 per-user
> inclusion proof, verifies it against the ceremony VK, proves forged claims fail,
> and asserts the inclusion `rootHash`/`total` are byte-equal to the issuer's
> attested `liabRoot`/`liabTotal` (4676714…347 / 4300). Remaining: only the
> pure-TS `liabilities.ts` tree builder (rebuilding the root from scratch in TS
> rather than from the circuit witness) is gated on an installable BLS12-381
> Poseidon; the end-to-end proof path it would replace is fully exercised.

Goal: replace the trusted `liabilities_in` scalar with a cryptographic proof that
the declared liability total is the true sum of per-user balances, without
revealing any user's balance. This is the real proof-of-solvency frontier.

- **B1. Merkle-sum (Maxwell) liability tree.** Each leaf = `H(user_id_salt ||
  balance)` carrying a balance; each internal node carries the sum of its
  children. Root commits to `(rootHash, totalLiabilities)`.
- **B2. Defend the known negative-balance attack.** The naive Maxwell tree lets a
  custodian understate liabilities by injecting negative/forged intermediate
  sums. Defense: a SNARK over the tree proving (i) every leaf balance is in
  `[0, 2^64)`, (ii) every internal node equals the exact sum of its children with
  no overflow, (iii) the published root sum is the true aggregate. This is the
  documented mitigation line; we implement it natively as a Circom circuit.
- **B3. Per-user inclusion proof.** A user proves their balance is included in the
  liability root without learning any sibling balance — public inputs
  `(user_id, claimed_balance, root)`, private witness the inclusion path +
  partial sums. SDK helper generates and verifies these client-side.
- **B4. Wire into solvency.** The top-level statement becomes: `sum(reserves) >=
  liabilitiesRoot.total`, where `liabilitiesRoot.total` is now SNARK-bound, not
  asserted. The contract stores the liability root alongside the attestation.

Exit gate for B: an end-to-end test where (a) the issuer proves a liability root,
(b) a user verifies inclusion, (c) the solvency proof binds reserves to that
proven total, and (d) a custodian attempting to understate liabilities via a
forged internal sum produces no valid proof.

### Milestone C — Multi-asset & oracle boundary

Goal: move from a single aggregate to realistic multi-asset reserves, and make
the honest "balances vs reality" boundary cryptographically explicit.

- **C1. Multi-asset reserves. [DONE/verified]** `por_v3.circom`
  (`ProofOfReservesMultiAsset(4 assets x 4 reserves, 64-bit bal, 32-bit price)`,
  5,496 constraints, 2^15 ptau) proves per-asset solvency AND an oracle-priced
  aggregate solvency in a common unit. 8-signal ABI `[ aggregateSolvent,
  reserveCommitment, priceCommitment, assetSolvent[0..3], period ]`, mirrored
  across `PUBLIC_SIGNALS.md` / `types.rs` (SIG3_*) / `constants.ts` / `signals.ts`
  (invariant #1 held). Contract v3 (`init_v3`/`attest_v3`/`get_attestation_v3`/
  `get_vk_v3`, `AttestationV3`, `VkV3`/`AttestV3` namespaces) verifies real proofs
  on-chain through the D1 backend seam. SDK v3 (`attestV3`/`getAttestationV3`,
  `ProofBundleV3`/`AttestationV3`, `parsePublicSignalsV3`, operations registry).
  GATES MET: contract 32/32 (+7 v3 incl. the headline one-asset-underwater /
  aggregate-solvent property and priced-insolvent rejection); apps 64/64 (+9 v3
  incl. the real-fixture underwater case + v2/v3 store isolation); por-v3 crux
  18/18; three real snarkjs-verified fixtures (`fixtures/v3/`). TRUST BOUNDARY
  (honest scope): the circuit proves the aggregate was computed with the
  COMMITTED prices (`priceCommitment` binds them); it does NOT assert the prices
  are real market prices — that is C3's signed-feed job, and priceCommitment is
  the seam C3 plugs into.
- **C2. Signed custodian attestation input. [DONE/verified]** A designated
  custodian (`set_custodian`, admin-gated; pubkey is a BLS12-381 G2 point) signs
  the public `reserveCommitment`; `attest_v3_signed` verifies that signature
  ON-CHAIN via the real pairing host function (`e(sig,G2)==e(H(m),pk)` through
  `hash_to_g1` + `pairing_check`) and stamps `custodian_bound=true`. So an
  attestation proves "these reserves were signed by custodian X" WITHOUT
  revealing balances (C1 already proved the commitment binds the exact matrix).
  ROADMAP CORRECTION (honest): the original line said "verified INSIDE THE CIRCUIT
  via the BLS host functions" — that is not implementable. Soroban host functions
  are contract-side calls, not circom gadgets; circomlib ships no BLS12-381
  pairing gadget (in-circuit pairing = millions of constraints), and its
  EdDSA-Poseidon gadget compiles under -p bls12381 but its BabyJubjub params are
  BN254-specific (unverified soundness under our field). The sound, on-curve
  (invariant #4), offline-verifiable reading is contract-side BLS verification —
  the reserve-side sibling of C3's contract-side oracle binding. GATES MET:
  contract 49/49 (+5 real-BLS primitive tests in `bls_sig_tests` incl. a genuine
  ark-bls12-381 signature that verifies through the on-chain pairing, wrong-signer
  + tampered-commitment rejection, self-checked G2 generator constant; +5
  `attest_v3_signed` entrypoint tests: bind, wrong-signer, wrong-commitment,
  not-configured, admin-auth); apps 71/71 (+3 C2 integration tests). SDK gained
  `setCustodian`/`attestV3Signed`/`getCustodian` + `custodianBound`. HONEST SCOPE:
  this is a contract-boundary signature check (real BLS, real curve), not an
  in-circuit one — the `custodian_bound` flag makes the binding explicit so a
  consumer can require it.
- **C3. Price-feed binding. [DONE/verified]** A designated price-oracle authority
  (`set_oracle`, admin-gated) publishes a per-period price commitment
  (`publish_oracle_commitment`, oracle-gated via Soroban `require_auth` — the
  oracle's keypair signing the tx IS the contract-boundary authentication). When
  `attest_v3` runs for a period with a published commitment, it REQUIRES the
  attested `priceCommitment` to equal it (else `OracleMismatch`) and stamps the
  attestation `oracle_bound=true`; with no published commitment the prices are
  issuer-chosen and `oracle_bound=false`. ABI UNCHANGED — C1 already surfaced
  `priceCommitment` as a public signal, so C3 is pure contract-side enforcement
  + the new `oracle_bound` provenance field on `AttestationV3` (not a public
  signal). GATES MET: contract 39/39 (+7 C3 tests: bound-on-match, OracleMismatch
  rejection, unbound path, not-configured, oracle-auth + admin-auth negative,
  read-back); apps 68/68 (+4 C3 integration tests through the mock runtime). SDK
  gained `setOracle`/`publishOracleCommitment`/`getOracle`/`getOracleCommitment`.
  HONEST SCOPE: this binds prices to a DESIGNATED-ORACLE authority authenticated
  at the contract boundary (Stellar keypair). It is weaker than C2's in-circuit
  BLS signature verification; the `oracle_bound` flag makes the binding explicit
  so a consumer requiring oracle pricing can demand it. The conditional-enforcement
  race (issuer attesting before the oracle publishes) is intentionally surfaced
  via the flag, not hidden.

Exit gate for C: a multi-asset attestation with a per-asset breakdown and a
signed-custodian input, where tampering with the signature invalidates the proof.
[MET] C1 (multi-asset + per-asset breakdown) + C2 (custodian BLS signature;
wrong-signer / tampered-commitment both rejected — `test_c2_wrong_signer_rejected`,
`test_c2_signature_over_wrong_commitment_rejected`) + C3 (oracle price binding)
together satisfy this gate.

### Milestone D — Proving-system evolution (Groth16 -> PLONK -> PQ)

Goal: track the platform's own trajectory. Make the proving system a swappable
backend behind a stable contract/SDK boundary.

- **D1. Backend abstraction. [DONE/verified]** `VerifierBackend` trait +
  `Groth16Backend` impl + `VerifierVersion` tag + `dispatch_verify` in the
  contract (`contracts/stellaris/src/verifier.rs`), wired into both `attest` and
  `attest_v2` and activating the previously-dormant `WrongVerifierVersion` error;
  symmetric `ProvingBackend` interface + `Groth16Backend` + `ProvingVersion` +
  `backendFor` in the SDK (`client/src/backend.ts`), with `prove.ts` delegating to
  a default backend. Public-signal ABI unchanged. GATE MET: contract 25/25 (+4 D1
  seam tests incl. unknown-version → `WrongVerifierVersion`, real proof verifies
  through the trait, wrapper/backend equivalence); apps 55/55 (+5 SDK seam tests
  incl. a custom backend injected without touching `prove.ts` internals). No
  speculative second backend shipped (YAGNI guardrail held). HONEST SCOPE: the
  seam abstracts the INTERNAL verify call + version routing only. It does NOT make
  the Soroban `attest*` entrypoints backend-polymorphic — those bind the concrete
  `Groth16Proof` type into the XDR ABI, which a Rust trait cannot abstract. A
  second backend with a different proof shape (PLONK/PQ) needs a NEW entrypoint
  (or a `Bytes`-proof + scheme discriminant), so D2/D3 are NOT just a new trait
  impl + dispatch arm — the seam gives them a verification home and version tap,
  not free integration. (This correction came from a 3-reviewer debate flagging
  the original "additive" wording as an overclaim.)
- **D2. PLONK track.** Add a universal-setup PLONK path (no per-circuit ceremony),
  reusing the same circuit statements. Document the proof-size / verify-cost
  trade vs Groth16 with measured Soroban CPU-instruction budgets (the vendored
  groth16_verifier budget report is the measurement template).
- **D3. Post-quantum exploration.** Spike a hash-based / lattice-friendly backend
  behind the same trait, capturing the proof-size blow-up honestly. Research-tier,
  gated behind a feasibility note, not a shipped default.

Exit gate for D: the same solvency statement verifies on-chain through at least
two backends selected by manifest, with a measured cost comparison committed.

### Milestone E — Recursion & batching (scale)

Goal: one attestation that aggregates many periods or many issuers.

- **E1. Recursive aggregation.** Use proof recursion/accumulation so a single
  succinct proof attests to a batch of period attestations (a "solvency history"
  proof), reducing on-chain verification to one pairing check per batch.
- **E2. MSM-batched commitments.** Use the CAP-0059 `g1_msm` / `g2_msm` host
  functions to batch commitment verification, cutting per-account host cost.

Exit gate for E: a recursive proof verifying N period attestations on-chain at
sublinear marginal cost, with a measured budget curve.

### Milestone F — Live network & release hardening

Goal: prove the whole stack against the real chain and prepare a credible release.

- **F1. Testnet deploy + e2e.** Deploy the contract to Stellar testnet, run
  `client.attest()` against it through the real codec, confirm the network
  accepts the bytes and stamps the attestation. (Requires `stellar` CLI + a
  funded testnet key — operator-provided.)
- **F2. Multi-party ceremony.** Replace the single-contributor demo setup with a
  real multi-contributor transcript; publish the transcript and digest.
- **F3. Audit-readiness pass.** Threat model doc, under-constrained-circuit review
  checklist (the Halo2/Axiom audit literature is the template), and a fuzzing
  harness for the contract's signal parser and codec.

Exit gate for F: a live testnet attestation transaction hash in the README, a
published ceremony transcript, and a committed threat model.

## SDK & protocol-surface evolution (parallel track)

The SDK is the product surface; it evolves alongside the circuit/contract. These
are native-first design directions, not ports of any other project.

- **S1. Backend-agnostic proving API.** `ProvingBackend` interface (see D1) so
  `generateProofFromSnapshot` is parameterized by backend; Groth16 stays the
  default. The byte-encoding boundary (`encoding.ts`) is already the single
  shared converter and stays backend-neutral for points; only the proof shape
  changes per backend.
- **S2. Generated contract bindings.** Once a contract ID + network are fixed,
  generate typed bindings and let the transport consume them, replacing the
  hand-written `operations.ts` arg shapes with generated ones (keeping the codec
  as the byte boundary).
- **S3. Streaming indexer.** Promote `registry.ts` + `events.ts` into a
  long-running indexer service that subscribes to `attested` contract events and
  serves a queryable solvency-history API — the read side of the protocol.
- **S4. Liability-proof SDK surface.** New SDK module for the Milestone B
  Merkle-sum liabilities: build the tree, generate per-user inclusion proofs,
  and a verifier a user runs locally to confirm their balance is in the root —
  the user-facing half of proof-of-solvency.
- **S5. Multi-language client parity.** Keep the TypeScript SDK canonical; define
  the wire/ABI so a Rust or Python client could be generated from the same
  operation registry + encoding spec without divergence.

## Cross-file invariants this roadmap must never break

These are the silent-failure traps; every milestone re-checks them.

1. Public-signal order is generated, recorded in `circuits/PUBLIC_SIGNALS.md`,
   and identical across circuit, contract `types.rs`, SDK `constants.ts`, and
   `prove.ts`. Any new public signal (multi-asset, liabilities root) regenerates
   this everywhere in one change.
2. Proof/VK byte encoding has ONE converter: `client/src/encoding.ts`
   (G1 96B `X||Y`; G2 192B `c1||c0` per Fp2 — matches CAP-0059
   `be_bytes(c1) || be_bytes(c0)`; U256 32B big-endian). Locked by the byte-
   equality test against Rust ground truth. The transport codec is a thin adapter.
3. `n` accounts and `nBits` per balance are consistent across circuit, SDK
   validation, and tests.
4. Curve is BLS12-381 across circuit, contract, and SDK. BN254 is available on
   Soroban (CAP-0080) but is NOT the Stellaris curve.
5. soroban-sdk / stellar-sdk versions are pinned, never "latest".

## How to use this roadmap

- Each milestone has an explicit exit gate; do not mark `[x]` until the gate's
  artifact exists and is verified (a passing test, a committed measurement, a
  live tx hash). "Documented" is not "done."
- Real cryptographic artifacts only in core; mocks/fixtures-as-demo live only in
  the example apps (`stellaris-apps`).
- When a milestone changes the public-signal ABI or the byte layout, the
  invariant tests above are the gate — re-run them before anything else.

## Status snapshot (at roadmap creation)

- DONE: real circuit (2084 constraints), real Groth16 trusted setup + proofs,
  on-chain BLS12-381 pairing verification (contract 11/11 tests), single shared
  byte encoder, SDK attest path connected end-to-end (apps 40/40 tests).
- NEXT (smallest real step): Milestone A — add `is_on_curve` input validation to
  `verifier.rs` (CAP-0080, protocol 26), with a malformed-point rejection test.
- BLOCKED on operator input: Milestone F1 (live testnet) needs the `stellar` CLI
  and a funded testnet key.
