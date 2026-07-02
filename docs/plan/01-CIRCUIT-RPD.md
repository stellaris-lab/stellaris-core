# 01 — Circuit RPD (Circom + trusted setup)

Files for the off-chain proof side. Framework: Circom 2.x, Groth16, snarkjs.

## Public-signal contract (LOCK THIS FIRST — shared with contract & client)

Desired product-facing order:
```
public signals = [ solvent, C_commitment, L_liabilities, period_id ]
  solvent       : 0 or 1
  C_commitment  : Poseidon hash of the reserve balance vector
  L_liabilities : declared total liabilities (field element)
  period_id     : reporting period identifier (anti-replay nullifier seed)
```
Private signals: `r[0..n-1]` reserve balances, plus a salt for the commitment.
Demo cap: `n <= 16` accounts (keeps proving fast and the circuit small).

Development gate: do not assume snarkjs emits the desired order. Compile the
circuit, generate `public.json`, inspect `.sym`, then write the actual order to
`circuits/PUBLIC_SIGNALS.md`. Contract and client constants must follow the
actual emitted order. See `plan/04-PLAN-AUDIT-AND-FIXES.md` and
`plan/05-DEVELOPMENT-PLAYBOOK.md`.

---

### 1.1 `circuits/components/range_check.circom`

**R - Role**
Constrain that a single balance signal is a non-negative integer within a
bounded bit-width (prevents negative/overflow values forging solvency).

**P - Public API**
- `template RangeCheck(nBits)` — input `in`; enforces `0 <= in < 2^nBits`.
- Uses `Num2Bits(nBits)` from circomlib to decompose and implicitly bound.

**D - Detailed Flow**
1. Instantiate `Num2Bits(nBits)` on `in` (e.g. nBits = 64 for balances).
2. The bit decomposition itself constrains `in < 2^nBits`.
3. No explicit output; failure to decompose = unsatisfiable witness.
Test scenarios: in=0 (ok), in=2^64-1 (ok), in=2^64 (must be unsatisfiable),
negative (field-wrap -> caught by bit-width).

---

### 1.2 `circuits/components/sum_gte.circom`

**R - Role**
Prove `sum(r[i]) >= L` and output the boolean `solvent`, without leaking the sum.

**P - Public API**
- `template SumGte(n, nBits)` — inputs `r[n]`, `L`; output `solvent`.

**D - Detailed Flow**
1. Range-check every `r[i]` via RangeCheck(nBits) (defense vs forged negatives).
2. Compute `total = sum(r[i])` with an adder chain (constrain each partial).
3. Compute `diff = total - L`. Range-check `diff` over `nBits+ceil(log2(n))`
   bits IF solvent; use a `GreaterEqThan` comparator (circomlib) on
   `(total, L)` to derive `solvent ∈ {0,1}` safely.
4. Constrain `solvent` is boolean (`solvent*(solvent-1)===0`).
5. Output `solvent`.
Edge cases: total == L -> solvent = 1 (boundary). total < L -> solvent = 0.
Pitfall: comparator bit-width must exceed max possible total
(`nBits + log2(n)`), else wrap-around forges a result. Document the bound.

---

### 1.3 `circuits/components/commit.circom`

**R - Role**
Bind the proof to a specific reserve vector via a Poseidon commitment so an
issuer cannot swap balances between commitment and proof.

**P - Public API**
- `template ReserveCommit(n)` — inputs `r[n]`, `salt`; output `C`.

**D - Detailed Flow**
1. Use circomlib `Poseidon(n+1)` over `[r[0..n-1], salt]`.
2. Output `C` as a single field element.
3. `salt` prevents brute-forcing balances from a known commitment.
Note: on-chain Poseidon host function exists (CAP-0075) — the contract can
re-derive/anchor C cheaply if we later want the contract to recompute it. For
the hackathon, C is a public signal the verifier trusts from the proof.

---

### 1.4 `circuits/por.circom`

**R - Role**
Top-level proof-of-reserves circuit composing range + sum-gte + commitment, and
exposing exactly the locked 4 public signals.

**P - Public API**
- `template ProofOfReserves(n, nBits)`:
  - private: `r[n]`, `salt`
  - public: `L`, `period_id`
  - public outputs: `solvent`, `C`
- `component main {public [L, period_id]} = ProofOfReserves(16, 64);`

**D - Detailed Flow**
1. Wire `r[]`, `L` into `SumGte(n, nBits)` -> `solvent`.
2. Wire `r[]`, `salt` into `ReserveCommit(n)` -> `C`.
3. `period_id` is a public passthrough included in the witness so it is bound
   into the proof (prevents reusing a proof for a different period).
4. Expose public-signal array in the locked order. Verify with snarkjs that the
   emitted `public.json` matches `[solvent, C, L, period_id]`.
Test vectors (in `circuits/inputs/`):
- `solvent.json`: sum > L -> expect solvent=1, verify OK.
- `insolvent.json`: sum < L -> expect solvent=0 (still a valid proof of an
  insolvent state; contract rejects on solvent!=1).
- `boundary.json`: sum == L -> expect solvent=1.

---

### 1.5 `setup/ceremony.sh`

**R - Role**
Produce the Groth16 proving + verification keys via a scripted (DEMO) trusted
setup. Explicitly NOT a production ceremony.

**P - Public API (script steps)**
- powers-of-tau: `snarkjs powersoftau new/contribute/prepare phase2`
- circuit-specific: `snarkjs groth16 setup`, `zkey contribute`, `zkey export
  verificationkey`.

**D - Detailed Flow**
1. `circom por.circom --r1cs --wasm --sym`.
2. ptau: new bn128, one contribution (entropy noted as demo-only), prepare
   phase2.
3. `groth16 setup por.r1cs ptau por_0000.zkey`; one `zkey contribute`.
4. Export `verification_key.json`.
5. Header comment in BIG letters: "DEMO trusted setup — single contributor, not
   secure for production. A real deployment needs a multi-party ceremony."
Pitfall: curve must be **bls12381** (BLS12-381) to match the official Stellar
Soroban groth16_verifier example (confirmed in P0). The earlier plan assumed
BN254, but the official example uses BLS12-381 exclusively.

---

### 1.6 `setup/export-vk.sh`

**R - Role**
Convert `verification_key.json` + a sample `proof.json`/`public.json` into the
canonical hex byte layout the Soroban verifier expects.

**P - Public API**
- emits `vk.hex`, and a `generatecall`-style argument blob for the contract.

**D - Detailed Flow**
1. Mirror the official example's expected encoding (G1/G2 point byte order,
   field-element endianness). CONFIRM exact layout from the cloned
   `groth16_verifier` README/tests in P0 — this is the #1 integration footgun.
2. Produce a reusable converter so client proofs map to contract args
   identically to the script path.
Verification gate: the bytes from this script, fed to the contract in P0, must
make the tutorial proof verify TRUE before we trust our own circuit's output.
