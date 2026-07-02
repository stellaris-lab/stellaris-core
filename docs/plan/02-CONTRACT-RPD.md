# 02 — Contract RPD (Soroban verifier + attestation registry, Rust)

The on-chain side. Rust + soroban-sdk. Mirrors the official
`stellar/soroban-examples/groth16_verifier` for the verify glue; adds the
attestation registry and anti-replay on top.

VERIFY-BEFORE-BUILD: clone the official verifier in P0 and confirm the exact
verify function name, argument types, and byte encoding BEFORE writing these
files. Signatures below are the planned shape; reconcile with the real repo.

---

### 2.1 `contracts/stellaris/src/types.rs`

**R - Role**
Single source of truth for the contract's data types, storage keys, errors, and
the public-signal index constants shared conceptually with circuit/client.

**P - Public API**
```rust
#[contracttype]
pub struct Attestation {
    pub commitment: BytesN<32>,   // C (Poseidon commitment)
    pub liabilities: u128,        // L, declared
    pub solvent: bool,
    pub ledger_ts: u64,           // env.ledger().timestamp()
    pub period_id: u64,           // reporting period
    pub issuer: Address,
}

#[contracttype]
pub enum DataKey {
    Vk,                           // stored verification key bytes
    Admin,                        // issuer/admin address
    Attest(Address, u64),         // (issuer, period_id) -> Attestation
    Periods(Address),             // issuer -> Vec<u64> of attested periods
}

#[contracterror]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ProofInvalid = 4,
    NotSolvent = 5,
    PeriodAlreadyAttested = 6,    // anti-replay
    BadPublicSignals = 7,
}

// public-signal layout (must match circuit por.circom + client prove.ts)
pub const SIG_SOLVENT: usize = 0;
pub const SIG_COMMITMENT: usize = 1;
pub const SIG_LIABILITIES: usize = 2;
pub const SIG_PERIOD: usize = 3;
pub const N_PUBLIC_SIGNALS: usize = 4;
```

**D - Detailed Flow**
No logic; definitions only. The `Attest(issuer, period_id)` key is what enforces
one attestation per issuer per period (anti-replay). Keep `liabilities` as u128
to fit realistic figures; document conversion to/from the circuit field element.
The `commitment` storage type is provisional: if P0/P1 shows the verifier/client
naturally handles the Poseidon field element as `U256`, store it as `U256` or a
canonical decimal string instead of forcing `BytesN<32>`. The invariant is not
the Rust type; the invariant is that the stored commitment equals the public
signal emitted by the verified proof.

---

### 2.2 `contracts/stellaris/src/verifier.rs`

**R - Role**
Wrap Groth16 verification using Stellar BN254 host functions (or the official
example's verify routine) so `lib.rs` calls one clean function.

**P - Public API**
```rust
pub fn groth16_verify(
    env: &Env,
    vk: &Bytes,            // stored verification key
    proof: &Bytes,         // Groth16 proof bytes
    public_signals: &Vec<U256>,  // or the example's expected type
) -> bool;
```

**D - Detailed Flow**
1. Decode vk into G1/G2 points (alpha, beta, gamma, delta, IC[]).
2. Compute the linear combination `vk_x = IC[0] + Σ public_signals[i]*IC[i+1]`
   using `bn254_g1_add` / `bn254_g1_mul` (P25/26 host fns).
3. Run `bn254_multi_pairing_check` over the proof's A,B,C and vk terms.
4. Return the pairing result as bool.
Pitfall: this is exactly the official example's job — PREFER calling/adapting
its code over re-deriving. The only thing we own is passing OUR `public_signals`
in the locked order. Confirm whether the example takes `Vec<U256>`, `Bytes`, or
field-element wrappers, and match it.

---

### 2.3 `contracts/stellaris/src/lib.rs`

**R - Role**
Contract entry points: initialize, submit an attestation (verify proof + record
solvency + block replay), and read attestations.

**P - Public API**
```rust
#[contract]
pub struct StellarisContract;

#[contractimpl]
impl StellarisContract {
    pub fn init(env: Env, admin: Address, vk: Bytes) -> Result<(), Error>;

    pub fn attest(
        env: Env,
        issuer: Address,
        proof: Bytes,
        public_signals: Vec<U256>,
    ) -> Result<Attestation, Error>;

    pub fn get_attestation(
        env: Env, issuer: Address, period_id: u64
    ) -> Result<Attestation, Error>;

    pub fn list_periods(env: Env, issuer: Address) -> Vec<u64>;
}
```

**D - Detailed Flow for `attest`**
1. `issuer.require_auth()` — only the issuer can attest for themselves.
2. Load `vk` from storage; `Error::NotInitialized` if absent.
3. Validate `public_signals.len() == N_PUBLIC_SIGNALS` else `BadPublicSignals`.
4. Extract `solvent`, `commitment`, `liabilities`, `period_id` by the actual
   index order recorded in `circuits/PUBLIC_SIGNALS.md`.
5. Validate `solvent` is exactly 0 or 1; any other field value =>
   `BadPublicSignals`.
6. Validate `liabilities` fits the chosen storage type (`u128` in MVP); overflow
   => `BadPublicSignals`.
7. Validate `period_id` fits `u64`; overflow => `BadPublicSignals`.
8. `groth16_verify(...)` -> false => `Error::ProofInvalid`.
9. Assert `solvent == 1` else `Error::NotSolvent` (insolvent proof rejected —
   the on-camera differentiator).
10. Replay check: if `DataKey::Attest(issuer, period_id)` exists =>
   `Error::PeriodAlreadyAttested`.
11. Build `Attestation { ..., ledger_ts: env.ledger().timestamp() }`.
12. Persist under `Attest(issuer, period_id)`; push period into `Periods(issuer)`.
13. Emit event `("attested", issuer, period_id, solvent)`; return Attestation.

**D - Detailed Flow for `init`**
1. If `Admin` set => `AlreadyInitialized`. 2. Store `admin`, `vk`. 3. Done.

---

### 2.4 `contracts/stellaris/src/test.rs`

**R - Role**
Prove the contract behaves: valid proof attests, tampered proof rejected, replay
rejected, insolvent rejected.

**P - Public API (test fns)**
- `test_attest_valid_solvent()` — happy path stores attestation.
- `test_reject_tampered_proof()` — flipped byte => `ProofInvalid`.
- `test_reject_insolvent()` — solvent=0 signals => `NotSolvent`.
- `test_reject_replay()` — second attest same period => `PeriodAlreadyAttested`.
- `test_requires_auth()` — missing issuer auth fails.

**D - Detailed Flow**
1. Use fixtures from the circuit: real vk + a real solvent proof + a real
   insolvent proof exported by `setup/export-vk.sh` (committed as test vectors).
2. For tampered: take the valid proof, flip one byte.
3. Use soroban-sdk test env (`Env::default()`, `mock_all_auths()` where needed;
   for `test_requires_auth` do NOT mock).
Pitfall: contract tests need REAL proof bytes — generate them in P2 and commit
them to `circuits/inputs/` so contract tests don't depend on a live prover.

---

### 2.5 `contracts/stellaris/Cargo.toml`

**R - Role**
Pin soroban-sdk to the Protocol 25/26-capable version that exposes BN254 host
functions; enable `testutils` for tests.

**D - Detailed Flow**
1. Confirm the exact soroban-sdk version from the official verifier example
   (do not guess "latest"); pin it.
2. `[features] testutils = ["soroban-sdk/testutils"]`.
3. `crate-type = ["cdylib"]`.
