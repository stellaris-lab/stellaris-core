# Changelog

All notable changes to the Stellaris planning workspace.
Format loosely follows Keep a Changelog. Dates are UTC.

## [Unreleased] — Implement phase

### Added: LIVE testnet e2e — mint-guard headline proven on-chain
- The full blocked -> attest -> allowed sequence ran on Stellar testnet (network
  passphrase "Test SDF Network ; September 2015"), with on-chain verification at
  every step. Evidence: docs/plan/TESTNET-E2E-EVIDENCE.md.
- Deployed contracts (real, on testnet):
  - attestation: CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H
  - guard (SolvencyGatedToken): CCXJQ77B5G7PVIOOBCWXVPERD7Q35WKDRU5744G5QA6DQX6TSYWG4OIQ
  - issuer/admin (harry): GBWD3SUGWEJWVGYB4ULLTKZWVSHDF3EP3HQWNE4Z7MTY3UX2QWTAYMGH
- Verified sequence (each confirmed by a settled read / Horizon "successful: true"):
  1. init(admin, v1 VK) -> get_admin = harry. tx 719ade49...
  2. init_v3(v3 VK) -> get_vk_v3 returns the stored VK struct. tx 57b09fc0...
  3. guard init(config, current_period=1) -> get_config returns the bound struct. tx a166daaa...
  4. BEFORE: check_mint_allowed = Error(Contract,#3) NoAttestation; get_attestation_v3 = null
     -> mint fails CLOSED, exactly as designed.
  5. attest_v3(real solvent Groth16 proof) -> AttestationRecordedV3 event,
     aggregate_solvent=true. The REAL BLS12-381 pairing check ran on-chain and
     ACCEPTED the proof. tx f39ac959...
  6. AFTER: check_mint_allowed = Ok; mint(+2,000,000) succeeds (tx 6676b00e...,
     Horizon successful:true); total_supply = 2000000, balance(issuer) = 2000000.
- This is the cryptographic + product crux proven live: a Soroban token whose mint
  is gated by a fresh, privacy-preserving solvency proof, blocked until the proof
  exists and allowed once it does.
- ENGINEERING NOTES captured from the live run (folded back into setup/testnet-deploy.sh):
  - `stellar account` does not exist in CLI 27.0.0; funding/balance is read via Horizon
    (/accounts/<addr>).
  - Spec dump is `stellar contract info interface --wasm <f>` (NOT `bindings json`).
    Empirically confirmed VK/proof fields are BytesN<96>/<192> -> bare-hex in struct-JSON
    (closes the research residual).
  - GuardConfig struct-JSON arg encoding: u64 fields (max_age_secs) are BARE numbers,
    i128 fields (supply_cap) are QUOTED strings, addresses are quoted strings. Generated
    flag is --current_period (underscore).
  - Back-to-back txns from one account hit TxBadSeq and read-after-write races; the
    hardened script now retries TxBadSeq with backoff and ASSERTS each write landed via a
    settled state read (die on failure) instead of optimistic [OK] lines that masked
    failures in the first pass.

### Added: Documentation website and integration workspace hardening
- `stellaris/` is now the Fumadocs/Next.js documentation and product landing website.
  It replaces starter content with Stellaris-specific pages: introduction, getting
  started, protocol, circuits, contracts, SDK, examples, deployment manifest,
  issuer guide, verifier guide, and security limitations.
- Docs homepage now positions Stellaris as privacy-preserving solvency proof
  infrastructure for stablecoin, RWA, and custody issuers; metadata and Turbopack
  root config are set so production builds no longer warn about `metadataBase` or
  workspace-root inference.
- `stellaris-apps/` is aligned as the integration showcase monorepo: concrete
  transport, signer, manifest loader, attestation service, registry indexer, and
  operator CLI that demonstrate how Stellaris embeds into existing systems.
- Verification gates passed after this docs/apps hardening pass: docs `bun run build`,
  apps `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (76/76),
  and core contract `cargo check`.
- Added `docs/plan/NEXT-SPRINTS-ROADMAP.md`, a detailed sprint roadmap covering
  P7 finish, docs productization, showcase apps, testnet e2e, security hardening,
  SDK DX, GTM assets, visual design, productionization, and launch packaging.
- Added `docs/plan/NEXT-SPRINTS-DEBATE.md`, an eight-perspective debate that
  stress-tests sprint order, scope, market wedge, security risks, demo strategy,
  and recommends the revised execution phases: submission readiness, technical
  credibility, then product expansion.
- Added `docs/plan/NEXT-SPRINTS-DEBATE-RESEARCH.md`, a research-grounded revision
  of the debate backed by external evidence (web search/extract, June 2026):
  Summa (PSE/Ethereum Foundation) zk-PoR sunset due to ADOPTION not crypto;
  Chainlink Proof of Reserve "Secure Mint" as the incumbent mint-guard pattern;
  Bitso's production zk-SNARK proof-of-solvency; Stellar's $3B+ RWA market
  (Franklin Templeton BENJI, Spiko, USDC/EURC/MGUSD, DTCC); and GENIUS Act + MiCA
  monthly-CPA-attestation mandates. Net plan changes: (1) lead with a Soroban
  SEP-41 mint-guard integration (the Chainlink-parity wedge), (2) move
  custodian/oracle input-binding (C2/C3) up as the credibility anchor, (3) ship
  distribution/SCF-grant narrative early to avoid the Summa "build-it-and-they-
  will-come" failure, (4) position Stellaris as a complement to CPA attestation,
  not a replacement.
- Reconciled `docs/plan/NEXT-SPRINTS-ROADMAP.md` with the research-grounded debate
  so the two no longer contradict: added a top-of-doc "Execution Priority
  (Research-Grounded)" section and a new "Sprint A — Mint-Guard Vertical Slice"
  (SEP-41/SAC token whose `mint` reverts unless a fresh, solvent attestation
  exists; includes a go/no-go design spike on the cross-contract read path).
  Rewrote the product positioning to "solvency-gated minting for Stellar RWA and
  stablecoin issuers" and reframed the input-truth limitation as a GENIUS/MiCA
  trust-boundary asset. The legacy "Fastest Public Readiness / Technical
  Credibility / Best Demo Impact" orders are now explicitly DEPRECATED (retained
  for traceability) because they front-load docs/demo polish — the Summa failure
  mode. Authoritative next step after P7 is Sprint A, starting with its spike.

### Added: Testnet sprint — guard crate-split, CLI-arg research, ready-to-run deploy
- CRATE-SPLIT DONE (the named productionization deliverable that resolves the Sprint-A
  `init` symbol collision). New standalone crate `contracts/mint-guard/` with its own
  `Cargo.toml` + `src/lib.rs`. It imports the attestation contract via
  `soroban_sdk::contractimport!(file = "../stellaris/target/wasm32v1-none/release/stellaris_contract.wasm")`
  and reads `get_attestation_v3` through the generated `attestation::Client` — a genuine
  cross-contract call, zero duplicated types. Build order: attestation WASM first, then guard.
- BOTH WASMs BUILD CLEAN for wasm32v1-none (verified):
  - `stellaris_contract.wasm` 26,822 B — full v3 ABI (init, init_v3, attest_v3, get_attestation_v3, set_oracle, set_custodian, attest_v3_signed, ...).
  - `stellaris_mint_guard.wasm` 10,629 B — exactly 8 guard entrypoints (init, mint, balance,
    get_config, total_supply, current_period, check_mint_allowed, set_current_period) and
    ZERO attestation entrypoints. The `init` collision is genuinely gone (confirmed by
    dumping the guard WASM's exported contract functions).
- OFFLINE ARG ENCODER `setup/encode-testnet-args.mjs` (no network): emits
  `build/testnet/{vk_v1,vk_v3,proof_solvent,signals_solvent}.json` with correct byte widths
  (G1=96B, G2=192B, 9 IC points for nPublic=8). It imports the byte-exact `g1ToBytes`/
  `g2ToBytes`/`fpToBytes` from the core SDK `client/dist/encoding.js` — the serializers proven
  byte-equal to the Rust on-chain ground truth in the apps suite — so the emitted bytes are
  correct by construction, not hand-rolled.
- DEEP RESEARCH on Soroban CLI complex-struct arg encoding (Stellar CLI manual, DeepWiki
  reverse-engineering of `invoke.rs`, custom-types contract guide, XDR-JSON spec). Findings in
  `docs/plan/SOROBAN-CLI-ARG-ENCODING-RESEARCH.md`: the CLI builds a per-function arg parser
  from the contract spec; complex types are spec-driven JSON (struct=object-by-field-name,
  Vec=array, BytesN=BARE hex string, U256/u64=decimal); this is DISTINCT from XDR-JSON (the
  `{"bytes":"..."}` wrapping used only by `stellar xdr`/`tx`/`lab`). `G1Affine`/`G2Affine`
  resolve to `BytesN<96>`/`BytesN<192>`. Every arg also accepts `--<name>-file-path`, the
  robust path for the ~3KB VK. Residual ~10% (G1Affine BytesN vs UDT-wrapper) is contained by
  a verify-first spec dump + the TS-codec fallback.
- READY-TO-RUN `setup/testnet-deploy.sh` (NOT executed — deploy is network-gated):
  preflight (toolchain/artifacts/encoded-args/funding) -> STEP 1 verify-first
  `stellar contract bindings json` spec dump (no spend, closes the BytesN residual) -> deploy
  both WASMs -> init(admin,v1 VK)+init_v3 -> guard init(period 1) -> mint BLOCKED (no
  attestation) -> attest_v3 (real proof) -> mint ALLOWED -> total_supply. Idempotent via
  `build/testnet/manifest.env`; pure ASCII; exposes raw CLI output; stops before any spend if
  `harry` is unfunded.
- STILL USER-GATED / NOT DONE: the live run. `harry` key exists
  (GBWD3SUGWEJWVGYB4ULLTKZWVSHDF3EP3HQWNE4Z7MTY3UX2QWTAYMGH) but funding (friendbot) and all
  `stellar` network commands were declined this session. Run `stellar keys fund harry --network
  testnet` then `bash setup/testnet-deploy.sh` to produce real contract ids + tx hashes.

### Added: Sprint A execution — solvency-gated minting (the research-grounded wedge)
- Executed the research-grounded plan in order. Sprint A spike verdict GO
  (`docs/plan/SPRINT-A-SPIKE-GONOGO.md`): the attestation contract already exposes
  `get_attestation_v3(issuer, period_id) -> Option<AttestationV3>` and the struct
  carries `aggregate_solvent`/`period_id`/`ledger_ts`/`oracle_bound`/`custodian_bound`,
  so a mint-guard reads attestation state via cross-contract call with NO ABI break.
- New `contracts/stellaris/src/mint_guard.rs`: `SolvencyGatedToken`, a SEP-41-shaped
  Soroban token whose `mint` reverts unless a FRESH, SOLVENT Stellaris attestation
  exists for the current period (Chainlink "Secure Mint" parity on Stellar, with
  private reserve composition). Guard arms: NoAttestation, NotSolvent,
  StaleAttestationPeriod, StaleAttestationAge (max_age_secs), OracleBindingRequired
  (C3), CustodianBindingRequired (C2), SupplyCapExceeded. Plus `check_mint_allowed`
  read-only dry-run, `set_current_period` (issuer-gated period rollover).
- New `contracts/stellaris/src/test_mint_guard.rs`: REAL two-contract e2e test —
  both `StellarisContract` and `SolvencyGatedToken` register as independent
  instances in one `Env`; the guard does a genuine cross-contract read of an
  attestation produced by the REAL Groth16 BLS12-381 pairing check over the real
  `SOLVENT_V3` fixture (no mock). 11 new tests; contract suite 49 -> 60/60.
- PACKAGING (honest, verified): two `#[contract]` types in one crate collide on the
  bare `init` symbol when built to `wasm32v1-none` (`error: symbol \`init\` already
  defined`). A `mint-guard` cargo feature was attempted and REMOVED — it cannot work
  because the attestation contract is always compiled, so both `init` symbols persist.
  Resolution: the guard is `#[cfg(test)]`-only, so the default deployable WASM
  (`stellaris_contract.wasm`, 26,822 bytes) is the attestation contract alone, clean.
  A standalone, deployable guard WASM genuinely requires a crate split — named as an
  explicit deliverable in `PRODUCTIONIZATION-ROADMAP.md`, deferred to the testnet
  sprint. The guard LOGIC is proven against real proofs today; independent
  deployability is NOT yet done.
- New `setup/mint-guard-demo.sh`: runnable pure-ASCII demo that exercises the real
  host-target guard tests and narrates blocked -> attest -> allowed. Runs green.
- New `docs/plan/REGULATORY-TRUST-BOUNDARY.md`: GENIUS Act + MiCA mapping; C1/C2/C3
  positioned as the on-chain analogue of the management-assertion-vs-CPA-examination
  boundary (complement to attestation, not replacement).
- New `docs/plan/SCF-GRANT-APPLICATION.md`: Stellar Community Fund application draft
  + GTM wedge (narrow persona, mint-guard demo as proof) — the distribution lever the
  Summa lesson demands.
- Docs productization around the wedge: new `stellaris/content/docs/mint-guard.mdx`
  and `mint-guard-integration.mdx` (real SDK symbols: `getAttestationV3`, real
  `AttestationV3` camelCase fields), homepage hero rewritten to the blocked->allowed
  mint story, nav rewired. Docs `bun run build` green (+10 doc paths).
- Apps as guard consumers: new `packages/common/src/guard-status.ts` —
  `evaluateGuard(attestation, policy, now)`, a PURE off-chain mirror of the on-chain
  gate (reasons kept 1:1 with `GuardError`) so dashboards preview "blocked because X"
  without a tx. 11 new tests; apps suite 76 -> 87/87, build/typecheck/lint green.
- New `docs/plan/PRODUCTIONIZATION-ROADMAP.md`: protocol freeze, the guard crate-split,
  testnet pilot, security audit, mainnet pilot — with honest done/not-done status.
- USER-GATED / NOT DONE: live testnet e2e. No `stellar-cli`/`soroban-cli` installed and
  no funded testnet account in this environment; deployment + live tx evidence await
  the user. Everything above is verified on the host target / local builds.

### Added: Milestone C execution — C2 (custodian BLS-signed reserve attestation)
- New `bls_sig.rs`: real BLS12-381 custodian-signature verification, contract-side,
  via the Soroban pairing host function. Scheme: custodian pk in G2, signature
  `sig = sk·H(reserveCommitment)` in G1, verified by
  `pairing_check([sig, -H(m)], [G2_gen, pk])` (i.e. `e(sig,G2)==e(H(m),pk)`).
  `hash_to_g1` is the host hash-to-curve; `CUSTODIAN_DST` domain-separates. The
  G2 generator is a self-checked constant (`bls_g2_generator.rs`, byte-equal to
  ark-bls12-381's canonical generator, asserted in tests).
- Contract: `set_custodian` (admin-gated, stores the G2 pubkey), `attest_v3_signed`
  (all `attest_v3` checks PLUS on-chain custodian-signature verification over the
  reserveCommitment; stamps `custodian_bound=true`), `get_custodian`. New errors
  `CustodianNotConfigured=13` / `CustodianSigInvalid=14`, new `custodian_bound`
  field on `AttestationV3`, new `DataKey::Custodian`.
- SDK: `setCustodian`/`attestV3Signed`/`getCustodian`, `custodianBound` on the
  domain type + `decodeAttestationV3`, operations-registry C2 ops,
  `ContractErrorCode` synced (13–14). Apps codec (`encodePointArg`) + mock runtime
  (custodian state, `acceptCustodianSig` predicate, `custodian_bound` logic).
- GATES MET: contract **49/49** (+5 real-BLS primitive tests: a genuine
  ark-bls12-381 signature verifies through the on-chain pairing, wrong-signer +
  tampered-commitment rejected, self-checked generator; +5 `attest_v3_signed`
  entrypoint tests: bind, wrong-signer, wrong-commitment, not-configured,
  admin-auth); apps **71/71** (+3 C2 integration tests).
- ROADMAP CORRECTION (honest): C2's original "verified inside the circuit via the
  BLS host functions" is not implementable — host functions are contract-side, not
  circom gadgets; circomlib has no BLS pairing gadget; its EdDSA-Poseidon gadget
  compiles under -p bls12381 but its BabyJubjub params are BN254-specific
  (unverified soundness). The sound, on-curve, offline reading is contract-side
  BLS — the reserve-side sibling of C3.
- Milestone C exit gate now MET (C1 multi-asset + C2 signed-custodian + C3 oracle).

### Added: Milestone C execution — C3 (designated-oracle price-commitment binding)
- Contract: `set_oracle` (admin-gated) designates a price-oracle authority;
  `publish_oracle_commitment(period, commitment)` (oracle-gated via Soroban
  `require_auth` — the oracle's keypair signing the tx IS the authentication)
  records a per-period authoritative price commitment. New `DataKey::Oracle` +
  `DataKey::OracleCommitment(period)`, errors `OracleMismatch=11` /
  `OracleNotConfigured=12`.
- `attest_v3` enhancement: if a commitment is published for the period, the
  attested `priceCommitment` MUST equal it (else `OracleMismatch`) and the
  attestation is stamped `oracle_bound=true`; otherwise prices are issuer-chosen
  and `oracle_bound=false`. New `oracle_bound` field on `AttestationV3`.
- ABI UNCHANGED: C1 already surfaced `priceCommitment` as public signal #2, so C3
  is pure contract-side enforcement — no circuit/ceremony/fixture change.
- SDK: `setOracle`/`publishOracleCommitment`/`getOracle`/`getOracleCommitment`,
  `oracleBound` on the `AttestationV3` domain type + `decodeAttestationV3`,
  operations-registry C3 ops, `ContractErrorCode` synced (9–12). Apps mock runtime
  + codec gained the C3 arms (`u256ToScVal`, oracle state, `oracle_bound` logic).
- GATES MET: contract **39/39** (+7 C3 tests incl. bound-on-match, OracleMismatch
  rejection, unbound path, not-configured, oracle-auth + admin-auth negatives,
  read-back); apps **68/68** (+4 C3 integration tests through the mock runtime).
- HONEST SCOPE: binds prices to a DESIGNATED-ORACLE authority authenticated at the
  contract boundary (Stellar keypair) — weaker than C2's in-circuit BLS signature.
  The `oracle_bound` flag makes the binding explicit (consumers requiring oracle
  pricing MUST check it); the attest-before-publish race is surfaced, not hidden.

### Added: Milestone C execution — C1 (multi-asset solvency with oracle-priced aggregate)
- Circuit (`circuits/por_v3.circom` + `components/price_commit.circom`):
  `ProofOfReservesMultiAsset(4 assets x 4 reserves, 64-bit balances, 32-bit
  prices)` — 5,496 constraints (fits 2^15 ptau, no OOM). Proves per-asset
  solvency AND oracle-priced aggregate solvency `sum_a price[a]*reserve[a] >=
  sum_a price[a]*liab[a]`. `priceCommitment = Poseidon(price[], salt)` binds the
  price vector.
- 8-signal ABI `[ aggregateSolvent, reserveCommitment, priceCommitment,
  assetSolvent[0..3], period ]`, mirrored across `PUBLIC_SIGNALS.md` /
  `types.rs` (SIG3_*) / `constants.ts` (SIGNAL_INDEX_V3_*) / `signals.ts`
  (`parsePublicSignalsV3`). Invariant #1 held.
- Ceremony + fixtures: `setup/ceremony-v3.sh` (2^15 ptau), `setup/por-v3-input.mjs`,
  `setup/por-v3-check.sh` (witness crux 18/18), `setup/export-fixtures-v3.sh` +
  `gen-contract-fixtures-v3.mjs` → three real snarkjs-verified proofs in
  `fixtures/v3/{solvent,priced_insolvent,one_asset_underwater}` (IC len 9).
- Contract (`init_v3`/`attest_v3`/`get_attestation_v3`/`get_vk_v3`, `AttestationV3`,
  `VkV3`/`AttestV3` namespaces, `parse_public_signals_v3`) — verifies real proofs
  on-chain through the D1 backend seam; aggregate must be solvent, per-asset flags
  stored for transparency. **contract 32/32** (+7 v3 tests incl. the headline
  one-asset-underwater / aggregate-solvent property + priced-insolvent rejection +
  v2/v3 isolation).
- SDK (`client/src/backend.ts` unaffected): `attestV3`/`getAttestationV3`,
  `ProofBundleV3`/`PublicSignalsV3`/`AttestationV3`, `decodeAttestationV3`,
  operations-registry v3 ops. Apps mock runtime + codec gained the v3 arms.
  **apps 64/64** (+9 v3 integration tests incl. the real-fixture underwater case).
- TRUST BOUNDARY (honest scope): the circuit proves the aggregate was computed
  with the COMMITTED prices — NOT that the prices are real. Closing that gap is
  C3 (signed price-feed); `priceCommitment` is the seam C3 plugs into.

### Added: Milestone D execution — D1 (swappable proving-backend seam)
- Contract (`contracts/stellaris/src/verifier.rs`): `VerifierBackend` trait with
  associated `Vk`/`Proof` types + a `version()` tag; `Groth16Backend` as the real
  (only) impl; `VerifierVersion` enum (Groth16=1, 0=unset) with `from_u32`/`to_u32`;
  `dispatch_verify` that activates the previously-dormant `WrongVerifierVersion`
  error before any crypto runs. `verify_proof` kept as a thin compat wrapper.
- Both `attest` and `attest_v2` (lib.rs) now verify through `dispatch_verify` with
  the Groth16 version tag — the seam is load-bearing, not dead code.
- SDK (`client/src/backend.ts`): symmetric `ProvingBackend` interface,
  `Groth16Backend` (wraps snarkjs groth16), `ProvingVersion` (mirrors the contract
  tag), `backendFor` resolver, `DEFAULT_PROVING_BACKEND`. `prove.ts`'s
  `generateProofFromInput`/`generateProofFromSnapshot`/`verifyLocal` delegate to a
  default backend (optional `backend` param; signatures backward-compatible).
- Public-signal ABI and byte encoding UNCHANGED — pure call-seam abstraction.
- GATES MET: contract **25/25** (+4 D1 seam tests: real proof verifies through the
  trait, unknown version → `WrongVerifierVersion`, wrapper/backend equivalence);
  apps **55/55** (+5 SDK seam tests incl. a custom backend injected without
  touching `prove.ts` internals). No speculative second backend shipped (YAGNI
  guardrail). HONEST SCOPE (3-reviewer debate correction): the seam abstracts the
  INTERNAL verify call + version routing only — it does NOT make the Soroban
  `attest*` entrypoints backend-polymorphic (those bind the concrete `Groth16Proof`
  type into XDR). A second backend with a different proof shape needs a new
  entrypoint or a `Bytes`-proof + discriminant, so D2/D3 are NOT just a trait impl
  + dispatch arm; the seam gives them a verification home + version tap.

### Added (P0–P2 complete: real ZK pipeline, no mocks)
- Real Groth16 trusted setup over BLS12-381 (`setup/ceremony.sh`): compiles
  `circuits/por.circom` (2084 non-linear constraints) and runs powers-of-tau →
  groth16 setup → `build/por_final.zkey` + `build/verification_key.json`.
- Real proof fixtures (`setup/export-fixtures.sh`): solvent / insolvent /
  boundary proofs in `fixtures/`, each verified by `snarkjs groth16 verify`.
- `setup/gen-contract-fixtures.mjs` → `contracts/stellaris/src/test_fixtures.rs`:
  data-only codegen of the real VK + proofs (no Rust JSON deps needed offline).
- `client/scripts/prove-check.mjs`: SDK self-test that runs the real
  `generateProofFromSnapshot` → `verifyLocal` path against the real artifacts.

### Added: Milestone B execution — B3/B-P6 verifier leg (REAL inclusion proof)
- `setup/inclusion-prove.sh`: generates a REAL Groth16 per-user inclusion proof
  (depth-4) and verifies it against the ceremony VK (`build/v2/inclusion_vk.json`,
  snarkjs `OK!`). Artifacts: `fixtures/v2/inclusion/{proof,public,
  verification_key_inclusion}.json`.
- THE TIE: the inclusion proof's public `rootHash`/`total` are byte-equal to the
  solvency fixture's `liabRoot`/`liabTotal` (4676714…347 / 4300) — a user proves
  inclusion against the SAME root the issuer attested.
- SOUNDNESS: forged `wrong_balance` + `corrupted_sibling` claims both fail
  witness calculation against the inclusion circuit.
- `circuits/agg_spike_repo.circom` (depth-4 ground-truth Poseidon); parameterized
  `agg-input.mjs` (leaf count) + `inclusion-witness.mjs` (depth) so the same
  extract-from-witness path feeds both the depth-8 soundness gate and the depth-4
  proof. No circomlibjs/BN254 dependency (B-P1 pattern).
- Fixed a pre-existing dev-gate drift: `setup/por-v2-check.sh` compiled the
  depth-8 `por_v2.circom` but fed a depth-4 input (witness error); realigned to
  the depth-4 `por_v2_repo.circom` + `liabTotal=4300` to match the ceremony,
  fixtures, and contract/apps tests. Gate now PASS.
- UNBLOCKED note: this leg was reported blocked on a BLS12-381 off-chain Poseidon;
  the v2 ceremony producing `inclusion_final.zkey` made a real proof possible
  offline. Only the pure-TS `liabilities.ts` tree builder (root from scratch in
  TS) remains gated on an installable BLS Poseidon; the proof path is exercised.

### Added: Milestone B execution — B-P6 (v2 example-app surface + mock runtime)
- SDK v2 signal layer: `parsePublicSignalsV2`/`encodePublicSignalsV2`,
  `N_PUBLIC_SIGNALS_V2=5`, `SIGNAL_INDEX_V2_*` — mirrors the on-chain
  `parse_public_signals_v2` (5-signal `[solvent, reserveCommitment, liabRoot,
  liabTotal, period]`).
- Apps mock runtime: `MockSorobanTransport` now mirrors the v2 contract state
  machine (`init_v2`/`attest_v2`/`get_attestation_v2`/`get_vk_v2`) with the full
  NotInitialized/NotSolvent/PeriodAlreadyAttested/ProofInvalid/Unauthorized gating
  and v1/v2 store isolation; `makeProofBundleV2Fixture` + `attestationV2Count()`/
  `getVkV2State()` inspection helpers.
- `integration-v2.test.ts` drives the REAL depth-4 snarkjs fixtures
  (`fixtures/v2/{solvency,insolvent}`) through the full `client.attestV2()` →
  transport → mock-contract path. **apps 50/50** (+8 v2 integration tests).
- The user-verifies-inclusion leg is now DONE — see the "B3/B-P6 verifier leg"
  entry above (real Groth16 inclusion proof, root-tied to the attested liabRoot).
  Only the pure-TS `liabilities.ts` tree builder remains gated on a BLS Poseidon.

### Added: Milestone B execution — B-P5 (SDK + transport v2 path)
- SDK: `StellarisClient.attestV2()`/`getAttestationV2()`, `AttestationV2` /
  `ProofBundleV2` / `PublicSignalsV2` domain types, `decodeAttestationV2`, and the
  operations registry v2 ops (`init_v2`/`attest_v2`/`get_attestation_v2`/`get_vk_v2`).
- Transport: `StellarisContractCodec` gains the `attest_v2`/`init_v2`/`get_*_v2`
  arms (same proof ScMap + Vec<U256>; 5 signals). `attest-v2-e2e.test.ts` proves
  `client.attestV2()` produces byte-identical on-chain proof bytes for the 5-signal
  statement. **apps 42/42** (2 new v2 e2e tests).
- DEFERRED (blocked offline): `liabilities.ts` Merkle-sum tree builder +
  `liability-prove.ts` per-user inclusion proof need a BLS12-381 off-chain Poseidon;
  circomlibjs is BN254-only. The v2 attest path doesn't need it (the snarkjs proof
  carries the circuit-computed root/total); the tree builder is a user-facing add-on.

### Added: Milestone B execution — B-P2..B-P4 (circuit crux + attack defense + contract v2)
- **B-P2 (solvency-v2 circuit):** `circuits/por_v2.circom` binds `sum(reserve) >=
  liabTotal` where `liabTotal` is the SNARK-bound Merkle-sum root total — NOT a
  trusted scalar. 5-signal ABI `[solvent, reserveCommitment, liabRoot, liabTotal,
  period]`. `setup/por-v2-check.sh`: witness proves solvent=1, liabTotal from the
  tree; liabRoot matches the standalone B-P1 tree root.
- **B-P3 (attack defense, headline):** `setup/liability-attack-check.sh` — a leaf
  balance `2^64` fails at `Num2Bits` (T2/T3); honest control proves. T1 (forged
  internal sum) is defended STRUCTURALLY: `por_v2` recomputes every node sum from
  leaves in-circuit, so there is no witness slot to forge. 2/2.
- **B-P4 (contract v2):** additive `attest_v2`/`init_v2`/`get_attestation_v2`,
  `VkV2`/`AttestV2` storage, `AttestationV2`, and `parse_public_signals_v2`
  (5-signal, `liab_root` kept full-width U256). Real depth-4 proofs
  (`setup/ceremony-v2.sh` 2^15 ptau, `export-fixtures-v2.sh`,
  `gen-contract-fixtures-v2.mjs` → `test_fixtures_v2.rs`). **`cargo test` 18/18**
  (11 v1 untouched + 7 v2): real on-chain BLS12-381 pairing over the v2 statement;
  solvent stores proven `liab_total`; insolvent → `NotSolvent`; replay blocked; a
  v1 proof is rejected by `attest_v2` (IC arity guard). In-repo ceremony is depth-4
  (the depth-8/2^19 setup OOM'd a 15Gi box); the contract path is depth-agnostic,
  so production scale is a heavier-ceremony / recursion concern (ROADMAP E), not a
  statement change.

### Added: Milestone B execution — B-P0 + B-P1 (circuit layer, real & verified)
- `circuits/components/merkle_sum_node.circom`, `merkle_sum_root.circom`,
  `merkle_sum_inclusion.circom`: the Merkle-sum (Maxwell) tree primitives —
  constrained `sum = sumL + sumR`, range-checked partial sums, Poseidon-4 node
  hash, and a per-user inclusion path routed by boolean direction bits.
- **B-P0 (constraint sizing, MEASURED):** compiled real trees and measured
  scaling — depth 2/3/4/6/8 = 5,090 / 10,985 / 22,776 / 93,526 / 376,532
  constraints (~1,474/leaf). v1 target depth=8 (256 users) → 2^19 ptau;
  depth=10 (1024) → ~1.51M → 2^21 (the plan's 2^20 estimate was corrected by
  measurement). Witness check: 4-leaf `[1000,2000,3000,4000]` → total=10000 exact.
- **B-P1 (inclusion soundness, VERIFIED):** `setup/inclusion-check.sh` +
  `client/scripts/{inclusion-witness,agg-input}.mjs` — a real depth-8 inclusion
  path proves; a wrong-balance claim and a corrupted sibling both fail to produce
  a witness. 3/3. Discovered + documented the critical trap: `circomlibjs` is
  BN254-only and cannot reproduce the BLS12-381 in-circuit Poseidon; the
  offline-correct ground truth is the aggregation circuit's own witness.

### Added: Milestone B file-level RPD plan (proof of liabilities)
- `docs/plan/06-MILESTONE-B-PROOF-OF-LIABILITIES-RPD.md` (543 lines): fully
  detailed Role/Public-API/Detailed-flow plan to replace the trusted
  `liabilities_in` scalar with a SNARK-proven Merkle-sum (Maxwell) liability
  tree. Covers a 6-point threat model (forged internal sums, negative/wraparound
  balances, sum overflow, inclusion forgery, cross-period replay, unit mismatch),
  the cryptographic design (Poseidon-4 sum nodes, range-checked partial sums),
  and file-level RPD for every new/changed file across circuit / contract / SDK /
  setup layers. Includes a 7-phase build-first execution sequence (B-P0..B-P6)
  with per-phase exit gates, an 8-row positive/negative test matrix, and an
  explicit honest-boundary scope note. v2 is additive (parallel `attest_v2`, VkV2,
  5-signal ABI) so the existing 11 v1 contract tests stay green.

### Added: protocol roadmap + circuit soundness hardening (Milestone A)
- `docs/ROADMAP.md`: native-first evolution roadmap grounded in the verified 2026
  Soroban ZK surface (CAP-0059 BLS12-381 host fns + `be_bytes(c1)||be_bytes(c0)`
  Fp2 order, Protocol 25 PLONK/PQ, CAP-0080 `is_on_curve`) and the proof-of-
  solvency literature. Milestone ladder A–F attacks the trusted-`liabilities_in`
  boundary toward real proof-of-liabilities (Merkle-sum), multi-asset + custodian-
  signed inputs, proving-system evolution, recursion, and live-network hardening.
- `setup/negative-witness-check.sh` (A2): adversarial witness tests — a forged
  negative balance, a 2^64 balance overflow, and a 2^68 liability overflow each
  yield NO satisfiable witness (snarkjs fails at the `Num2Bits` constraint); a
  control input still proves. 4/4. Proves the range checks are load-bearing.
- `setup/commitment-binding-check.sh` (A3): perturbing any reserve slot
  (0/1/7/15) changes the Poseidon commitment; identical input is deterministic.
  5/5. Proves the commitment binds the exact reserve vector.

### Fixed: proof-encoding split-brain — single shared converter now in SDK core
- The byte-exact BLS12-381 serializer is now `client/src/encoding.ts` in the SDK
  core (`@stellaris/por-sdk`), the single shared converter invariant #2 requires.
  `codec.ts` gains `bundleToContractBytes` (G1 96B / G2 192B / U256 32B).
- `stellar.ts#attest` previously emitted decimal `{a,b,c}` tuples that the
  transport's contract codec (which expected the snarkjs `{pi_a,pi_b,pi_c}` shape)
  could NOT encode — the SDK→transport→codec path was disconnected and would have
  thrown on a real submit. `attest` now submits `bundle.proof` directly, which the
  codec serializes through the shared SDK encoder.
- `stellaris-apps/.../proof-codec.ts` is now a THIN ADAPTER delegating to the SDK
  encoder (no duplicated field math). New `attest-e2e.test.ts` proves
  `client.attest()` → codec produces byte-identical on-chain proof bytes.
- Verified: SDK encoder self-test (`client/scripts/encoding-check.mjs`) byte-equal
  to Rust ground truth; contract 11/11; apps 40/40; biome clean.

### Closed: proof/VK byte-encoding boundary (cross-file invariant #2)
- `stellaris-apps/packages/soroban-transport/src/proof-codec.ts`: zero-dependency
  BLS12-381 serializer producing the exact bytes the on-chain verifier consumes —
  G1 = 96B `X(48)||Y(48)` big-endian; G2 = 192B with each Fp2 written `c1||c0`
  (high coefficient first), so the snarkjs `[c0,c1]` order is SWAPPED within each
  pair. Discovered + locked via a byte-for-byte test against Rust ground truth
  (`test/proof-codec.test.ts`): the naive "no swap" mapping was wrong and would
  have silently failed the on-chain pairing check.
- `contract-codec.ts` (`StellarisContractCodec`): assembles the real `attest`
  call — `Groth16Proof` as an ScMap (sorted keys a/b/c → ScBytes 96/192/96),
  `pub_signals` as ScVec of ScU256. Now the default codec in `SorobanRpcInvoker`,
  replacing the `DefaultScValCodec` that threw on proof arguments. Validated in
  `test/contract-codec.test.ts` (ABI shape, U256 round-trip, deterministic XDR).

### Changed
- `contracts/stellaris/src/test.rs` now verifies REAL Groth16 proofs through the
  on-chain BLS12-381 pairing check (11 tests pass). The mock verification key is
  removed. snarkjs decimal coords → Soroban G1/G2 via ark-bls12-381
  `serialize_uncompressed`, matching `vendor/.../groth16_verifier`.
- `types.rs`: `Attestation` derives `PartialEq`.

### Fixed
- `circuits/components/commit.circom`: `Poseidon(n+1)` with n=16 exceeded
  circomlib's 16-input limit (out-of-bounds `N_ROUNDS_P`). Replaced with a sound
  two-level Poseidon (`Poseidon(16)` over balances, then `Poseidon(2)` binding
  the salt). This was a hard blocker — no proof could be generated before.
- `setup/ceremony.sh` / `export-fixtures.sh`: circom 2.2.x uses `-p bls12381`
  (not `--curve`); added `-l` circomlib include path; strip non-signal
  `description` key from inputs before witness calculation.

## [0.3.0] — 2026-06-23 — Plan audit and development playbook
### Added
- `plan/04-PLAN-AUDIT-AND-FIXES.md` — formal review of the existing plan against
  completed research, competitor findings, Circom/snarkjs public-signal behavior,
  and Stellar verifier encoding risk.
- `plan/05-DEVELOPMENT-PLAYBOOK.md` — minor-step implementation checklist from
  P0 through final submission, with file writes, commands, expected outputs,
  failure handling, and acceptance criteria.

### Changed
- `plan/00-RPD-OVERVIEW.md` now includes the market-backed pitch after competitor
  research and points developers to the playbook as authoritative.
- `plan/01-CIRCUIT-RPD.md` now treats `[solvent, C, L, period_id]` as desired
  product order, but requires generated `public.json` / `.sym` to define the
  actual contract/client constants.
- `plan/02-CONTRACT-RPD.md` now requires explicit parsing/overflow validation for
  public signals and treats commitment storage type as provisional until P0/P1.
- `plan/03-CLIENT-RPD.md` now follows generated `PUBLIC_SIGNALS.md` instead of a
  hard-coded assumed order.
- `AGENTS.md` updated with v0.3 plan gate and generated-public-signal invariant.

## [0.2.1] — 2026-06-22 — Competitor research update
### Added
- `research/05-COMPETITOR-DEEP-DIVE.md` — direct hackathon visibility check,
  category map, Stellar Private Payments, SAK, Binance zk-SNARK PoR, Chainlink
  PoR, and ecosystem privacy-stack analysis.
- `strategy/COMPETITOR-IMPLICATIONS.md` — pitch/scope changes based on the
  competitor pass.

### Confirmed
- Stellaris remains the lead idea. Competitor evidence strengthens the market
  demand argument: Chainlink and Binance validate proof-of-reserves as a real
  category, while direct Stellar Hackathon submissions remain private.

## [0.2.0] — 2026-06-22 — Plan + hardening
### Added
- `plan/00-RPD-OVERVIEW.md` — standards, architecture, repo layout, 8 phases,
  risk register.
- `plan/01-CIRCUIT-RPD.md` — range/sum/commit subcircuits, por.circom, trusted
  setup + vk export.
- `plan/02-CONTRACT-RPD.md` — Soroban verifier glue + attestation registry +
  anti-replay + unit tests.
- `plan/03-CLIENT-RPD.md` — WASM client proving, isolated chain module, issuer
  UI, e2e smoke script.
- `strategy/JUDGE-QA.md` — hostile Q&A with honest answers.
- `strategy/FEASIBILITY-AUDIT.md` — MVP acceptance, scope cuts, demo-risk table,
  primitive-dependency table.
- `strategy/DEMO-SCRIPT.md` — 2:45 video beat sheet + fallback path.
- `strategy/PLAN-COMPANION.html` — self-contained visual plan (phases, risk
  matrix, idea comparison, copy/export kickoff prompt).
- `AGENTS.md` — build conventions + cross-file invariants.

### Decided
- Lead idea: Stellaris (ZK Proof-of-Reserves) over Clearpath / Provenance /
  GateProof. Framework: Circom Groth16 (cheapest verify, best-documented path).

## [0.1.0] — 2026-06-22 — Research
### Added
- `README.md` — workspace index + evidence legend.
- `research/00-RESEARCH-BRIEF.md` — hackathon facts, ~7-day window, judging
  signals, constraints.
- `research/01-TECH-LANDSCAPE.md` — ZK host functions, three frameworks,
  ready-to-clone verifiers, cost notes.
- `research/02-COMPETITIVE-GAPS.md` — crowded forks to avoid, white-space gaps.
- `research/03-IDEA-CANDIDATES.md` — 4 problem-first wedges scored on wedge
  confidence + moat + feasibility.
- `research/04-RECOMMENDATION.md` — Stellaris recommendation + 7-day build path.

### Sourced (VERIFIED)
- DoraHacks detail/resources/ideas pages; Stellar ZK + Privacy docs; CAP-0074/
  0075/0059; DoraHacks judging guides; James Bachini Circom-on-Stellar tutorial.
