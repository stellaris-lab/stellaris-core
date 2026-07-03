# @stellaris-lab/por-sdk

TypeScript/JavaScript SDK for Stellaris proof-of-reserves and solvency-gated minting flows on Stellar Soroban.

The SDK provides deterministic protocol utilities, local proof verification helpers, public-signal parsing/encoding, and Soroban client abstractions for issuer, verifier, and operator applications.

## Links

- Repository: https://github.com/stellaris-lab/stellaris-core
- SDK source: https://github.com/stellaris-lab/stellaris-core/tree/main/client
- Integration examples: https://github.com/stellaris-lab/stellaris-apps
- Documentation: https://github.com/stellaris-lab/stellaris
- Issues: https://github.com/stellaris-lab/stellaris-core/issues

## Install

```bash
npm install @stellaris-lab/por-sdk
```

## Requirements

- Node.js 20+
- ESM-compatible runtime
- Circuit artifacts when generating proofs locally

## Public Signal Parsing

```ts
import { parsePublicSignalsV3, encodePublicSignalsV3 } from "@stellaris-lab/por-sdk";

const signals = [
  "1",
  "28184704509896798694171806401809735674629341338708097298840167762771603184872",
  "38920107329329417419205137842949329405942847694151540866319542913651737474578",
  "0",
  "1",
  "1",
  "1",
  "9",
];

const parsed = parsePublicSignalsV3(signals);
const encoded = encodePublicSignalsV3(parsed);
```

## Local Proof Verification

```ts
import { verifyLocal } from "@stellaris-lab/por-sdk";

const ok = await verifyLocal(verificationKey, proofBundle);
```

## Protocol Compatibility

This package is tested against the language-neutral vectors in:

```txt
../protocol-spec/test-vectors/public-signals.json
```

The same vectors are also used by the Rust SDK, which keeps JS, TS, and Rust implementations aligned on public-signal order and validation rules.

## Publish Checklist

Before publishing a release:

```bash
npm run check
npm pack --dry-run
npm publish --access public
```

The package intentionally publishes only:

```txt
dist/
README.md
package.json
```

## Status

Version `0.1.0` is a developer-preview SDK for audited testnet/demo flows. Production users should pin exact versions and verify deployed contract IDs, WASM hashes, circuit artifacts, and verification keys.
