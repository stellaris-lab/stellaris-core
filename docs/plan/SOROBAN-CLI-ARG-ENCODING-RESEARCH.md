# Soroban CLI Complex-Argument Encoding — Deep Research Findings

Status: RESEARCH COMPLETE. Resolves the open blocker for the Stellaris testnet
deploy: how `stellar contract invoke` expects the verification key + Groth16
proof (nested structs containing `BytesN<96>`/`BytesN<192>` fields, plus `Vec`)
encoded as CLI arguments.

Date: 2026-06-29. CLI verified locally: `stellar 27.0.0`.

---------------------------------------------------------------------------
## Question
---------------------------------------------------------------------------

`init(admin: Address, vk: Groth16VerificationKey)` and
`attest_v3(issuer: Address, proof: Groth16Proof, pub_signals: Vec<U256>)` take
complex Soroban struct arguments:

    Groth16VerificationKey { alpha: G1Affine, beta: G2Affine, gamma: G2Affine,
                             delta: G2Affine, ic: Vec<G1Affine> }
    Groth16Proof          { a: G1Affine, b: G2Affine, c: G1Affine }

where `G1Affine` is a 96-byte point and `G2Affine` a 192-byte point. How does
`stellar contract invoke` want these passed on the command line?

---------------------------------------------------------------------------
## Findings (convergent across 4 authoritative sources)
---------------------------------------------------------------------------

### F1 — The CLI builds a per-function argument parser FROM THE CONTRACT SPEC.
Anything after `--` ("the slop") is parsed by a clap command generated on the
fly from the contract's embedded `ScSpec`. Each function input becomes a
`--<arg_name>` flag, type-validated against its `ScSpecTypeDef`, and ALSO gets a
`--<arg_name>-file-path` file-input variant.
  Sources:
   - Stellar CLI Manual (developers.stellar.org/docs/tools/cli/stellar-cli):
     "Anything after the `--` ... is parsed as arguments to the contract-specific
     CLI, generated on-the-fly from the contract schema." Arg form is
     "`--arg-name value`".
   - DeepWiki reverse-engineering of cmd/soroban-cli/src/commands/contract/
     invoke.rs: "Dynamic CLI Generation ... Iterates over ScSpecFunctionV0 ...
     creates a clap::Arg with Long flag --<arg_name>, Type validation based on
     ScSpecTypeDef ... File-based input support: --<arg_name>-file-path".

### F2 — Complex types are passed as SPEC-DRIVEN JSON (soroban_spec_tools),
NOT XDR-JSON. The conversion is value-shaped to the contract type:
   - struct        -> JSON object keyed by field name
   - Vec<T>        -> JSON array
   - BytesN<N>/Bytes -> bare lowercase hex string (e.g. "ab12...")
   - U256/u64/i128 -> decimal string or number
   - enum (unit)   -> "VariantName"; enum (data) -> {"Variant":{...}}
   - Address       -> "G..."/"C..." string or identity alias
  Sources:
   - DeepWiki invoke.rs type table: "Enums/Unions -> JSON object or string";
     primitives via direct from_string; Bytes via hex / file path.
   - tupui/soroban (Python higher-level wrapper) documents the same value-JSON
     shape with nested `vec` arrays — confirms the value-shaped (not XDR-JSON)
     convention across the ecosystem.
   - custom-types example contract guide: structs are "a map of key-value pairs
     where the key is ... the field name" — the JSON object mirrors that.

### F3 — XDR-JSON (the `{"bytes":"..."}`-style wrapping) is a DIFFERENT schema.
It is used by `stellar xdr`, `stellar tx`, and the Lab "View XDR" — for encoding
whole XDR structures round-trippably. It is NOT what contract-arg parsing uses.
So a nested BytesN inside a struct arg is a BARE HEX STRING, not `{"bytes":...}`.
  Source: XDR-JSON spec (developers.stellar.org/docs/learn/fundamentals/
  data-format/xdr-json) lists its tools as the xdr/tx/lab commands — contract
  invoke is absent.

### F4 — G1Affine / G2Affine resolve to BytesN in the spec.
In soroban-sdk, `crypto::bls12_381::{G1Affine,G2Affine}` are thin wrappers whose
Val representation is the underlying fixed byte array (96 / 192 bytes). In the
generated contract spec a field of that type appears as `BytesN<96>` /
`BytesN<192>`, so each accepts a bare hex string of exactly that many bytes.
This is corroborated by the on-chain layout already proven byte-equal to Rust
ground truth in the apps suite ("BLS12-381 encoder matches the real Rust on-chain
bytes"), which is the exact byte string the encoder emits.

---------------------------------------------------------------------------
## Conclusion -> the encoder output is already in the right shape
---------------------------------------------------------------------------

`setup/encode-testnet-args.mjs` writes, into build/testnet/:
   vk_v1.json   { alpha:"<96B hex>", beta:"<192B hex>", gamma, delta,
                  ic:["<96B hex>", ... 5 pts] }   (v1: nPublic=4 -> 5 IC pts)
   vk_v3.json   { alpha, beta, gamma, delta, ic:[... 9 pts] }  (v3: nPublic=8)
   proof_solvent.json    { a:"<96B hex>", b:"<192B hex>", c:"<96B hex>" }
   signals_solvent.json  ["1","2818...","3892...","1","1","1","1","1"]  (8 sigs)

Each top-level arg is consumed via its `--<name>-file-path` variant (F1), which
sidesteps shell-length limits on the ~3KB VK hex. The JSON objects match the
struct-as-object / Vec-as-array / BytesN-as-hex rules (F2, F4). Field-name keys
match the Rust field idents (alpha/beta/gamma/delta/ic; a/b/c) exactly.

---------------------------------------------------------------------------
## Residual uncertainty + fallback (honest scope)
---------------------------------------------------------------------------

RESIDUAL (~10%): the spec was NOT empirically dumped from the WASM this session
(the `stellar contract bindings json` inspection was user-denied). The only way
the CLI form would differ is if `G1Affine` were emitted as a single-field UDT
wrapper rather than `BytesN<96>` — in which case a nested point would need
`{"0":"<hex>"}` instead of `"<hex>"`. Research strongly favors BytesN (F4).

FALLBACK if the CLI rejects the JSON (clean, no new crypto):
The TypeScript path bypasses CLI JSON parsing entirely. `stellarisContractCodec`
(packages/soroban-transport) builds the ScVals directly with the SAME byte-exact
serializers, and `SorobanRpcInvoker` submits via RPC. So:
   - Primary: CLI deploy with the file-path JSON args (this script).
   - Fallback: a tiny TS deploy driver reusing the codec + invoker, if and only
     if the CLI spec form surprises us.
Both use identical, ground-truth-verified bytes; only the submission seam differs.

VERIFY-FIRST STEP (in the deploy script, before any spend): run
`stellar contract bindings json --wasm <attestation.wasm>` and grep the `init`
input type for `BytesN` vs a UDT name. This empirically closes the residual at
deploy time, costs nothing, and is the documented spec-dump command (F1 source).
