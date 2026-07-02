# 04 — Plan Audit and Fixes Before Development

This document reviews the existing Plan step against the completed research and
competitor update. It identifies what is already strong, what must be fixed or
made explicit, and what is blocked until P0 verifies real tool behavior.

## Audit conclusion

The plan is strategically correct and still fits the research:
- Stellaris remains the lead idea.
- Circom Groth16 remains the lowest-risk path.
- The contract should stay focused: verify proof, reject insolvent state, reject
  period replay, store attestation.
- The demo should emphasize market validation: Binance and Chainlink prove PoR
  demand; Stellaris brings a Stellar-native ZK attestation layer.

However, the plan needs four development-readiness fixes:
1. Public signal ordering must be verified from actual snarkjs output, not assumed.
2. Proof/vk byte encoding must be locked from the official Stellar verifier before
   any custom converter is written.
3. The PoR statement must be made more exact: what the proof proves, what it does
   not prove, and how the demo data maps to production data.
4. The build phases need minor step gates: commands, expected outputs, failure
   handling, and file-level acceptance criteria.

## Fix 1 — Public signal order is a hard gate

Existing plan says the desired order is:

```text
[ solvent, C_commitment, L_liabilities, period_id ]
```

This is the right product-facing order, but development must verify that snarkjs
actually emits this order. In Circom, main component outputs are public, and
inputs listed in `component main { public [...] }` are public. The emitted
`public.json` order must be treated as source of truth after compilation.

### Development rule

Do not write `types.rs` signal constants until this command sequence produces a
real `public.json`:

```bash
circom circuits/por.circom --r1cs --wasm --sym -o build/circuits
snarkjs wtns calculate build/circuits/por_js/por.wasm circuits/inputs/solvent.json build/solvent.wtns
snarkjs groth16 prove build/por_final.zkey build/solvent.wtns build/proof.json build/public.json
cat build/public.json
```

Then record the actual order in:
- `circuits/PUBLIC_SIGNALS.md`
- `contracts/stellaris/src/types.rs`
- `client/src/constants.ts`
- `README.md`

### Acceptance gate

`build/public.json` must be manually compared to expected values from
`solvent.json`:
- `solvent` expected `1`
- `C_commitment` expected equal to the locally computed Poseidon hash
- `L_liabilities` expected equal to input L
- `period_id` expected equal to input period

If the order differs, update the constants. Do not change the circuit only to
fit the old assumption unless that is simpler and re-verified.

## Fix 2 — Verifier byte encoding is unknown until P0

Existing plan correctly warns that proof/vk byte encoding must match the official
`stellar/soroban-examples/groth16_verifier`. Make this stronger:

### Development rule

No custom `export-vk.sh` or `toContractArgs()` is allowed until P0 answers:
- Does the official verifier expect BN254 or BLS12-381 for the selected example?
- Does it accept JSON-like contract types, bytes, arrays, or generated Rust constants?
- What is the G1/G2 point order?
- What is the field-element endianness?
- Does it expect negated proof A or C, or any Solidity-style transformation?
- Does it include `IC[0]` plus public input IC points in the same order as snarkjs?

### Acceptance gate

The official tutorial proof must verify TRUE on our deployed testnet contract
before any Stellaris-specific proof is attempted. If the tutorial proof fails,
stop and debug encoding, not the Stellaris circuit.

## Fix 3 — Exact PoR proof statement

The MVP proof statement should be written exactly as:

```text
Given private reserve balances r[0..15] and private salt s,
and public liabilities L and public period_id,
prove:
  1. every reserve balance r[i] is a 64-bit unsigned integer,
  2. total = sum(r[i]) is computed correctly,
  3. total >= L,
  4. C = Poseidon(r[0], ..., r[15], s),
  5. the emitted public solvent flag is 1 iff total >= L,
  6. the proof is bound to period_id.
```

The proof does NOT prove:
- bank balances exist,
- wallet addresses belong to the issuer,
- liabilities are complete,
- the issuer did not borrow temporarily before snapshot,
- multi-asset prices are correct.

These are roadmap items, not MVP.

## Fix 4 — Plan must include minor-step gates

The old plan has good phases but lacks enough minor steps for development. Use
`plan/05-DEVELOPMENT-PLAYBOOK.md` as the implementation checklist. Each phase
has:
- purpose,
- file writes,
- exact sequence,
- expected output,
- failure handling,
- acceptance criteria.

## Recommended scope after audit

Keep MVP narrow:
- one issuer address,
- one reserve vector of up to 16 integer balances,
- one liability number,
- one period id,
- one attestation per `(issuer, period_id)`,
- local/browser proof generation,
- testnet deployment.

Do not add before submission:
- Chainlink integration,
- custodian signature verification,
- multi-asset price feeds,
- recursive proofs,
- liabilities Merkle tree,
- confidential token transfers,
- private payment pool features.

## Updated plan status

Proceed to development only when:
- P0 toolchain is available,
- official verifier behavior is observed,
- public-signal order is verified from `public.json`,
- byte encoding is confirmed by a true testnet verification,
- user confirms testnet-only MVP remains acceptable.
