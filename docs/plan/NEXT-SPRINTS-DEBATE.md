# Stellaris Next Sprints Debate

This document stress-tests `docs/plan/NEXT-SPRINTS-ROADMAP.md` through a structured internal debate.

The goal is not to invalidate the roadmap. The goal is to expose hidden risks, sequencing problems, market-fit assumptions, execution bottlenecks, and scope traps before work starts.

## Review Panel

The debate uses eight reviewer perspectives:

1. **Protocol Architect** — cares about cryptographic correctness, ABI stability, contract/circuit consistency, and versioning.
2. **Product Strategist** — cares about market wedge, buyer clarity, positioning, and user-demand fit.
3. **Developer Experience Lead** — cares about SDK adoption, docs quality, examples, and time-to-first-success.
4. **Security Reviewer** — cares about trust assumptions, input provenance, key custody, threat model, and audit readiness.
5. **Demo/Launch Lead** — cares about hackathon/demo impact, narrative clarity, screenshots, and reviewer comprehension.
6. **Engineering Manager** — cares about sequencing, dependency management, risk burn-down, and scope control.
7. **Go-To-Market Reviewer** — cares about use cases, audience fit, differentiation, and credible adoption path.
8. **Skeptical External Auditor** — assumes claims are overstated until proven and searches for hidden trust gaps.

## Executive Verdict

The roadmap is directionally strong but too broad if treated as a linear build plan. It should be executed as two tracks:

- **Track A: Public-readiness track** — docs, demo package, narrative, visual proof, reviewer onboarding.
- **Track B: Technical-credibility track** — testnet deployment, security model, SDK DX, production trust bindings.

The current recommended order, **Sprint 0 -> Sprint 1 -> Sprint 9 -> Sprint 3 -> Sprint 2 -> Sprint 4 -> Sprint 5 -> Sprint 6 -> Sprint 7 -> Sprint 8**, is acceptable for fast public readiness, but it needs tighter gates:

- Do not start visual apps before the demo story is fixed.
- Do not claim production readiness before Sprint 4 security/trust work.
- Do not spend too long on brand polish before testnet evidence exists.
- Do not make `stellaris-apps` only screenshots; it must remain integration proof.

Recommended final sequencing:

1. **Sprint 0 — P7 Final Submission Hardening**
2. **Sprint 1 — Documentation Productization**
3. **Sprint 9 — Launch, Submission, And Demo Package**
4. **Sprint 3 — Live Testnet Deployment And End-To-End Flow**
5. **Sprint 4 — Security, Trust Binding, And Audit Readiness**
6. **Sprint 5 — SDK Developer Experience**
7. **Sprint 2 — Example Apps Showcase Layer**
8. **Sprint 6 — Market Positioning And GTM Assets**
9. **Sprint 7 — Visual Design And Brand System**
10. **Sprint 8 — Productionization Roadmap**

This differs from the original public-readiness order by moving security and SDK DX before visual showcase expansion. The reason: if the protocol and SDK cannot survive technical scrutiny, additional frontend apps can amplify weak claims.

---

## Debate Round 1 — Overall Strategy

### Product Strategist Position

The roadmap correctly identifies the product category: privacy-preserving solvency attestations. This is stronger than calling Stellaris a generic proof-of-reserves demo.

However, the roadmap risks addressing too many audiences at once:

- stablecoin issuers,
- RWA issuers,
- custodians,
- auditors,
- wallets,
- exchanges,
- developers,
- hackathon judges,
- investors.

That breadth is useful in a vision document, but dangerous in sprint execution. The first wedge should be narrower:

> Stellar-native issuers that need to publish solvency attestations without disclosing reserve composition.

Everything else should be framed as expansion.

### Protocol Architect Response

Agree. The technical primitive is more general than the first market wedge, but premature generality creates docs and API bloat. Keep protocol language general but examples narrow.

### Go-To-Market Reviewer Response

The market gap is credible only if the docs state who is expected to adopt first. The first adopter is unlikely to be a highly regulated bank. The first adopter is more likely:

- a testnet issuer,
- hackathon stablecoin demo,
- RWA prototype,
- foundation/grant reviewer,
- infra developer evaluating Soroban ZK use cases.

### Skeptical Auditor Response

The product story will fail if it implies a stronger guarantee than the system provides. The key phrase must remain:

> proves solvency over supplied inputs.

Any page or demo that shortens this to “proves reserves are real” is wrong.

### Round 1 Decision

Keep the broad roadmap, but execute with a narrow first wedge:

- primary: Stellar issuer solvency attestations,
- secondary: RWA and custody workflows,
- tertiary: wallets/exchanges/auditors consuming attestations.

---

## Debate Round 2 — Sprint 0: P7 Final Submission Hardening

### Engineering Manager Position

Sprint 0 is mandatory and should stay first. It is the quality gate before expanding scope.

Good elements:

- build verification,
- terminology cleanup,
- limitation callouts,
- demo flow preparation.

Missing element:

- freeze a submission baseline.

Add a concrete artifact:

```txt
SUBMISSION-CHECKLIST.md
```

It should list commands, expected outputs, known limitations, and demo steps.

### Demo/Launch Lead Position

Sprint 0 should not only verify commands. It should make the project narratable:

1. Problem: reserve transparency forces privacy tradeoffs.
2. Insight: prove inequality without revealing reserve vector.
3. Protocol: ZK proof verified on Soroban.
4. SDK: app builders can integrate it.
5. Examples: backend/operator flows already exist.
6. Honesty: input provenance and audit are future production hardening.

### Security Reviewer Position

The limitations callouts are necessary but should not be passive footnotes. They should appear in:

- README,
- docs security page,
- demo script,
- final submission text.

### Skeptical Auditor Position

Final hardening should include one negative demo case:

- insolvent proof rejected,
- duplicate period rejected,
- stale/no attestation warning,
- oracle mismatch rejected,
- bad custodian signature rejected.

Only showing the happy path weakens credibility.

### Sprint 0 Verdict

Keep Sprint 0 first. Add three explicit outputs:

- `SUBMISSION-CHECKLIST.md`,
- negative-case demo evidence,
- final public claim checklist.

---

## Debate Round 3 — Sprint 1: Documentation Productization

### Developer Experience Lead Position

Docs should be next because they are the user interface to the whole ecosystem. Current docs should prioritize:

- what is Stellaris,
- why it exists,
- how it works,
- how to run it,
- how to integrate it,
- what it does not prove.

The planned docs tree is good but could become too large. Recommended priority order:

1. `index.mdx`
2. `architecture.mdx`
3. `getting-started.mdx`
4. `protocol.mdx`
5. `sdk.mdx`
6. `examples.mdx`
7. `security-limitations.mdx`
8. `roadmap.mdx`
9. `faq.mdx`

Only after those are strong should `market-gap`, `auditor-guide`, and deeper persona pages be expanded.

### Product Strategist Position

The homepage must not read like a research paper. It should answer:

- Who is this for?
- What pain does it solve?
- Why is privacy-preserving proof-of-reserves needed?
- Why should I trust the architecture enough to keep reading?

### Protocol Architect Position

The docs must preserve precision around public signals, circuit versions, and manifest versioning. If docs are simplified too far, they become misleading.

### Demo/Launch Lead Position

Docs should include visual diagrams early. Text-only docs will make the project feel more abstract than it is.

### Sprint 1 Debate Conflict

- Product wants simpler language.
- Protocol wants precision.
- DX wants runnable snippets.
- Demo wants visuals.

### Sprint 1 Resolution

Use a layered docs structure:

- landing pages explain simply,
- protocol pages provide exact details,
- SDK pages provide commands/code,
- security pages provide caveats.

Do not put all details on the homepage.

### Sprint 1 Verdict

Sprint 1 should remain early. It should be treated as product infrastructure, not marketing fluff.

---

## Debate Round 4 — Sprint 2: Example Apps Showcase Layer

### Demo/Launch Lead Position

Visual apps are important because reviewers understand screenshots faster than operator services. An issuer portal and verifier dashboard would make the protocol tangible.

### Engineering Manager Position

Sprint 2 is risky if started too early. Visual apps can consume time while adding little technical credibility if they are not connected to real SDK flows.

### Developer Experience Lead Position

The current `stellaris-apps` already has strong backend/operator material. The next app should not be a mock-only frontend that bypasses the SDK. It must consume shared packages.

### Product Strategist Position

The first visual app should be the verifier dashboard, not issuer portal, if the goal is market comprehension. Most external reviewers are verifiers, not issuers. They want to see: “Can I check if this issuer is solvent?”

### Protocol Architect Position

Issuer portal better demonstrates the full pipeline: snapshot -> proof -> attestation. Verifier dashboard demonstrates only the read path.

### Skeptical Auditor Position

Both are useful, but a mock-only visual app can mislead. If visual apps are added before testnet evidence, label them as simulation.

### Sprint 2 Debate Conflict

- Issuer portal shows write path and product power.
- Verifier dashboard shows public trust and user value.
- RWA treasury shows advanced v3 capabilities but may distract from base story.

### Sprint 2 Resolution

Build in this order:

1. **Verifier Dashboard** — fastest way to communicate public value.
2. **Issuer Portal** — demonstrates submit/prove flow.
3. **RWA Treasury** — advanced use case after base story lands.

But if the demo video needs a full lifecycle, swap first two:

1. Issuer Portal,
2. Verifier Dashboard,
3. RWA Treasury.

### Sprint 2 Verdict

Move Sprint 2 after testnet/security/SDK unless the immediate goal is demo visuals. When executed, require every app to use shared packages and clearly label mock vs testnet modes.

---

## Debate Round 5 — Sprint 3: Live Testnet Deployment And E2E

### Protocol Architect Position

This is the highest technical credibility sprint. A public testnet contract and attestation prove the architecture is not only local mocks.

### Engineering Manager Position

Sprint 3 is high risk because it depends on toolchain, RPC, account funding, contract deploy details, and manifest correctness. It should be started as soon as docs are coherent enough to explain failures.

### Demo/Launch Lead Position

A real explorer link is extremely valuable for submission. It makes the demo feel real.

### Security Reviewer Position

Public testnet deployment without clear warnings can be misunderstood as production readiness. The docs must say “testnet only, unaudited.”

### Developer Experience Lead Position

Testnet deployment will expose gaps in manifest loader, CLI, transport, and docs. This is good. It should happen before polishing too many examples.

### Sprint 3 Debate Conflict

- It is risky and may consume time.
- It is also the strongest proof of seriousness.

### Sprint 3 Resolution

Run Sprint 3 immediately after docs/demo baseline, but define a fallback:

- Primary: live testnet attestation.
- Fallback: local/mock attestation with exact blockers documented.

### Sprint 3 Verdict

Sprint 3 should move earlier than visual app expansion for technical credibility. It is the best next major milestone after docs/demo package.

---

## Debate Round 6 — Sprint 4: Security, Trust Binding, And Audit Readiness

### Security Reviewer Position

This sprint is not optional. The project’s strongest risk is misinterpreted guarantees.

Must-have security docs:

- threat model,
- input provenance,
- trusted setup,
- key custody,
- oracle/custodian model,
- verifier interpretation guide.

### Skeptical Auditor Position

The roadmap should distinguish three levels of truth:

1. **Circuit truth** — the arithmetic statement is satisfied over witness inputs.
2. **Contract truth** — a specific proof was accepted and recorded on-chain.
3. **Economic truth** — the witness inputs correspond to real reserves and liabilities.

Stellaris currently has strong work on 1 and 2, and roadmap work for 3.

### Product Strategist Position

Too much security language too early can scare non-technical readers. But hiding it is worse. The homepage should be confident; the security docs should be direct.

### Protocol Architect Position

The manifest is central to security. Without artifact hashes and verifier key identity, deployments are hard to reason about.

### Sprint 4 Verdict

Move Sprint 4 before deep GTM or brand work. It protects credibility.

Add explicit output:

```txt
SECURITY-MODEL.md
THREAT-MODEL.md
INPUT-PROVENANCE.md
```

---

## Debate Round 7 — Sprint 5: SDK Developer Experience

### Developer Experience Lead Position

The SDK is the adoption surface. If developers cannot integrate it quickly, the protocol becomes a demo, not a productized SDK.

Must-have DX deliverables:

- quickstart that works,
- typed error guide,
- manifest guide,
- mock transport guide,
- testnet transport guide,
- signer guide,
- reconciler guide,
- migration/versioning guide.

### Engineering Manager Position

SDK DX should happen after testnet deployment because real deployment will reveal which APIs are awkward.

### Protocol Architect Position

SDK docs must not hide ABI details entirely. They should expose enough for debugging but route normal usage through typed helpers.

### Demo/Launch Lead Position

SDK docs matter less for a short demo, but matter more for judges who inspect the repo.

### Sprint 5 Verdict

Do SDK DX after testnet and security model, before expanding many visual apps. This ensures examples are built on a stable, documented developer path.

---

## Debate Round 8 — Sprint 6: Market Positioning And GTM Assets

### Go-To-Market Reviewer Position

The roadmap’s GTM sprint is valuable, but only after the technical story is stable. GTM claims should be grounded in working artifacts:

- contract,
- proof,
- SDK,
- apps,
- docs,
- testnet evidence if available.

### Product Strategist Position

The market narrative should avoid pretending all buyers are ready today. Recommended language:

- “initial wedge: Stellar issuer proof-of-reserves,”
- “expansion: RWA/custody solvency attestations,”
- “future: audited production deployments with custodian/oracle bindings.”

### Skeptical Auditor Position

Competitor comparison must not claim superiority where the project is not production-audited.

### Sprint 6 Verdict

GTM assets should be built after at least Sprint 1, Sprint 3, and Sprint 4. Otherwise they risk becoming aspirational rather than evidence-backed.

---

## Debate Round 9 — Sprint 7: Visual Design And Brand System

### Demo/Launch Lead Position

Visual polish matters. First impressions matter. A strong homepage and polished screenshots help reviewers understand the project.

### Engineering Manager Position

Brand work can become a sinkhole. It should be bounded by explicit deliverables:

- homepage visual polish,
- diagram style,
- attestation cards,
- status badges,
- mobile pass,
- screenshot kit.

### Product Strategist Position

The recommended brand direction is good: institutional fintech, not generic purple crypto.

### Developer Experience Lead Position

Do not let visual design hurt docs readability or code examples.

### Sprint 7 Verdict

Keep Sprint 7, but split it into:

- minimum visual credibility pass early,
- full brand system later.

The homepage should already look good by Sprint 1. The full design system can wait.

---

## Debate Round 10 — Sprint 8: Productionization Roadmap

### Protocol Architect Position

Sprint 8 is valuable because it clarifies the path from prototype to production.

### Security Reviewer Position

This sprint should not be last if production claims are being made. But if the immediate goal is public submission, it can be a roadmap artifact rather than implementation work.

### Go-To-Market Reviewer Position

Production roadmap helps serious users trust the project’s maturity. It should be visible but honest.

### Engineering Manager Position

The roadmap already exists in broad form. Sprint 8 should eventually turn it into GitHub issues/milestones.

### Sprint 8 Verdict

Keep Sprint 8 as a planning/issue-generation sprint. Do not confuse it with production implementation.

---

## Debate Round 11 — Sprint 9: Launch, Submission, And Demo Package

### Demo/Launch Lead Position

Sprint 9 should move earlier than the number suggests. It is the bridge between docs and actual review.

Must-have outputs:

- demo script,
- screenshot list,
- reviewer quickstart,
- final README pass,
- limitations statement,
- architecture diagram,
- optional video outline.

### Product Strategist Position

The launch package should adapt to the audience. A hackathon submission and investor demo need different emphasis.

### Skeptical Auditor Position

Submission materials must include one explicit limitation slide/section.

### Engineering Manager Position

Sprint 9 should be run as soon as Sprint 1 docs have enough structure. Waiting until the end risks discovering narrative gaps too late.

### Sprint 9 Verdict

Move Sprint 9 immediately after Sprint 1 for public-readiness execution.

---

## Cross-Sprint Risks

## Risk 1 — Scope Explosion

The roadmap covers docs, frontend apps, protocol, SDK, deployment, security, GTM, brand, and production planning.

Mitigation:

- Run two-week or shorter sprints.
- Define hard acceptance criteria.
- Do not start a sprint without naming what will not be done.

## Risk 2 — Overclaiming Solvency Guarantees

The market story can easily overstate what the protocol proves.

Mitigation:

- Keep “over supplied inputs” language everywhere.
- Add verifier interpretation guide.
- Include negative cases in demo.

## Risk 3 — Mock Demo Confused With Live Protocol

Visual apps may look real even when backed by mock data.

Mitigation:

- Explicit mock/testnet badges.
- Use deployment manifest status.
- Include testnet links when available.

## Risk 4 — Testnet Deployment Consumes Too Much Time

Tooling or deployment issues could block progress.

Mitigation:

- Define fallback demo path.
- Document blockers.
- Do not block docs/demo package on deployment.

## Risk 5 — SDK Examples Drift From Core ABI

Docs and examples may encode assumptions that drift from contract/circuit ABI.

Mitigation:

- Route examples through SDK helpers.
- Avoid hand-encoding proofs/signals in app code.
- Add snippet validation where possible.

## Risk 6 — Security Docs Scare Users

Honest limitations may make the project feel unfinished.

Mitigation:

- Frame limitations as production roadmap.
- Separate prototype status from long-term architecture.
- Be confident about what is already working.

## Risk 7 — Brand Polish Delays Technical Proof

Design can consume time before technical evidence is strong.

Mitigation:

- Minimum visual pass early.
- Full design system later.
- Prioritize diagrams and screenshots over cosmetic refinements.

---

## Required Changes To The Original Roadmap

The roadmap should be amended as follows:

1. Add `SUBMISSION-CHECKLIST.md` to Sprint 0.
2. Add negative demo cases to Sprint 0/Sprint 9.
3. Move Sprint 9 immediately after Sprint 1 for public-readiness execution.
4. Move Sprint 4 and Sprint 5 before deep visual app expansion unless demo impact is the only goal.
5. Add fallback path to Sprint 3 if testnet deployment blocks.
6. Add explicit mock/testnet labels to Sprint 2 visual apps.
7. Add `SECURITY-MODEL.md`, `THREAT-MODEL.md`, and `INPUT-PROVENANCE.md` to Sprint 4.
8. Add artifact hash / manifest hash requirements to Sprint 3 and Sprint 4.
9. Keep Sprint 7 bounded to avoid brand scope creep.
10. Convert Sprint 8 into GitHub issues/milestones when ready.

---

## Final Prioritized Plan After Debate

## Phase A — Submission Readiness

### Sprint A0 — P7 Finish

Outputs:

- build gates,
- terminology sweep,
- limitations pass,
- `SUBMISSION-CHECKLIST.md`,
- negative demo case evidence.

### Sprint A1 — Docs Productization

Outputs:

- clear public docs,
- architecture diagram,
- quickstart,
- protocol page,
- SDK page,
- security limitations,
- roadmap/FAQ.

### Sprint A2 — Launch/Demo Package

Outputs:

- demo script,
- reviewer quickstart,
- screenshots list,
- final README pass,
- limitation statement,
- video outline if needed.

## Phase B — Technical Credibility

### Sprint B1 — Testnet E2E

Outputs:

- deployed contract,
- initialized verification key,
- deployment manifest,
- real testnet attestation,
- CLI/app readback,
- explorer evidence.

Fallback:

- documented blocker and reproducible mock e2e.

### Sprint B2 — Security Model

Outputs:

- threat model,
- input provenance doc,
- trust-binding doc,
- manifest/artifact hash plan,
- key management guidance.

### Sprint B3 — SDK DX

Outputs:

- SDK quickstart,
- error guide,
- manifest guide,
- transport guide,
- mock/testnet examples.

## Phase C — Product Expansion

### Sprint C1 — Showcase Apps

Outputs:

- verifier dashboard,
- issuer portal,
- RWA treasury demo,
- mock/testnet badges,
- shared UI/demo-data packages.

### Sprint C2 — GTM Assets

Outputs:

- market-gap page,
- use-case pages,
- competitor comparison,
- deck outline,
- launch checklist.

### Sprint C3 — Visual System

Outputs:

- diagrams,
- status cards,
- screenshot kit,
- mobile polish,
- component style guide.

### Sprint C4 — Production Roadmap

Outputs:

- GitHub milestones,
- audit plan,
- production readiness checklist,
- risk register,
- mainnet pilot plan.

---

## Final Debate Verdict

The plan is solid, but the original sprint numbering should not be interpreted as execution order. The strongest path is:

1. finish P7,
2. make docs and demo narrative excellent,
3. prove testnet e2e,
4. write security/trust model,
5. improve SDK adoption,
6. then expand visual apps and GTM.

This protects Stellaris from the two biggest failure modes:

- looking polished but technically unproven,
- being technically impressive but impossible for reviewers/users to understand.

The winning strategy is balanced: public clarity first, live technical proof second, security credibility third, product expansion fourth.
