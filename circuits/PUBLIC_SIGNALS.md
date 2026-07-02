# PUBLIC SIGNALS — Stellaris Circuit

> **STATUS (v1): VERIFIED.** The order below was confirmed against real
> `snarkjs groth16 prove` output during fixture generation
> (`setup/export-fixtures.sh`) and is mirrored in `contracts/.../types.rs`,
> `client/src/constants.ts`, and `client/src/signals.ts`. Do not change without
> re-running the byte/order equality tests.
>
> **v2 (Milestone B): VERIFIED.** `por_v2.circom` — 5-signal layout
> `[ solvent, reserveCommitment, liabRoot, liabTotal, period ]`, mirrored in
> `types.rs` (SIG2_*), `constants.ts` (SIGNAL_INDEX_V2_*), `signals.ts`. IC len 6.
>
> **v3 (Milestone C1): VERIFIED.** `por_v3.circom` — 8-signal multi-asset layout
> `[ aggregateSolvent, reserveCommitment, priceCommitment, assetSolvent[0..3],
> period ]`, mirrored in `types.rs` (SIG3_*), `constants.ts` (SIGNAL_INDEX_V3_*),
> `signals.ts` (parsePublicSignalsV3). IC len 9. Confirmed against real
> `snarkjs groth16 prove` output (`setup/export-fixtures-v3.sh`). All layouts are
> ADDITIVE — v1/v2/v3 coexist (parallel contract namespaces Vk/VkV2/VkV3).

## v1 order (VERIFIED)

Since all four values are declared as `signal output` in the main component
(in declaration order: `solvent`, `commitment`, `liabilities`, `period`) and
there are no `public` input declarations, snarkjs should emit:

```
public.json = [ solvent, commitment, liabilities, period ]
              [    0   ,     1     ,     2      ,   3    ]
```

Index 0: `solvent`     — "0" or "1" (field element)
Index 1: `commitment`  — Poseidon hash of r[0..15] + salt (field element)
Index 2: `liabilities` — Declared total liabilities (field element)
Index 3: `period`      — Reporting period identifier (field element)

## Verification gate

After compilation and proof generation, compare the emitted `public.json`
values against the expected values from the input JSON:

```bash
# Solvent case
circom circuits/por.circom --r1cs --wasm --sym --curve bls12381 -o build/
snarkjs wtns calculate build/por_js/por.wasm circuits/inputs/solvent.json build/solvent.wtns
snarkjs groth16 prove build/por.zkey build/solvent.wtns build/solvent_proof.json build/solvent_public.json
cat build/solvent_public.json
# Expect: ["1", "<poseidon_hash>", "2800000", "1"]
```

If the order differs, update this file and all dependent constants files:
- `contracts/stellaris/src/types.rs` (SIG_* constants)
- `client/src/constants.ts` (SIGNAL_INDEX_* constants)
- `client/src/prove.ts` (signal parsing)
- `README.md` (public signal documentation)

## Cross-reference

This file is the single source of truth referenced by:
- `AGENTS.md` (cross-file invariants, rule 1)
- `plan/04-PLAN-AUDIT-AND-FIXES.md` (development gate)
- `plan/05-DEVELOPMENT-PLAYBOOK.md` (P1 acceptance)
- `contracts/stellaris/src/types.rs`
- `client/src/constants.ts`
