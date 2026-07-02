# 04 — Recommendation

## Lead pick: Candidate 1 — "Stellaris" (ZK Proof-of-Reserves on Stellar)

### One sentence
A stablecoin/RWA issuer on Stellar proves on-chain that their reserves cover
their liabilities — without revealing a single account balance — and the Soroban
contract publishes a verifiable "Solvent as of ledger N" attestation.

### Why this one (decision rationale)
1. **Best feasibility-to-differentiation ratio for a 7-day solo build.** Single
   Circom Groth16 circuit + the official soroban-examples verifier (a solved
   integration path per doc 01). No multi-circuit shielded system to finish.
2. **ZK is the product (gate pass).** Remove the proof and you're back to a
   trust-me PDF. The proof IS the trust primitive — exactly what "load-bearing"
   means.
3. **Real-world Stellar strength, chain-native demand.** Issuers (stablecoin +
   RWA) are SDF's named core customers (VERIFIED). Proof-of-reserves is a
   recognized post-FTX industry need — transferable demand, not analogized.
4. **Low crowding.** Listed on the ideas board but, unlike private payments,
   has NO ready-to-fork PoC. The field will be thin on finished PoR projects.
5. **Sharp 2-3 min demo.** Click "generate proof" (secrets stay client-side via
   WASM), watch Soroban verify and stamp a solvency attestation. Legible to a
   non-crypto judge in 30 seconds.

### What ZK proves (precise statement)
Private inputs: reserve account balances `r_1..r_n`, liability total `L`.
Public inputs: commitment `C = Poseidon(r_1..r_n)`, declared liabilities `L`
(or commitment to it), boolean output `solvent`.
Circuit constraints:
- each `r_i >= 0` (range constraint),
- `sum(r_i) >= L`  -> `solvent = 1`,
- `C` correctly commits to the reserve set.
Soroban verifier: checks the Groth16 proof against the verification key, then
records `(C, L, solvent, ledger_timestamp, period_nullifier)` on-chain so each
reporting period yields a unique, non-replayable attestation.

### Honest limitation (state it in the README and the video)
The proof binds the **arithmetic and non-negativity**, not the truthfulness of
the issuer's raw balance inputs. Binding raw balances to reality needs a
bank/custodian oracle or signed exchange attestations — explicitly out of scope
for the hackathon prototype. This is the standard, well-understood honest
boundary of proof-of-reserves; judges expect it and stating it builds trust.
(VERIFIED framing across the docs: everything here is "research prototype, not
audited.")

### Demo-day differentiator (cheap, high-impact add)
Add a "liabilities commitment" so the issuer also commits to the liability
figure on-chain, and show a FAILING proof (reserves < liabilities -> contract
rejects / marks insolvent). Showing the proof system REJECT an insolvent state
on camera is the single most convincing 15 seconds you can give a judge.

## Build path (7-day, build-first/test-soon — for the later RPD plan)
Not implementation; just the shape so feasibility is concrete.

```
Day 1  Clone official groth16_verifier; deploy to testnet; verify the
       tutorial a*b=c proof end-to-end. Lock the integration FIRST.
Day 2  Write the PoR Circom circuit (sum + range + Poseidon commitment);
       prove locally with snarkjs; run trusted setup script.
Day 3  Wire circuit proof -> Soroban verifier; record attestation on-chain.
Day 4  Client-side (WASM) proving so secrets never leave the browser; minimal
       issuer UI (enter balances, generate proof, see on-chain attestation).
Day 5  Insolvent-case rejection path + period nullifier (anti-replay).
Day 6  Polish UI, write detailed README, record 2-3 min demo video.
Day 7  Buffer: testnet flakiness, video re-record, submission packaging.
```

### Primitive maturity / fallback (per hackathon-strategy skill)
- Groth16 verifier: official soroban-example + Bachini E2E tutorial = READY
  tier. Primary live demo path.
- Fallback: if testnet RPC flakes during judging, the demo video (required
  anyway) is the backup, plus a local snarkjs verification showing the proof is
  valid independent of chain.

## If the user wants higher ambition instead
- **Candidate 2 (Clearpath)** if they want the highest moat (16/20) and accept
  higher delivery risk — cut scope to ONE feature (the sanctioned-set
  non-membership proof) to make it shippable.
- **Candidate 4 (GateProof)** as the safety net if 7 days feels tight — wrap it
  as an RWA investor-allowlist claim to dodge the "generic allowlist" crowd.

## Recommended next step
Confirm the idea choice, then I'll turn the pick into a file-level RPD
implementation plan (Role / Public API / Detailed Flow) for the circuit, the
Soroban verifier contract, and the client — with per-phase compile/test exit
criteria. No code until the plan is accepted.

## Decision needed from you
1. Go with **Stellaris (Proof-of-Reserves)** as the lead? (recommended)
2. Or pick Clearpath / Provenance / GateProof instead?
3. Framework confirm: **Circom Groth16** (cheapest, best-documented) unless you
   prefer Noir (readability) or RISC Zero (computation attestation).
