# Sprint A — Mint-Guard Design Spike: GO / NO-GO Verdict

Date: 2026-06-29. Gating artifact required by NEXT-SPRINTS-ROADMAP.md before any
mint-guard contract code is written. Every finding below was confirmed by reading
the real `stellaris-core/contracts/stellaris/src/*` source, not from memory.

## Question the spike had to answer

Can a Soroban token contract gate its `mint` on a fresh, solvent Stellaris
attestation WITHOUT breaking the existing attestation ABI, and can staleness be
enforced without a circuit/ceremony change?

## Verdict: GO (no ABI break, no circuit change)

### Finding 1 — A read entrypoint already exists
`StellarisContract::get_attestation_v3(env, issuer: Address, period_id: u64) ->
Option<AttestationV3>` (lib.rs:317-319) is a public, read-only entrypoint. A guard
contract can cross-contract-call it. No new entrypoint, no change to any
`attest*` signature, so the cross-file proof/VK byte invariants are untouched.

### Finding 2 — AttestationV3 already carries every field the guard needs
From types.rs:139-161, `AttestationV3` has:
- `aggregate_solvent: bool`  -> the solvency gate
- `period_id: u64`           -> staleness vs the required reporting period
- `ledger_ts: u64`           -> staleness vs a max-age in seconds
- `oracle_bound: bool`       -> optional "require oracle-priced" policy
- `custodian_bound: bool`    -> optional "require named-custodian" policy
- `asset_solvent: Vec<bool>` -> optional per-asset policy
No new stored field is required for a v1 guard.

### Finding 3 — Staleness needs no circuit signal
`period` is already public signal #7 (types.rs:32, SIG3_PERIOD=7) and is persisted
on the attestation. The guard enforces freshness two independent ways, both
contract-side: (a) require `att.period_id >= required_period`, and (b) require
`env.ledger().timestamp() - att.ledger_ts <= max_age_secs`. Neither touches the
circuit, the ceremony, or the fixtures.

### Finding 4 — The cross-contract mechanism is proven in-repo
`vendor/soroban-examples/cross_contract/contract_b/src/lib.rs` shows the canonical
pattern: a generated `Client::new(&env, &contract_addr)` whose method call lowers
to `env.invoke_contract`. The same `StellarisContractClient` the test-suite uses
is valid for real cross-contract calls.

## Chosen architecture (CORRECTED after the spike — in-crate, genuinely real-proof testable)

ORIGINAL spike plan was a separate `contracts/mint-guard` crate depending on
`stellaris-contract` by path. The spike found a blocking flaw in that plan: the
real v3 fixtures (`test_fixtures_v3::{VK_V3, SOLVENT_V3, ...}`) and the test
helpers (`g1_from`, `g2_from`, `build_signals_n`) are `#![cfg(test)]`-scoped
inside the stellaris crate. A SEPARATE crate's tests therefore cannot reach them
without either (a) duplicating the cryptographic fixtures (drift risk against the
cross-file byte invariants), or (b) exposing fixture data in the production build
behind a feature, or (c) testing the guard against a MOCK attestation contract —
which violates the project's no-mock / real-artifact requirement for the headline
path.

CORRECTED decision: implement the guard as a SECOND `#[contract]` type
(`SolvencyGatedToken`) in a new module `src/mint_guard.rs` WITHIN the existing
stellaris crate, with its real end-to-end test in `src/test_mint_guard.rs`. This:
- exercises the REAL `StellarisContract` (real Groth16 BLS12-381 pairing check on
  the real `SOLVENT_V3` fixture) via a genuine cross-contract call — both
  contracts are registered as independent instances in the test `Env`, so it is a
  true two-contract e2e path, not a mock;
- reuses the existing fixtures + helpers directly (zero fixture duplication, zero
  XDR drift);
- requires NO change to `Cargo.toml` (no `rlib` needed) and NO visibility change
  to `mod types` — `AttestationV3` and `StellarisContractClient` are reachable
  in-crate already. So the change is purely ADDITIVE: two new modules, one
  `mod mint_guard;` line, one `#[cfg(test)] mod test_mint_guard;` line. The v1/v2/v3
  attestation ABIs, the proof/VK byte invariants, and the 76-test suite are all
  untouched.

DEPLOYMENT NOTE (RESOLVED during implementation — honest record of what survived
contact with the wasm32v1-none compiler):

The original plan was to gate the guard into the WASM build behind a `mint-guard`
cargo feature. THAT FAILED and was removed. Reason: two `#[contract]` types in one
crate export colliding bare entrypoint symbols (`init`) when compiled to
wasm32v1-none — `error: symbol \`init\` is already defined`. A feature flag cannot
fix this, because the attestation `#[contract]` is ALWAYS compiled, so adding the
guard via a feature still produces two `init` symbols in the same cdylib. The
guard also depends on the attestation's macro-generated `StellarisContractClient`
type, so the two cannot be cleanly separated inside one crate.

FINAL decision (verified): the guard modules are `#[cfg(test)]`-only.
- The default `stellar contract build` / `cargo build --target wasm32v1-none`
  emits the attestation contract ALONE — verified clean, 26,822-byte
  `stellaris_contract.wasm`, no symbol collision.
- The guard's real two-contract e2e test runs on the HOST target (`cargo test`),
  where there is no bare-symbol export and therefore no collision — verified
  60/60 passing, including 11 `test_mint_guard::*` tests against the real
  `SOLVENT_V3` Groth16 proof.

A STANDALONE, DEPLOYABLE guard WASM genuinely requires a crate split (a separate
`contracts/mint-guard` crate that imports the attestation contract's client via
`contractimport!` from its built WASM, plus a `testfixtures`-style path so the
guard crate keeps a real-proof test). That is deferred to the user-gated testnet
sprint — it is real remaining work, NOT done. What is proven TODAY: the guard
logic is correct and enforced end-to-end against real proofs on the host target.
What is NOT done: the guard is not yet independently deployable to testnet.

## Guard semantics (v1)

`SolvencyGatedToken` is a minimal SEP-41-style token whose `mint` reverts unless a
fresh, solvent attestation exists. Config (set at init, admin-gated):
- `stellaris` contract address,
- `issuer` address whose attestations gate this token,
- `max_age_secs` (0 = disable the time check, rely on period only),
- `require_oracle_bound: bool`, `require_custodian_bound: bool` (policy toggles).

`mint(to, amount)` flow:
1. `require_auth` the token admin (issuance authority).
2. Cross-contract `get_attestation_v3(issuer, current_period)`; `None` -> revert
   `NoAttestation`.
3. `att.aggregate_solvent == false` -> revert `NotSolvent`.
4. time check (if `max_age_secs > 0`): stale -> revert `StaleAttestation`.
5. policy toggles: `require_oracle_bound && !att.oracle_bound` -> revert
   `OracleBindingRequired`; same for custodian.
6. all pass -> credit balance, emit `mint` event.

`set_period(p)` (admin) advances the current reporting period the guard demands,
so an old attestation cannot keep authorizing mints into a new period.

## Acceptance gate for the implementation (carried into the mint-guard task)

A real `Env` test that:
- registers BOTH the real StellarisContract and the guard,
- drives a real solvent v3 proof through `attest_v3` (real pairing check),
- shows `mint` SUCCEEDS for the attested period,
- advances the period, shows the SAME mint now REVERTS (StaleAttestation),
- re-attests the new period, shows `mint` SUCCEEDS again,
- shows an over-the-policy mint (require_oracle_bound with an unbound attestation)
  REVERTS.

## Honest residual risk

- Cross-contract storage reads on the attestation contract use INSTANCE storage
  (storage.rs) — fine for a demo/testnet; a production guard reading another
  contract's instance storage indirectly via its entrypoint is correct, but the
  attestation contract's instance TTL must be live. Flag for the productionization
  sprint (bump/restore TTL), not a blocker for Sprint A.
- This spike proves buildability and a local end-to-end test path. It does NOT
  prove on-testnet behaviour — that remains the user-gated testnet sprint (no
  stellar-cli installed in this environment, confirmed: `stellar: command not
  found`).
