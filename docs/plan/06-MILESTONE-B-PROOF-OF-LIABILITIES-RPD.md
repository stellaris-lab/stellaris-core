# Milestone B — Proof of Liabilities (File-Level RPD Plan)

> RPD = Role / Public API / Detailed flow. This is a senior-engineer, file-level
> implementation plan: every new or changed file lists its role, its public
> surface, and the exact data/constraint flow. It is authoritative for *how*
> Milestone B is built; `docs/ROADMAP.md` is authoritative for *why* and
> `docs/CHANGELOG.md` for *what is actually shipped*.

## 0. Purpose and the boundary being attacked

Today the solvency statement is:

```
sum(reserves[0..15]) >= liabilities_in        // liabilities_in is a TRUSTED scalar
```

`liabilities_in` is asserted by the issuer. Nothing proves it equals the true
sum of what the issuer owes its users. That is the single largest credibility
gap in the protocol (see ROADMAP §0 honest boundary, item 1).

Milestone B replaces the trusted scalar with a **cryptographic proof that the
declared liability total is the exact sum of per-user balances**, while keeping
every individual balance private. After B, the statement becomes:

```
sum(reserves) >= L_total      where  (L_root, L_total) is SNARK-bound to a
                                      Merkle-sum tree of per-user liabilities
```

and any user can independently prove their own balance is included in `L_root`
without learning any other user's balance.

## 1. Threat model (what the proof must defend)

The proof-of-liabilities literature documents concrete attacks a naive design
fails to stop. Each is a constraint requirement, not a footnote.

- **T1 — Understatement via forged internal sums.** A custodian publishes a tree
  whose internal nodes do NOT equal the sum of their children, reporting a total
  smaller than reality. Defense: the circuit must constrain every internal node
  to equal the exact sum of its two children.
- **T2 — Negative / wraparound balances.** A custodian injects a negative (field
  wraparound) leaf balance so siblings cancel, hiding liability. Defense: every
  leaf balance is range-checked to `[0, 2^64)`; every partial sum is range-checked
  to its widened bit budget so no modular wraparound is representable.
- **T3 — Overflow of the sum.** With many leaves, an unconstrained sum could wrap
  the field. Defense: the running sum bit-width is bounded and range-checked at
  every level (`64 + depth` bits for `2^depth` leaves).
- **T4 — Inclusion forgery / omission.** A custodian omits a user, or a user
  claims a balance not in the tree. Defense: per-user inclusion proof recomputes
  the path to the published root using the same hash; mismatch = no proof.
- **T5 — Cross-period replay.** A liabilities root from period N is reused in
  period M. Defense: the root is bound to `period_id` in the public signals and
  the contract stores it per (issuer, period) under the existing replay guard.
- **T6 — Reserve/liability unit mismatch.** Reserves proven in one unit, but
  liabilities summed in another. Defense (scope note): B operates in a single
  asset/unit; multi-asset + oracle pricing is Milestone C. B's exit gate asserts
  the single-unit assumption explicitly.

## 2. Cryptographic design — Merkle-sum (Maxwell) tree

### 2.1 Leaf

```
leaf_hash_i   = Poseidon(user_id_i, balance_i, salt_i)
leaf_sum_i    = balance_i                     // carried alongside the hash
```

`user_id_i` is a per-user identifier (field element; e.g. Poseidon of an account
string). `salt_i` blinds the leaf so a published leaf hash does not leak the
balance by brute force. `balance_i ∈ [0, 2^64)`.

### 2.2 Internal node

For children `L = (hash_L, sum_L)` and `R = (hash_R, sum_R)`:

```
node_sum   = sum_L + sum_R                    // CONSTRAINED equality (T1)
node_hash  = Poseidon(hash_L, sum_L, hash_R, sum_R)
```

Binding `sum_L` and `sum_R` into the parent hash is what makes the sum
tamper-evident: you cannot change a child's reported sum without changing every
ancestor hash up to the root.

### 2.3 Root

```
root = (root_hash, total_liabilities)
```

`total_liabilities` is the value wired into the solvency comparison. It is now an
*output of a constrained computation*, not an input scalar.

### 2.4 Parameters (v1) — MEASURED, not guessed (B-P0 spike)

The B-P0 spike compiled real Merkle-sum trees and measured constraint scaling
(`build/spike/`, `circom -p bls12381` + `snarkjs r1cs info`):

| depth | leaves | constraints |
|---|---|---|
| 2 | 4   | 5,090   |
| 3 | 8   | 10,985  |
| 4 | 16  | 22,776  |
| 6 | 64  | 93,526  |
| 8 | 256 | 376,532 |

Linear fit: **~1,474 constraints / leaf**. Therefore:

- **`depth = 8` (256 users): ~377K constraints -> `2^19` ptau (524,288).** This is
  the v1 in-repo target — proves in a single snarkjs run on the dev box.
- **`depth = 10` (1024 users): ~1.51M constraints -> `2^21` ptau (2,097,152).**
  Feasible but a large ptau download/compute; deferred to a documented heavier
  ceremony or to recursion (Milestone E). The earlier `2^20` estimate was wrong;
  measurement corrects it.
- Balance width `LB_BITS = 64`. Sum width at level `k`: `64 + k` bits,
  range-checked; root sum width `64 + depth` bits.
- Hash: Poseidon. Node hash uses 4 inputs (two `(hash,sum)` pairs) — within
  circomlib's 16-input limit, avoiding the `Poseidon(17)` overflow already fixed
  in `commit.circom`.

The spike also verified correctness: a 4-leaf tree of `[1000,2000,3000,4000]`
produced `total = 10000` exactly with a real Poseidon root. v1 ships at
`depth = 8`; these numbers are tunable, now grounded in measurement.

---

## 3. Circuit layer — file-level RPD

All new circuit files live under `circuits/`. The existing `por.circom` is
extended, not replaced, so the current single-statement proof keeps working
during the migration.

### 3.1 `circuits/components/merkle_sum_node.circom` (NEW)

- **Role.** One internal Merkle-sum node: constrain `node_sum = sum_L + sum_R`,
  range-check the sum, and compute `node_hash = Poseidon(hash_L, sum_L, hash_R,
  sum_R)`. This is the atomic tamper-evidence unit (defends T1, T3).
- **Public API (template).**
  ```
  template MerkleSumNode(sumBits) {
      signal input  hashL; signal input sumL;
      signal input  hashR; signal input sumR;
      signal output hash;  signal output sum;
  }
  ```
- **Detailed flow.**
  1. `sum <== sumL + sumR;` (linear constraint — exact equality, T1).
  2. `component rc = RangeCheck(sumBits); rc.in <== sum;` (T3 — no wraparound;
     reuses the existing `components/range_check.circom` Num2Bits bound).
  3. `component h = Poseidon(4); h.inputs <== [hashL, sumL, hashR, sumR];
     hash <== h.out;`
- **Pitfalls.** `sumBits` MUST grow by 1 per level; passing a too-small width
  silently re-enables T3. The template takes it as a parameter so the caller is
  forced to be explicit.

### 3.2 `circuits/components/merkle_sum_root.circom` (NEW)

- **Role.** Fold `2^depth` leaves into a single `(root_hash, total)` by chaining
  `MerkleSumNode` level by level. Leaf hashing + per-leaf range check happen here.
- **Public API (template).**
  ```
  template MerkleSumRoot(depth, balBits) {
      signal input userId[2**depth];
      signal input balance[2**depth];
      signal input salt[2**depth];
      signal output rootHash;
      signal output total;
  }
  ```
- **Detailed flow.**
  1. For each leaf `i`: `RangeCheck(balBits)` on `balance[i]` (T2). Compute
     `leafHash[i] = Poseidon(userId[i], balance[i], salt[i])`,
     `leafSum[i]   = balance[i]`.
  2. Level fold: for level `k` from `0..depth-1`, instantiate `2^(depth-1-k)`
     `MerkleSumNode(balBits + k + 1)` consuming level-`k` pairs, producing
     level-`k+1` `(hash, sum)`.
  3. `rootHash <== topNode.hash; total <== topNode.sum;`
- **Pitfalls.** Leaf ordering MUST be canonical (sorted by `userId`) so the same
  user set always yields the same root — otherwise inclusion proofs and the
  published root disagree. The SDK tree builder enforces the same ordering; the
  circuit assumes the witness supplies leaves already in that order (documented
  invariant, checked by the SDK, not re-sorted in-circuit).

### 3.3 `circuits/components/merkle_sum_inclusion.circom` (NEW)

- **Role.** Prove one leaf is included in a published `(rootHash, total)` without
  revealing siblings (defends T4; user-facing privacy). This is the per-user
  proof, separate from the issuer aggregation proof.
- **Public API (template).**
  ```
  template MerkleSumInclusion(depth, balBits) {
      // public:  userId, claimedBalance, rootHash, total
      // private: salt, pathHash[depth], pathSum[depth], pathDir[depth]
  }
  ```
- **Detailed flow.**
  1. Recompute `cur = (Poseidon(userId, claimedBalance, salt), claimedBalance)`.
  2. For each level `k`: order `(cur, sibling)` by `pathDir[k]` (a `Switcher`
     from circomlib), then `MerkleSumNode(balBits+k+1)` to get the parent.
  3. Assert final `parent.hash === rootHash` and `parent.sum === total`.
  4. `RangeCheck(balBits)` on `claimedBalance` (T2 at the leaf).
- **Pitfalls.** `pathDir[k]` must be boolean-constrained (`d*(d-1)===0`) or a
  malicious witness can mis-route the path. The `Switcher` swap must feed the
  node in the exact `(L,R)` order the aggregation used.

### 3.4 `circuits/por_v2.circom` (NEW — top-level solvency-with-liabilities)

- **Role.** The Milestone-B main circuit: bind reserves to a SNARK-proven
  liability total. Supersedes `por.circom` once verified; both coexist during
  migration behind distinct VKs.
- **Public signals (NEW ABI — regenerate `PUBLIC_SIGNALS.md`, invariant 2):**
  ```
  [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
  [    0    ,         1         ,    2    ,     3    ,    4   ]
  ```
- **Detailed flow.**
  1. Reserve side (reuse existing): `SumGte`-style `sum(reserves) >= liabTotal`,
     `ReserveCommit` -> `reserveCommitment`.
  2. Liability side: `MerkleSumRoot(depth, 64)` over private per-user leaves ->
     `(liabRoot, liabTotal)`. `liabTotal` is the SAME signal fed into the
     solvency comparison — this is the crux: the comparison consumes a proven
     value, not an input scalar.
  3. `period` passthrough binds the whole statement to the reporting period (T5).
  4. `solvent <== gte.out;`
- **Pitfalls.** Constraint count grows with `2^depth`; v1 `depth=10` is the
  compile/prove budget ceiling on the dev box. If it exceeds snarkjs limits,
  fall back to `depth=8` (256 users) for the in-repo proof and document the
  production path (recursion, Milestone E) rather than silently shrinking.

### 3.5 `circuits/inputs/` (NEW fixtures)

- `liab_solvent.json`, `liab_insolvent.json`, `liab_understated.json` (a T1
  attack input: internal sum < children), `liab_negative.json` (T2). Each drives
  a witness-generation test; the attack inputs MUST fail to produce a witness.

---

## 4. Contract layer — file-level RPD (`contracts/stellaris/src/`)

The contract gains a v2 attest path. v1 stays intact so existing attestations and
tests keep passing; v2 is additive behind a separate VK and storage namespace.

### 4.1 `types.rs` (EXTEND)

- **Role.** Add v2 public-signal indices, the extended attestation record, and a
  liability-root storage key.
- **Changes.**
  ```rust
  // v2 public-signal indices (mirror PUBLIC_SIGNALS.md v2)
  pub const SIG2_SOLVENT: usize = 0;
  pub const SIG2_RESERVE_COMMITMENT: usize = 1;
  pub const SIG2_LIAB_ROOT: usize = 2;
  pub const SIG2_LIAB_TOTAL: usize = 3;
  pub const SIG2_PERIOD: usize = 4;
  pub const N_PUBLIC_SIGNALS_V2: usize = 5;

  #[contracttype] #[derive(Clone, Debug, PartialEq)]
  pub struct AttestationV2 {
      pub reserve_commitment: U256,
      pub liab_root: U256,        // NEW — SNARK-proven liability root
      pub liab_total: u128,       // NEW — proven, not declared
      pub solvent: bool,
      pub ledger_ts: u64,
      pub period_id: u64,
      pub issuer: Address,
  }
  ```
  Add `DataKey::AttestV2(Address, u64)` and `DataKey::VkV2`.
  Add error variants: `BadLiabilityRoot = 9`, `WrongVerifierVersion = 10`.
- **Pitfalls.** Do NOT mutate the existing `Attestation`/`SIG_*`; v1 callers and
  the 11 passing tests depend on them. v2 is a parallel type.

### 4.2 `signals.rs` (EXTEND)

- **Role.** Add `parse_public_signals_v2` returning a `ParsedSignalsV2` with the
  5-signal layout, reusing the same field-element discipline.
- **Detailed flow.** Identical structure to `parse_public_signals` but: length
  check `== 5`; extract `liab_root` as `U256` (no truncation — it's a hash, kept
  full-width); `liab_total` via `to_u128` with overflow guard; `reserve_commitment`
  kept as `U256`; build the `Vec<Fr>` of all 5 for the pairing input.
- **Pitfalls.** `liab_root` is a Poseidon field element, NOT a number — never
  `to_u128()` it. Keep it `U256` end-to-end so it round-trips to the SDK.

### 4.3 `verifier.rs` (UNCHANGED logic, NEW VK instance)

- **Role.** The pairing check is statement-agnostic — it already verifies any
  Groth16 proof against any VK with `ic.len() == n_pub + 1`. v2 just supplies a
  VK with `ic.len() == 6` (5 signals + 1).
- **Change.** None to `verify_proof`. Add a doc note that `ic.len()` selects the
  statement arity, so the same function serves v1 (`ic=5`) and v2 (`ic=6`).
- **Pitfalls.** The `pub_signals.len() + 1 != vk.ic.len()` guard already prevents
  feeding a v1 proof to the v2 VK and vice-versa — keep it; it's the arity gate.

### 4.4 `lib.rs` (EXTEND — new entrypoints)

- **Role.** Add `init_v2`, `attest_v2`, `get_attestation_v2`, `get_vk_v2`.
- **`attest_v2` detailed flow.**
  ```
  fn attest_v2(env, issuer, proof, pub_signals) -> Result<AttestationV2, Error>:
    1. require_issuer_auth(&issuer)
    2. vk = load_vk_v2(&env)?                         // VkV2 (ic.len()==6)
    3. parsed = parse_public_signals_v2(&env, &pub_signals)?
    4. ok = verify_proof(&env, &vk, &proof, &parsed.fr_signals)?  // real pairing
       if !ok -> Err(ProofInvalid)
    5. if !parsed.solvent -> Err(NotSolvent)
    6. if has_attestation_v2(&env, &issuer, parsed.period_id)
         -> Err(PeriodAlreadyAttested)              // T5 replay guard
    7. att = AttestationV2 { reserve_commitment, liab_root, liab_total,
                             solvent:true, ledger_ts: now, period_id, issuer }
    8. store_attestation_v2(&env, &att); append_period(&env, &issuer, period)
    9. publish AttestationRecordedV2 event; Ok(att)
  ```
- **Pitfalls.** Same auth-before-work ordering as v1 (the `require_auth` must run
  before any state read, matching the existing `test_requires_auth`). The replay
  guard keys on `(issuer, period)` in the v2 namespace so a v1 and v2 attestation
  for the same period can coexist (different statements) — documented, intentional.

### 4.5 `storage.rs` (EXTEND)

- **Role.** Add `store_vk_v2`/`load_vk_v2`/`get_vk_v2`, `store_attestation_v2`/
  `load_attestation_v2`/`has_attestation_v2`, mirroring v1 with the `VkV2` /
  `AttestV2` keys. `append_period`/`list_periods` are shared (period list is
  statement-agnostic).
- **Pitfalls.** Distinct keys only; no shared VK slot. A single `init` that set
  both VKs would couple the migration — keep `init_v2` separate so v2 can be
  enabled independently.

### 4.6 `test.rs` + `test_fixtures.rs` (EXTEND)

- **Role.** Real v2 fixture-backed tests, same pattern as the existing 11.
- **New tests (all real, fixture-backed, no mocks):**
  - `test_attest_v2_solvent_real` — valid v2 proof stores `AttestationV2`.
  - `test_attest_v2_reject_insolvent_real` — solvent=0 -> `NotSolvent`.
  - `test_attest_v2_reject_understated` — a proof built from a forged liability
    tree never verifies (the witness can't be produced; fixture is the failure
    case proven off-chain, asserted as "no such valid proof exists").
  - `test_attest_v2_replay` — second attest in same period -> `PeriodAlreadyAttested`.
  - `test_v1_v2_isolation` — a v1 proof rejected by `attest_v2` (arity guard).
- **Fixture codegen.** Extend `setup/gen-contract-fixtures.mjs` to also emit the
  v2 VK + proof from `por_v2` into `test_fixtures.rs` (data-only, offline-safe).

---

## 5. SDK layer — file-level RPD (`client/src/`)

The SDK gains the liability-tree machinery (build, prove, verify-inclusion) and a
v2 attest path. The byte encoder (`encoding.ts`) is REUSED unchanged — points are
points; only the public-signal count and the new liability-root field differ.

### 5.1 `liabilities.ts` (NEW)

- **Role.** Build and operate the Merkle-sum liability tree off-chain. This is the
  custodian-side data structure and the user-side inclusion-proof source.
- **Public API.**
  ```ts
  export interface LiabilityLeaf { readonly userId: string; readonly balance: bigint; readonly salt: bigint; }
  export interface SumNode { readonly hash: string; readonly sum: bigint; }   // decimal field strings / bigint
  export interface LiabilityTree {
    readonly depth: number;
    readonly root: SumNode;
    readonly leaves: readonly LiabilityLeaf[];
    nodeAt(level: number, index: number): SumNode;
  }
  export interface InclusionWitness {
    readonly leafIndex: number;
    readonly balance: bigint;
    readonly siblings: readonly SumNode[];   // one per level, bottom-up
    readonly pathBits: readonly (0 | 1)[];   // left/right at each level
  }
  export function buildLiabilityTree(leaves: readonly LiabilityLeaf[], depth: number): LiabilityTree;
  export function inclusionWitness(tree: LiabilityTree, leafIndex: number): InclusionWitness;
  export function leafHash(leaf: LiabilityLeaf): string;   // Poseidon(userIdHash, balance, salt)
  export function nodeHash(left: SumNode, right: SumNode): string; // Poseidon(l.hash,l.sum,r.hash,r.sum)
  ```
- **Detailed flow (`buildLiabilityTree`).**
  1. Assert `leaves.length <= 2^depth`; pad with zero leaves
     (`balance=0, hash=H(0,0,0)`) to a full tree so the shape is fixed.
  2. Validate every `balance` in `[0, 2^64)` — throw `StellarisError.validation`
     otherwise (the off-chain mirror of the circuit's range check).
  3. Compute leaf nodes: `{ hash: leafHash(leaf), sum: leaf.balance }`.
  4. Fold upward: each parent `{ hash: nodeHash(l,r), sum: l.sum + r.sum }`,
     asserting `l.sum + r.sum < 2^(64+depth)` (overflow guard mirroring the circuit).
  5. Return the tree; `root.sum` is the total liabilities, `root.hash` the root.
- **Pitfalls.** Poseidon arity: `nodeHash` takes 4 inputs (two (hash,sum) pairs) —
  within circomlib's 16-input limit. Must use the SAME Poseidon parameterization
  as the circuit (BLS12-381 field) or roots won't match — this is the off-chain/
  in-circuit consistency trap; the cross-check test (5.4) is the gate.
- **CONFIRMED in B-P1 (critical):** `circomlibjs` `buildPoseidon()` is **BN254-only**
  (its field prime is the BN254 scalar field, NOT BLS12-381). It therefore CANNOT
  reproduce the in-circuit Poseidon when the circuit is compiled `-p bls12381` —
  the JS root will silently never equal the circuit root. Two consequences:
  (1) `liabilities.ts` cannot rely on circomlibjs for the canonical root; it needs
  a BLS12-381 Poseidon (e.g. a `-p bls12381` witness, a wasm Poseidon built for
  BLS, or a vetted BLS Poseidon impl). (2) For OFFLINE testing, the correct
  ground truth is the **circuit's own witness**: compile an aggregation circuit,
  generate its witness, and extract the root + sibling path from the witness
  signals (see `client/scripts/inclusion-witness.mjs` + `setup/inclusion-check.sh`,
  the proven B-P1 pattern). Note circom eliminates duplicate signals (level-0
  `curHash[i]` == `leafHash[i]`, root `curHash[base]` == `main.rootHash`), so
  expose leaf hashes as outputs and read the root from `main.rootHash`.

### 5.2 `liability-prove.ts` (NEW)

- **Role.** Generate the two v2 proofs via snarkjs against the `por_v2` /
  `inclusion` artifacts, mirroring `prove.ts`.
- **Public API.**
  ```ts
  export interface SolvencyV2Input {
    readonly reserves: ReserveInput;       // reuse existing ReserveInput
    readonly tree: LiabilityTree;
  }
  export function buildSolvencyV2Witness(input: SolvencyV2Input): Record<string, unknown>;
  export function generateSolvencyV2Proof(input: SolvencyV2Input, artifacts: ProvingArtifacts): Promise<ProofBundleV2>;
  export function generateInclusionProof(tree: LiabilityTree, leafIndex: number, artifacts: ProvingArtifacts): Promise<ProofBundle>;
  export function verifyInclusionLocal(vk: object, bundle: ProofBundle): Promise<boolean>;
  ```
- **Detailed flow (`buildSolvencyV2Witness`).** Combine the existing reserve
  witness (`buildWitnessInput`) with the liability-tree witness: the full tree's
  level sums + node hashes as private inputs, `liabRoot`/`liabTotal` as the bound
  public outputs. Shape matches `por_v2.circom`'s declared signals exactly.
- **Pitfalls.** `ProofBundleV2` has 5 public signals; reuse `parsePublicSignals`
  generalized to N (see 5.3). Do NOT fork the snarkjs call — same `fullProve`.

### 5.3 `signals.ts` / `domain.ts` (EXTEND)

- **Role.** Generalize public-signal parsing to the v2 layout without breaking v1.
- **Changes.** Add `parsePublicSignalsV2(signals): PublicSignalsV2` with fields
  `{ solvent, reserveCommitment, liabRoot, liabTotal, periodId }`. Add
  `ProofBundleV2` to `domain.ts` (proof + 5 publicSignals + parsed). Keep v1
  `parsePublicSignals` untouched.
- **Pitfalls.** `liabRoot` stays a decimal field string (not bigint-truncated) —
  same discipline as the contract's `U256` handling.

### 5.4 `liabilities.test` cross-check (NEW, in `stellaris-apps` test or core mjs)

- **Role.** The single most important correctness gate: the TS-built tree root
  MUST equal the circuit-computed root for the same leaves.
- **Flow.** Build a tree in TS; feed the same leaves to `por_v2`/`inclusion`
  witness gen; assert `tree.root.hash === public[SIG2_LIAB_ROOT]` and
  `tree.root.sum === public[SIG2_LIAB_TOTAL]`. This catches Poseidon-param drift.
- **Pitfalls.** Run against real artifacts (offline OK — circom+snarkjs present).

### 5.5 `stellar.ts` (EXTEND — `attestV2`)

- **Role.** High-level v2 attest, mirroring `attest`.
- **Flow.** `attestV2(params)` → validate bundle (reserve commitment vs signals,
  liab root present) → `plan("attest_v2", [issuer, bundle.proof, bundle.publicSignals])`
  → `transport.invoke` → `decodeAttestationV2(result.value)`. The proof arg is the
  raw snarkjs proof; the contract codec (v2 path) serializes via the shared encoder.
- **Pitfalls.** Reuse the connected-path fix: pass `bundle.proof` (snarkjs shape),
  NOT a decimal tuple. The codec's `attest_v2` arm wraps 5 signals as ScU256.

### 5.6 transport `contract-codec.ts` (EXTEND in `stellaris-apps`)

- **Role.** Add the `attest_v2` operation arm: same proof ScMap (a/b/c), but a
  5-element `Vec<U256>` for public signals.
- **Pitfalls.** Operation registry (`operations.ts`) must add `attest_v2` with the
  5-signal arg type; the arity flows to the codec. One ABI source.

---

## 6. Setup / tooling layer — file-level RPD (`setup/`)

### 6.1 `ceremony-v2.sh` (NEW)

- **Role.** Trusted setup for the two new circuits (`por_v2`, `inclusion`). Same
  structure as `ceremony.sh` but compiles two circuits and reuses one larger ptau.
- **Detailed flow.**
  1. Compile `circuits/por_v2.circom` and `circuits/inclusion.circom` with
     `circom -p bls12381 -l <circomlib> --r1cs --wasm --sym -o build/`.
  2. Powers of tau: `por_v2` is bigger (Merkle-sum + reserves). Estimate
     constraints first (`snarkjs r1cs info`) and pick `2^k >= constraints`.
     v1 was 2084 → `2^12`. The Merkle-sum over depth-`d` tree adds ~`(2^d - 1)`
     node hashes × Poseidon(4) (~240 constraints each) + range checks. For
     `depth=10` (1024 users) expect ~10^5–10^6 constraints → `2^20`-ish ptau.
     **Pick k from measured `r1cs info`, never guess.**
  3. groth16 setup → `por_v2_final.zkey`, `inclusion_final.zkey`; export both VKs.
- **Pitfalls.** Larger ptau download/compute is slow. Document the measured `k`.
  This is the one step that may need real compute time; gate it behind the
  constraint count.

### 6.2 `export-fixtures-v2.sh` (NEW)

- **Role.** Generate real v2 fixtures: a solvency-v2 proof and a per-user
  inclusion proof, both snarkjs-verified.
- **Flow.** Mirror `export-fixtures.sh`; add a `circuits/inputs/liabilities.json`
  (a small set of user balances) and emit `fixtures/v2/solvency/`,
  `fixtures/v2/inclusion/`, plus the v2 VKs. Strip non-signal keys (the
  `description` fix from `export-fixtures.sh` carries over).

### 6.3 `gen-contract-fixtures-v2.mjs` (NEW)

- **Role.** Codegen `contracts/stellaris/src/test_fixtures_v2.rs` (data-only) from
  the v2 proofs/VK — same approach as the v1 codegen (offline, no Rust JSON deps).

### 6.4 `liability-attack-check.sh` (NEW — the headline negative test)

- **Role.** Prove the Maxwell negative-balance / forged-sum attack is defended:
  attempt to generate a `por_v2` proof where an internal node sum is LESS than the
  true sum of its children (understated liabilities). Assert witness generation
  FAILS (the `ParentSumEquals`/range constraints are unsatisfiable).
- **Flow.** Build a malicious witness JSON with a tampered intermediate sum; run
  `snarkjs wtns calculate`; assert non-zero exit + constraint error. Add a second
  case: a leaf balance `>= 2^64`. Mirror `negative-witness-check.sh` structure.
- **Exit gate.** This script passing IS the cryptographic proof that B2 (attack
  defense) works. It is the most important artifact in the milestone.

---

## 7. Phased execution sequence (build-first, test-soon; each phase has an exit gate)

Ordered by dependency. Do not start a phase until the prior gate is green. Every
phase ends with: update CHANGELOG, re-run the full regression, mark the ROADMAP.

- **B-P0 — circomlib spike (offline). [DONE]** `merkle_sum_node.circom` +
  `merkle_sum_root.circom`; compiled `depth=2` spike; measured constraint scaling
  (5,090 @ d2 … 376,532 @ d8, ~1,474/leaf). GATE MET: compiles under `-p bls12381`;
  counts recorded → v1 depth=8 → 2^19 ptau. Witness: 4 leaves → total=10000 exact.
- **B-P1 — inclusion circuit. [DONE]** `merkle_sum_inclusion.circom` +
  `inclusion.circom` (depth=8, 3,300 constraints). GATE MET (`setup/inclusion-check.sh`,
  3/3): a real path proves, wrong-balance + corrupted-sibling fail. Ground truth
  from the aggregation circuit's own witness (circomlibjs is BN254-only — see §5.1).
- **B-P2 — solvency-v2 circuit. [DONE]** `por_v2.circom` (16 reserves, depth=8,
  380,408 constraints) binds `sum(reserve) >= liabTotal` with `liabTotal` SNARK-bound
  to the Merkle-sum root. GATE MET (`setup/por-v2-check.sh`): witness proves
  solvent=1, liabTotal=76200 from the tree; 5 public outputs in ABI order
  `[solvent, reserveCommitment, liabRoot, liabTotal, period]`; liabRoot matches the
  B-P1 standalone tree root. PUBLIC_SIGNALS.md v2 mirroring to be finalized in B-P4.
- **B-P3 — attack defense (the headline). [DONE]** `setup/liability-attack-check.sh`
  (2/2). GATE MET: a leaf balance `2^64` fails at `Num2Bits` (T2/T3); honest control
  proves. T1 (forged internal sum) is defended STRUCTURALLY — `por_v2` recomputes
  every node sum from leaves inside the circuit, so there is no witness slot to forge.
- **B-P4 — contract v2. [DONE]** `attest_v2`/`init_v2`/`get_attestation_v2` + v2
  storage (`VkV2`, `AttestV2`) + `AttestationV2` + `test_fixtures_v2.rs` (real
  depth-4 proofs from `setup/ceremony-v2.sh` + `export-fixtures-v2.sh`). GATE MET:
  `cargo test` 18/18 (11 v1 untouched + 7 v2) — solvent stores `AttestationV2`
  with SNARK-proven `liab_total`; insolvent (valid proof, solvent=0) → `NotSolvent`;
  replay → `PeriodAlreadyAttested`; v1 proof rejected by `attest_v2` (arity guard);
  `attest_v2` before `init_v2` → `NotInitialized`. NOTE: in-repo ceremony is
  depth-4 (16 users, 2^15 ptau) — the depth-8 (256-user, 2^19 ptau) setup OOM'd a
  15Gi box. The contract path is depth-AGNOSTIC (5-signal ABI, IC.len()==6); only
  the trusted-setup size differs. Production depth-8/10 is a documented heavier-
  ceremony / recursion concern (ROADMAP Milestone E), NOT a statement change.
- **B-P5 — SDK + transport v2. [PARTIAL/DONE]** `attestV2`/`getAttestationV2` on
  `StellarisClient`, `AttestationV2`/`ProofBundleV2`/`PublicSignalsV2` domain types,
  `decodeAttestationV2`, the operations registry v2 ops (`init_v2`/`attest_v2`/
  `get_attestation_v2`/`get_vk_v2`), and the transport codec `attest_v2` arm.
  GATE MET (`attest-v2-e2e.test.ts`, apps 42/42): `client.attestV2()` produces
  byte-identical on-chain proof bytes for the 5-signal statement; the codec accepts
  the SDK's args. DEFERRED: `liabilities.ts` tree builder + `liability-prove.ts`
  (the custodian-side tree + per-user inclusion proof) need a BLS12-381 off-chain
  Poseidon — circomlibjs is BN254-only (B-P1 finding), so the canonical-root builder
  is blocked offline. The v2 attest path itself does NOT need it (the snarkjs proof
  already carries the circuit-computed liabRoot/liabTotal); the tree builder is a
  user-facing convenience tracked for when a BLS Poseidon is available.
- **B-P6 — example app surface. [DONE]** Both legs now complete.
  ISSUER LEG: the apps mock runtime (`MockSorobanTransport`) mirrors the v2
  contract state machine (`init_v2`/`attest_v2`/`get_attestation_v2`/`get_vk_v2`,
  with NotInitialized/NotSolvent/PeriodAlreadyAttested/ProofInvalid/Unauthorized
  gating + v1/v2 store isolation), and `integration-v2.test.ts` drives the REAL
  depth-4 snarkjs fixtures (`fixtures/v2/{solvency,insolvent}`) through the full
  `client.attestV2()` → transport → mock-contract path. SDK gained the v2 signal
  layer (`parsePublicSignalsV2`/`encodePublicSignalsV2`, `N_PUBLIC_SIGNALS_V2=5`,
  `SIGNAL_INDEX_V2_*`). apps 50/50 (+8 v2 integration tests).
  USER/VERIFIER LEG (was the blocked B3 inclusion proof — UNBLOCKED once the v2
  ceremony produced `build/v2/inclusion_final.zkey`+`inclusion_vk.json`):
  `setup/inclusion-prove.sh` generates a REAL Groth16 per-user inclusion proof
  (depth-4, leaf #5 / userId=6 / balance=500) and verifies it against the
  ceremony VK (snarkjs `OK!`), with `fixtures/v2/inclusion/{proof,public,
  verification_key_inclusion}.json` as artifacts. THE TIE (headline): the
  inclusion proof's public `rootHash`/`total` are byte-equal to the solvency
  fixture's `liabRoot`/`liabTotal` (4676714…347 / 4300) — a user verifies
  inclusion against the SAME root the issuer attested. SOUNDNESS: forged
  `wrong_balance` and `corrupted_sibling` claims both fail witness calculation.
  The BLS12-381 off-chain Poseidon is sourced from the aggregation circuit's own
  witness (`agg_spike_repo.circom`, depth-4) — the B-P1 extract-from-witness
  pattern — so no circomlibjs/BN254 dependency. The remaining `liabilities.ts`
  pure-TS tree builder (rebuilding the root from scratch in TS, not from a
  witness) is the only piece still gated on an installable BLS Poseidon; the
  end-to-end PROOF path it would replace is fully exercised.

---

## 8. Test matrix (every claim has a failing-case test)

| Claim | Positive test | Negative test |
|---|---|---|
| Range checks bite | honest balance proves | `>=2^64` → no witness (`liability-attack-check.sh`) |
| Parent sum is exact | honest tree proves | forged internal sum → no witness |
| Inclusion is sound | real path verifies | wrong sibling → verify=false / no witness |
| Root binds total | `liabTotal == root.sum` | tamper total → proof rejected on-chain |
| TS/circuit agree | `tree.root === public[liabRoot]` | param drift → cross-check fails |
| Reserves ≥ liabilities | solvent proves, contract stamps | insolvent → contract `NotSolvent` |
| No replay | first attest_v2 OK | same period → `PeriodAlreadyAttested` |
| Byte encoding | v2 proof bytes == on-chain layout | (reuses encoding byte-equality test) |

---

## 9. What this milestone explicitly does NOT do (honest boundary)

- Does not prove reserves correspond to real exclusively-controlled on-chain
  assets — that is Milestone C (custodian-signed input).
- Does not hide the tree depth / user count from the contract (the depth is a
  public circuit parameter). Per-user balance privacy IS preserved.
- Does not provide non-collusion proofs (Provisions' optional protocol) — noted
  as possible future work, not in scope.

---

## 10. Cross-references

- Direction: `docs/ROADMAP.md` Milestone B.
- Status authority: `docs/CHANGELOG.md` [Unreleased].
- Invariants: `docs/AGENTS.md` (public-signal ABI, single encoder, real-artifacts).
- Builds on: `circuits/components/{range_check,sum_gte,commit}.circom`,
  `client/src/encoding.ts` (reused unchanged), `setup/ceremony.sh` pattern.
