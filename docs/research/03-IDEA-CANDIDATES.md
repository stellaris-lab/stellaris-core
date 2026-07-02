# 03 — Idea Candidates

Problem-first wedges in the white space from doc 02. Each is scored on:
- **Wedge confidence** (max 9): insider access + maturity + gap clarity
- **Moat** (max 20): workflow complexity + integration + compliance depth +
  vertical specialization + data effects
- **7-day feasibility** (High/Med/Low)
- **ZK load-bearing?** (the disqualifier gate)

All ideas use the cheapest documented path (Circom Groth16 + official Soroban
verifier) unless noted.

---

## Candidate 1 — "Stellaris": ZK Proof-of-Reserves for Stablecoin / RWA issuers

**Problem.** A stablecoin or RWA issuer on Stellar must convince holders and
auditors that reserves >= liabilities. Today they either publish a trust-me
attestation (opaque) or dump full account data (leaks customer/treasury info).
Post-FTX, "proof of reserves" is a recognized real need.

**What the proof proves (load-bearing).** Issuer holds a set of reserve
balances; a circuit proves `sum(reserves) >= totalLiabilities` (a range/sum
proof over committed balances) WITHOUT revealing individual reserve account
balances or composition. Public inputs: a commitment to the reserve set, the
declared liability total (or its commitment), and the boolean "solvent."
Soroban verifier checks the Groth16 proof and records an on-chain solvency
attestation with a timestamp + nullifier so each period's proof is unique.

**Why it wins.**
- Real-world Stellar strength (issuers are the actual customer base). VERIFIED
  SDF emphasis on stablecoins/RWAs.
- ZK is the product: delete it and you're back to "trust me." Pure gate pass.
- Far less forked than private payments — no copy-paste PoC exists.
- Clean 2-3 min demo: issuer clicks "generate proof," secrets stay client-side,
  Soroban shows a green "Solvent as of <ledger>" attestation.

**Scores.** Wedge 7/9 (insider 1, maturity 3, gap clarity 3). Moat 13/20
(workflow 2, integration 2, compliance 4, vertical 4, data 1). Feasibility:
**HIGH** (single Circom circuit + official verifier).

**Risk.** The sum/range circuit must commit to balances honestly — for a demo,
balances are issuer-attested inputs (the proof binds the math, not the truth of
inputs). Must document this honestly: ZK proves the arithmetic & non-negativity,
oracle/attestation of raw balances is out of scope. This is the standard honest
limitation of PoR and judges expect it.

---

## Candidate 2 — "Clearpath": Selective-disclosure compliant transfer w/ view key

**Problem.** Cross-border / institutional payments need BOTH privacy (amounts
hidden from the public) AND compliance (an authorized auditor can reconstruct
the transfer, and the sender can prove the recipient isn't on a deny-list).
Most teams will build the privacy half and skip the auditor half.

**What the proof proves (load-bearing).** A shielded transfer where the sender
proves: (a) they own the input note, (b) recipient is NOT in a sanctioned-set
(non-membership proof via sparse Merkle tree), (c) value conservation — all
without revealing amount or recipient. A view key lets a designated auditor
decrypt the specific transfer they're authorized to inspect.

**Why it wins.** Hits cross-border + institutional settlement (named strengths).
The compliance/disclosure layer is the defensible moat (per hackathon-strategy
skill: execution layer -> workflow/compliance layer is where the moat lives).

**Scores.** Wedge 6/9 (insider 1, maturity 2, gap clarity 3). Moat 16/20
(workflow 4, integration 3, compliance 5, vertical 3, data 1). Feasibility:
**MEDIUM** (note ownership + non-membership + view-key crypto = more moving
parts; close to the Privacy Pools PoC, so partial reuse helps but also risks
looking like a fork).

**Risk.** Scope creep. This is Medium-tier with several circuits. In 7 days the
honest cut is: ONE feature done well (the non-membership/deny-list proof OR the
view-key disclosure), not the whole shielded system. Higher demo-failure risk.

---

## Candidate 3 — "Provenance": ZK off-chain computation attestation for RWA/credit (RISC Zero)

**Problem.** RWA settlement and credit/lending need a *computed* financial fact
to be trustworthy (NAV computed correctly, credit metric >= threshold) without
exposing the sealed inputs. Today this is a trusted spreadsheet.

**What the proof proves (load-bearing).** Run the computation as a Rust program
in the RISC Zero zkVM; prove "given sealed inputs, output = X and X >= threshold"
and verify the Groth16-wrapped receipt on Soroban, which then permits settlement
/ marks the borrower eligible.

**Why it wins.** RISC Zero is thinly contested (medium cost deters teams), and
"prove a real computation ran correctly" is the cleanest possible
load-bearing-ZK story. Strong technical-implementation score.

**Scores.** Wedge 6/9 (insider 1, maturity 2, gap clarity 3). Moat 12/20
(workflow 2, integration 3, compliance 3, vertical 3, data 1). Feasibility:
**MEDIUM** (RISC Zero toolchain + proving time + verifier integration is more
setup than Circom; the Nethermind risc0 verifier + Bachini games tutorial
de-risk it but it's heavier than Candidate 1).

**Risk.** zkVM proving is slow/resource-heavy; demo must use a small input or a
pre-generated proof. Toolchain setup eats into the 7 days.

---

## Candidate 4 (smaller, safe fallback) — "GateProof": private eligibility for airdrops/whitelists with Sybil-resistant nullifiers

**Problem.** Token distributions and gated betas on Stellar want to prove a user
qualifies (in an approved Merkle set) and hasn't already claimed, without
revealing identity or linking claims.

**What the proof proves.** Merkle membership in the approved set + a nullifier
that prevents double-claim, verified on Soroban which then releases the asset.

**Scores.** Wedge 7/9. Moat 9/20 (more feature-like). Feasibility: **HIGH**
(Poseidon Merkle + nullifier is the best-trodden ZK pattern). ZK load-bearing:
yes. This is the safe "Mild done sharp" fallback if time gets tight.

**Risk.** Closer to the crowded "private allowlist" example on the ideas board;
needs a sharp real-world wrapper (e.g., RWA investor allowlist) to stand out.

---

## Comparison

| # | Idea | Wedge | Moat | Feasibility (7d) | Crowding | ZK gate |
|---|------|-------|------|------------------|----------|---------|
| 1 | Stellaris (PoR) | 7 | 13 | HIGH | Low | PASS |
| 2 | Clearpath (disclosure) | 6 | 16 | MED | Med | PASS |
| 3 | Provenance (RISC0) | 6 | 12 | MED | Low | PASS |
| 4 | GateProof (eligibility) | 7 | 9 | HIGH | Med-High | PASS |

INFERRED read: **Candidate 1 has the best feasibility-to-differentiation ratio**
for a 7-day solo build. Candidate 2 has the highest moat but the highest
delivery risk and fork-resemblance. Candidate 4 is the safety net. See doc 04.
