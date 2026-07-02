# Stellaris Protocol Spec

This directory is the language-neutral contract for every Stellaris SDK.

SDKs in TypeScript, JavaScript, Rust, Python, or Go must not invent their own
public-signal order, error names, or encoding rules. They should consume these
schemas and pass the shared vectors under `test-vectors/`.

## Current canonical surfaces

- `public-signals.json` records the v1, v2, and v3 public-signal layouts.
- `test-vectors/public-signals.json` records parse/encode fixtures every SDK must pass.

## Language SDK rule

Every SDK must support the same minimum gates before release:

1. Parse canonical v1/v2/v3 public-signal vectors.
2. Encode parsed vectors back to the exact same decimal-string arrays.
3. Reject wrong signal counts.
4. Reject non-decimal field elements.
5. Reject non-boolean solvency flags.

This keeps Rust, JS, TS, and future SDKs aligned with the Soroban contract.
