# Stellaris Next Sprints Roadmap

This roadmap covers the next execution sprints for the Stellaris ecosystem after the current P7 hardening pass.

## Current Baseline

Repositories:

- `stellaris-core/` — protocol core: circuits, Soroban contract, SDK, fixtures, tests.
- `stellaris/` — Fumadocs/Next.js documentation and product landing website.
- `stellaris-apps/` — integration showcase monorepo: transport, signer, manifest loader, attestation service, registry indexer, operator CLI, and future visual apps.

Current verified gates:

- Docs: `cd stellaris && bun run build`
- Apps: `cd stellaris-apps && npm run build && npm run typecheck && npm run lint && npm test`
- Core contract: `cd stellaris-core/contracts/stellaris && cargo check`

Product position (research-grounded, 2026-06-29):

> Stellaris is solvency-gated minting infrastructure for Stellar RWA and
> stablecoin issuers, with private reserve composition. An issuer's Soroban
> token refuses to mint beyond a fresh, privacy-preserving Stellaris solvency
> attestation for the period.

The earlier framing ("a productized protocol SDK for privacy-preserving issuer
solvency attestations on Stellar") is retained as the underlying capability, but
the front-of-plan WEDGE is the mint-guard, not a generic attestation SDK. See
`docs/plan/NEXT-SPRINTS-DEBATE-RESEARCH.md` for the evidence (Summa sunset,
Chainlink Secure-Mint, Bitso production zk-PoS, Stellar $3B+ RWA, GENIUS/MiCA).

Core limitation to keep visible (now framed as a regulatory trust-boundary asset):

> Stellaris proves solvency over supplied inputs. Production deployments must bind
> those inputs to custodians, oracles, auditors, regulated feeds, or treasury
> systems. Under GENIUS/MiCA this is the same boundary regulators draw between a
> management assertion and CPA examination: the CPA still certifies the inputs;
> Stellaris makes the in-between continuously, cryptographically verifiable. C2
> (custodian BLS signature) and C3 (oracle price commitment) are the on-chain
> input-attestation analogues.

---

## Execution Priority (Research-Grounded — supersedes the legacy Sprint 0-9 order below)

The legacy sprint numbering (Sprint 0-9) and the three "Recommended Execution
Orders" at the foot of this document were written from reasoning alone. After
external research (`NEXT-SPRINTS-DEBATE-RESEARCH.md`) the ordering changed: the
binding constraint is distribution + a real integration, NOT docs/demo polish.
Summa — an EF-funded, cryptographically superior zk-PoR — died precisely because
it shipped polish without a distribution wedge. Do NOT repeat that.

Authoritative order (each maps to a sprint section in this doc unless marked NEW):

1. **Sprint A — Mint-guard vertical slice (NEW, highest priority).** Reference
   SEP-41/SAC Soroban token whose `mint` reverts unless a fresh, solvent Stellaris
   attestation exists for the period. Testnet end-to-end: mint blocked -> re-attest
   -> mint allowed. Detailed below in "Sprint A".
2. **Live testnet e2e** — legacy Sprint 3 (real contract id, attestation, manifest,
   explorer links; prerequisite to make Sprint A demonstrable).
3. **Regulatory trust-boundary + security mapping** — legacy Sprint 4, elevated
   (one-page GENIUS/MiCA mapping; C2/C3 as input-attestation analogues).
4. **SCF grant application + GTM wedge** — legacy Sprint 6, elevated (Stellar
   Community Fund, up to $150k/4wks; narrow persona; mint-guard demo as proof).
5. **Documentation productization** — legacy Sprint 1, rewritten around the
   mint-guard story and regulatory framing rather than generic PoR.
6. **Demo/launch package** — legacy Sprint 9, canonical demo = blocked-then-allowed
   mint.
7. **SDK DX** — legacy Sprint 5, lead with the mint-guard integration recipe.
8. **Showcase apps** — legacy Sprint 2, now consumers of a proven mint-guard.
9. **Visual/brand system** — legacy Sprint 7.
10. **Productionization roadmap** — legacy Sprint 8 (audit, mainnet pilot).

Sprint 0 (P7 finish) remains the immediate stabilization gate before Sprint A.

---

## Sprint A — Mint-Guard Vertical Slice (NEW — highest post-P7 priority)

**Goal:** Turn the passive attestation into an enforcement primitive: a Soroban
token whose issuance is gated by a fresh, solvent Stellaris attestation. This is
the Chainlink-parity wedge (their "Secure Mint") adapted to Stellar + privacy.

**Duration:** 5-9 days (includes a design spike — see risk below).

### Deliverables

- Reference SEP-41 Soroban token (plus a SAC-adapter note for classic assets).
- `mint` path reads the latest Stellaris attestation for the current period and
  reverts on: no attestation, stale period, `solvent=false`, or aggregate
  insolvency (v3 priced multi-asset).
- Testnet end-to-end script: attempt over-mint (blocked) -> re-attest with solvent
  snapshot -> same mint succeeds. Pure-ASCII demo output per project convention.
- Integration tests through the mock runtime mirroring the testnet flow.
- A <=15-line "drop into your existing token" integration snippet.

### Design Spike (do FIRST — this is asserted, not verified)

The D1 seam analysis in `CHANGELOG.md` warns the `attest*` entrypoints bind the
concrete `Groth16Proof` type into XDR; a mint-guard that READS attestation state
should not need an ABI break, but confirm before building:

1. Confirm the contract exposes a read path (`get_attestation_v3` / period lookup)
   the token contract can cross-contract-call cheaply on Soroban.
2. Confirm staleness can be enforced (period id vs current ledger/period) without
   new circuit signals — period is already public signal, so this should hold.
3. If a cross-contract read is too expensive or unavailable, fall back to a
   guard that requires the mint caller to submit the fresh attestation reference
   and verifies it inline.

Acceptance of the spike: a written go/no-go in the PR description naming the exact
cross-contract call and gas/fee cost, before the token contract is written.

### Acceptance Criteria

- Testnet: an over-mint transaction REVERTS with a typed error; after re-attesting
  a solvent snapshot, the identical mint SUCCEEDS — both shown with tx hashes and
  explorer links.
- No ABI break to the existing v1/v2/v3 attestation entrypoints (or, if a break is
  unavoidable, it is documented and versioned per the cross-file invariants).
- Mock-runtime tests reproduce blocked + allowed paths.
- Integration snippet compiles.

### User Inputs Needed

- Mint-guard target: fresh SEP-41 reference token, SAC wrapper over a classic
  asset, or both (recommended: SEP-41 reference + SAC adapter note).
- Synthetic issuer fixture first, or hold for a named design partner (recommended:
  synthetic first, then outreach with the working demo).

---

## Sprint 0 — P7 Final Submission Hardening

**Goal:** Make the current ecosystem submission-ready, coherent, and honestly scoped.

**Duration:** 1-2 days.

### Deliverables

- Final docs build passes.
- Final apps build, typecheck, lint, and tests pass.
- Final core contract check passes.
- README/docs explain the three-repo architecture clearly.
- Public narrative is consistent across docs, apps, and core.
- Limitations are explicit and impossible to miss.

### Tasks

1. Run final verification gates:
   - `cd stellaris && bun run build`
   - `cd stellaris-apps && npm run build && npm run typecheck && npm run lint && npm test`
   - `cd stellaris-core/contracts/stellaris && cargo check`
2. Verify terminology:
   - no active stale `Attestor` naming,
   - `Stellaris` used for product/protocol,
   - `attestation` retained only as domain language.
3. Polish docs homepage:
   - problem,
   - protocol,
   - SDK,
   - examples,
   - limitations.
4. Add final limitations callouts:
   - not audited,
   - testnet/prototype scope,
   - demo trusted setup,
   - proof binds arithmetic over supplied inputs, not independent bank truth.
5. Prepare short demo flow:
   - load or generate snapshot,
   - produce proof,
   - submit attestation,
   - query issuer status,
   - show verifier/auditor read path.

### Acceptance Criteria

- All commands pass.
- A new technical reviewer understands the system in under 5 minutes.
- A non-technical reviewer understands the product problem in under 2 minutes.
- Security limitations are explicit.
- The project feels like one ecosystem, not three disconnected repos.

### User Inputs Needed

- Submission target: hackathon, public GitHub release, investor demo, grant review, or all.
- Whether video/script/screenshots are required.

---

## Sprint 1 — Documentation Productization

**Goal:** Turn `stellaris/` into the public explanation layer for the protocol and product.

**Duration:** 3-5 days.

### Deliverables

- Complete docs navigation.
- Strong product homepage.
- Architecture overview.
- Protocol flow diagrams.
- SDK quickstart.
- Examples overview linked to `stellaris-apps`.
- Roadmap and FAQ.
- Security and limitations page.

### Recommended Docs Tree

```txt
content/docs/
  index.mdx
  why-stellaris.mdx
  market-gap.mdx
  architecture.mdx
  protocol.mdx
  circuits.mdx
  contracts.mdx
  sdk.mdx
  deployment-manifest.mdx
  examples.mdx
  issuer-guide.mdx
  verifier-guide.mdx
  auditor-guide.mdx
  security-limitations.mdx
  roadmap.mdx
  faq.mdx
  meta.json
```

### Core Pages

#### Introduction

Must explain:

- what Stellaris is,
- who uses it,
- what it proves,
- what it does not prove,
- how the repos fit together.

#### Why Stellaris

Must explain:

- reserve transparency problem,
- privacy tradeoff in traditional proof-of-reserves,
- why on-chain attestations help,
- why Stellar/Soroban is a good venue.

#### Architecture

Must include:

```txt
Issuer Systems
  |
  | private reserve snapshot
  v
Local Prover
  |
  | proof + public signals
  v
Stellaris SDK
  |
  | Soroban transaction
  v
Stellaris Contract
  |
  | verified attestation
  v
Registry / Indexer / Dashboard
```

#### Protocol

Must cover:

- private reserve vector,
- public liabilities,
- reserve commitment,
- reporting period,
- non-replayable attestation,
- contract verification.

#### Security & Limitations

Must cover:

- trusted setup,
- input truth gap,
- key management,
- contract/circuit audit status,
- demo vs production gap,
- custodian/oracle production bindings.

### Acceptance Criteria

- Docs build passes.
- Navigation is complete and logical.
- Homepage alone explains the product.
- Technical docs are clear enough for SDK adoption.
- Limitations are honest enough for serious review.

### User Inputs Needed

- Preferred docs tone:
  - institutional/professional,
  - hackathon/demo,
  - developer-first,
  - investor/product.
- Public GitHub org/repo URL.
- Deployment domain if known.

---

## Sprint 2 — Example Apps Showcase Layer

**Goal:** Make `stellaris-apps/` visibly demonstrate real integrations.

**Duration:** 5-8 days.

### Deliverables

- Keep existing backend/operator services.
- Add visual showcase apps.
- Add shared demo data.
- Add app-level READMEs.
- Add screenshot-ready flows.

### Recommended Workspace Shape

```txt
stellaris-apps/
  apps/
    issuer-portal/
    verifier-dashboard/
    rwa-treasury/
    attestation-service/
    registry-indexer/
    operator-cli/
  packages/
    common/
    soroban-transport/
    keypair-signer/
    manifest-loader/
    demo-data/
    ui/
```

> STATUS (verified 2026-06-30 — this is the PLANNED shape, not current reality).
> Built and passing today (92/92 tests, 12 suites): `packages/{common,
> soroban-transport, keypair-signer, manifest-loader}` and `apps/{attestation-service,
> registry-indexer, operator-cli}` — all backend/CLI, no UI. NOT YET BUILT: the three
> visual apps (`issuer-portal`, `verifier-dashboard`, `rwa-treasury`) and the
> `packages/{demo-data,ui}` shared layers. The visual apps are the largest open
> Sprint-2 deliverable; do not represent them as existing in any submission.

### App 1 — Issuer Portal

Purpose:

- Show how an issuer prepares and submits a solvency attestation.

Features:

- issuer profile card,
- reserve snapshot fixture selector,
- liabilities input,
- proof generation step,
- attestation submission step,
- latest attestation status,
- history table,
- stale/duplicate/insolvent state handling.

Acceptance criteria:

- Runs locally.
- Uses shared SDK/types.
- Starts with mock transport.
- Can later switch to testnet manifest.

### App 2 — Verifier Dashboard

Purpose:

- Show how a user, exchange, wallet, or auditor checks an issuer.

Features:

- issuer search,
- latest status,
- period timeline,
- liabilities,
- reserve commitment,
- proof version,
- oracle-bound flag,
- custodian-bound flag,
- freshness warning.

Acceptance criteria:

- Reads from registry/indexer or mock registry.
- Shows clear risk states.
- Avoids overclaiming.

### App 3 — RWA Treasury Demo

Purpose:

- Demonstrate multi-asset collateralization and priced aggregate solvency.

Features:

- asset buckets,
- private reserves visualized abstractly,
- public liabilities,
- price commitment,
- aggregate solvency status,
- one-asset-underwater but aggregate-solvent scenario,
- priced-insolvent scenario.

Acceptance criteria:

- Demonstrates v3 multi-asset behavior.
- Explains price oracle trust boundary.
- Links to security limitations.

### Acceptance Criteria For Sprint

- At least one visual app is complete enough for screenshots.
- Backend/operator services remain passing.
- Shared packages prevent duplicated protocol logic.
- README explains how to run each app.

### User Inputs Needed

- First visual app priority: issuer portal, verifier dashboard, or RWA treasury.
- Mock-first or testnet-first.
- Visual style: institutional fintech, Stellar-native, cryptography lab, or bold demo.

---

## Sprint 3 — Live Testnet Deployment And End-To-End Flow

**Goal:** Produce a public Stellar testnet attestation and read it back through the SDK/apps.

**Duration:** 4-7 days.

### Deliverables

- Contract built for Soroban.
- Contract deployed to testnet.
- Verification key initialized.
- Deployment manifest generated.
- SDK reads deployment manifest.
- CLI or backend submits attestation.
- Verifier reads attestation from testnet.
- Docs include deployment details.

### Tasks

1. Check toolchain:
   - Stellar CLI installed,
   - Rust target ready,
   - Soroban SDK version compatible,
   - testnet account funded.
2. Build contract:
   - `stellar contract build`
3. Deploy contract:
   - `stellar contract deploy ...`
4. Initialize contract:
   - admin,
   - verification key,
   - verifier version,
   - optional oracle/custodian config.
5. Generate manifest:
   - contract id,
   - network passphrase,
   - RPC URL,
   - verification key hash,
   - artifact paths,
   - public signal ABI.
6. Wire apps to manifest.
7. Submit test attestation.
8. Query latest issuer status.
9. Record tx hashes and explorer links.

### Acceptance Criteria

- Real testnet contract id exists.
- Real testnet attestation exists.
- Apps or CLI can read it.
- Docs link to manifest and tx evidence.
- Demo script includes live evidence.

### Risks

- Stellar CLI version mismatch.
- Soroban SDK incompatibility.
- WASM size or fee issue.
- RPC instability.
- Auth/key setup problems.
- Verification key initialization errors.

### User Inputs Needed

- Confirm Stellar CLI installed.
- Confirm funded testnet admin/issuer account.
- Confirm whether demo keys can be generated locally.
- Confirm whether deployment information should be published.

---

## Sprint 4 — Security, Trust Binding, And Audit Readiness

**Goal:** Make the protocol's trust model clear and improve production readiness.

**Duration:** 5-10 days.

### Deliverables

- Threat model.
- Security model.
- Input provenance model.
- Custodian-binding documentation.
- Oracle-binding documentation.
- Key-management guidance.
- Audit checklist.
- Risk register.

### Threat Categories

- false reserve inputs,
- stale attestations,
- replayed periods,
- compromised issuer key,
- malicious issuer,
- malicious oracle,
- custodian equivocation,
- wrong manifest,
- circuit/contract ABI drift,
- trusted setup compromise,
- verifier UI misinterpretation.

### Technical Hardening Tasks

- Add manifest hash.
- Add artifact hash validation.
- Publish verification key hash.
- Add versioned deployment manifest.
- Add KMS/HSM signer abstraction plan.
- Add structured audit logs.
- Add redaction policy.
- Add service config validation.
- Add rate-limit guidance.
- Add production secrets guidance.

### Acceptance Criteria

- Serious reviewer understands trust assumptions.
- No docs claim that Stellaris independently proves bank balances.
- Production-readiness gaps are visible and tracked.
- Security docs are linked from homepage/docs.

### User Inputs Needed

- Target primary buyer/user:
  - stablecoin issuer,
  - RWA issuer,
  - custodian,
  - auditor,
  - developer/judge.
- Preferred level of formality: formal threat model or simpler product language.

---

## Sprint 5 — SDK Developer Experience

**Goal:** Make external SDK adoption easy.

**Duration:** 5-8 days.

### Deliverables

- SDK quickstart.
- API reference.
- Error guide.
- Manifest guide.
- Transport guide.
- Signer guide.
- Reconciler guide.
- Mock runtime guide.
- Compilable examples.

### Example Flows

- Node backend attestation.
- Next.js server action.
- CLI attestation script.
- Registry indexer job.
- Verifier dashboard fetch.
- Issuer attestation cron.

### SDK Quality Tasks

- Verify clean package exports.
- Ensure docs snippets compile or are marked pseudocode.
- Document typed errors.
- Document mock vs real transport.
- Add troubleshooting section.
- Add version compatibility table.

### Acceptance Criteria

- Developer can build a basic backend integration in under one hour.
- Common errors are understandable.
- Mock and real deployment paths are clearly separated.
- Examples remain tested.

### User Inputs Needed

- Confirm package names:
  - `@stellaris-lab/por-sdk`,
  - `@stellaris-apps/*`.
- Confirm whether packages will be published to npm or kept local.

---

## Sprint 6 — Market Positioning And Go-To-Market Assets

**Goal:** Make Stellaris understandable to non-technical decision makers.

**Duration:** 3-6 days.

### Deliverables

- One-page product narrative.
- Problem/solution page.
- Competitor comparison.
- Use-case pages.
- Demo deck outline.
- FAQ.
- Launch checklist.

### Positioning

Category:

- privacy-preserving solvency attestation infrastructure.

Initial wedge:

- proof-of-reserves for Stellar issuers.

Potential users:

- stablecoin issuers,
- RWA platforms,
- custodians,
- exchanges,
- auditors,
- wallets,
- compliance teams.

Differentiation:

- on-chain verification,
- private reserve composition,
- SDK-first architecture,
- Soroban-native integration,
- extensible custodian/oracle trust bindings.

### Acceptance Criteria

- Product story works without reading code.
- Market gap is clear.
- Technical claims remain accurate.
- Roadmap feels credible.

### User Inputs Needed

- Main target audience: judges, grant reviewers, investors, developers, or first issuer users.

---

## Sprint 7 — Visual Design And Brand System

**Goal:** Make public-facing surfaces look polished, credible, and intentional.

**Duration:** 4-7 days.

### Deliverables

- Visual identity direction.
- Homepage polish.
- Docs component styling.
- Diagram style.
- App UI system.
- Screenshot set.
- Mobile responsiveness pass.

### Recommended Direction

- institutional fintech infrastructure,
- light and crisp,
- slate/navy base,
- amber/gold reserve accents,
- blue/cyan cryptographic verification accents,
- avoid generic purple crypto gradients.

### Components

- hero section,
- attestation card,
- solvency status badge,
- proof-flow diagram,
- issuer timeline,
- risk-state banners,
- architecture cards,
- code callouts.

### Acceptance Criteria

- Looks credible for finance/compliance.
- Does not look like generic crypto boilerplate.
- Mobile layout works.
- Docs and examples are screenshot-ready.

### User Inputs Needed

- Preferred design direction:
  - institutional fintech,
  - Stellar ecosystem native,
  - cryptography lab,
  - bold hackathon demo.

---

## Sprint 8 — Productionization Roadmap

**Goal:** Define what remains before real issuer production.

**Duration:** 3-5 days.

### Deliverables

- Production-readiness checklist.
- Milestone roadmap.
- Risk register.
- Audit plan.
- Deployment plan.
- Operational plan.

### Production Milestones

#### Milestone A — Protocol Freeze

- freeze public signal ABI,
- freeze manifest format,
- freeze verifier version tags,
- publish artifact hashes.

#### Milestone B — Testnet Pilot

- deploy testnet contract,
- run sample issuer,
- run registry indexer,
- run dashboard,
- monitor attestation freshness.

#### Milestone C — Trust Input Binding

- custodian signature model,
- oracle price commitment model,
- liability snapshot model,
- auditor approval model.

#### Milestone D — Security Review

- circuit audit,
- contract audit,
- SDK audit,
- service review,
- threat-model review.

#### Milestone E — Mainnet Pilot

- limited issuer pilot,
- monitoring,
- incident response,
- public status dashboard,
- external audit references.

### Acceptance Criteria

- Clear path from prototype to production protocol.
- Risks are tracked.
- No hidden trust assumptions.

### User Inputs Needed

- Whether to track roadmap as docs content, GitHub issues, or both.

---

## Sprint 9 — Launch, Submission, And Demo Package

**Goal:** Package the ecosystem for public review.

**Duration:** 2-4 days.

### Deliverables

- Final README pass.
- Final docs deployment.
- Demo script.
- Video outline.
- Screenshots.
- Architecture diagram.
- Testnet tx links if available.
- Final limitations statement.
- Reviewer quickstart.

### Demo Flow

1. Open homepage.
2. Explain the issuer privacy/transparency problem.
3. Show protocol architecture.
4. Show private reserve snapshot fixture.
5. Generate or load proof.
6. Submit attestation.
7. Show on-chain verification.
8. Show verifier dashboard or CLI read.
9. Explain limitations and production path.

### README Final Sections

- What is Stellaris?
- Why it matters.
- Architecture.
- Repositories.
- Quickstart.
- Demo.
- Security limitations.
- Roadmap.
- License.

### Acceptance Criteria

- Reviewer can run the project.
- Reviewer can understand the project.
- Reviewer sees honest limitations.
- Demo is short, clear, and credible.

### User Inputs Needed

- Target deadline.
- Submission format.
- Whether video is required.
- Whether docs should be publicly deployed.

---

## Recommended Execution Orders (LEGACY — superseded)

> DEPRECATED. The three reasoning-only orders below were written before external
> research. They all front-load docs/demo polish, which is the exact Summa failure
> mode (an EF-funded, cryptographically superior zk-PoR that died of non-adoption,
> not bad docs). They are retained only for traceability. The authoritative order
> is "Execution Priority (Research-Grounded)" near the top of this document and in
> `NEXT-SPRINTS-DEBATE-RESEARCH.md`. Do NOT execute from the lists below.

### Fastest Public Readiness (legacy)

1. Sprint 0 — P7 finish.
2. Sprint 1 — docs productization.
3. Sprint 9 — demo/submission package.
4. Sprint 3 — testnet deployment.
5. Sprint 2 — visual showcase apps.
6. Sprint 4 — security/trust hardening.
7. Sprint 5 — SDK DX.
8. Sprint 6 — GTM assets.
9. Sprint 7 — brand polish.
10. Sprint 8 — production roadmap.

### Strongest Technical Credibility (legacy)

1. Sprint 0.
2. Sprint 3.
3. Sprint 4.
4. Sprint 5.
5. Sprint 1.
6. Sprint 2.
7. Sprint 9.
8. Sprint 6.
9. Sprint 7.
10. Sprint 8.

### Best Demo Impact (legacy)

1. Sprint 0.
2. Sprint 1.
3. Sprint 2.
4. Sprint 9.
5. Sprint 3.
6. Sprint 4.
7. Sprint 5.
8. Sprint 6.
9. Sprint 7.
10. Sprint 8.

## Recommendation (Research-Grounded — authoritative)

Execute in the order given by "Execution Priority (Research-Grounded)" at the top
of this document. In short:

1. Finish **Sprint 0** (P7 stabilization) — immediate gate.
2. Build **Sprint A — Mint-Guard Vertical Slice** — the distribution wedge and the
   one primitive the market actually buys (Chainlink Secure-Mint parity on Stellar
   with private composition). Start with the design spike.
3. **Live testnet e2e** (legacy Sprint 3) to make the mint-guard demonstrable.
4. **Regulatory trust-boundary doc** (legacy Sprint 4) and **SCF grant application**
   (legacy Sprint 6) to secure credibility + non-dilutive distribution.

Docs productization, demo packaging, SDK DX, showcase apps, brand, and the
productionization roadmap follow — rewritten around the mint-guard story rather
than generic proof-of-reserves. The guiding principle from the evidence: clarity
comes THROUGH a concrete integration and a funded distribution path, because
clarity alone is what Summa already had when it died.

The next concrete sprint after P7 is **Sprint A — Mint-Guard Vertical Slice**,
beginning with its go/no-go design spike.
