/**
 * prove-check.mjs — End-to-end REAL proving self-test for @stellaris-lab/por-sdk.
 *
 * Exercises the actual SDK proving path against the real circuit artifacts
 * produced by setup/ceremony.sh + setup/export-fixtures.sh:
 *
 *   buildSnapshot-equivalent input
 *     -> generateProofFromSnapshot (snarkjs.groth16.fullProve, real wasm/zkey)
 *     -> verifyLocal (real verification_key.json)
 *     -> parsePublicSignals semantics
 *
 * No mocks. Run from stellaris-core/client:
 *   node scripts/prove-check.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateProofFromSnapshot,
  verifyLocal,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const CORE = resolve(here, "../..");
const BUILD = join(CORE, "build");
const FIX = join(CORE, "fixtures");

const vk = JSON.parse(readFileSync(join(FIX, "verification_key.json"), "utf8"));

const artifacts = {
  wasmUrl: join(BUILD, "por_js", "por.wasm"),
  zkeyUrl: join(BUILD, "por_final.zkey"),
  verificationKey: vk,
};

// Solvent snapshot mirroring circuits/inputs/solvent.json: 16 x 200k = 3.2M
// reserves vs 2.8M liabilities, salt fixed for reproducibility.
const snapshot = {
  periodId: 1n,
  salt: 12345678901234567890n,
  liabilities: { total: 2_800_000n },
  accounts: Array.from({ length: 16 }, (_, i) => ({
    label: `acct-${i}`,
    balance: 200_000n,
  })),
};

console.log("[1/3] generating real Groth16 proof via snarkjs...");
const bundle = await generateProofFromSnapshot(snapshot, artifacts);
console.log(
  `      solvent=${bundle.parsed.solvent} liabilities=${bundle.parsed.liabilities} period=${bundle.parsed.periodId}`,
);
console.log(`      commitment=${String(bundle.parsed.commitment).slice(0, 28)}...`);

console.log("[2/3] verifying proof locally against real VK...");
const ok = await verifyLocal(vk, bundle);
if (!ok) {
  console.error("[FAIL] local verification failed for a freshly generated proof");
  process.exit(1);
}
console.log("      verifyLocal -> true");

console.log("[3/3] asserting public-signal semantics...");
const errors = [];
if (!bundle.parsed.solvent) errors.push("expected solvent=true");
if (bundle.parsed.liabilities !== 2_800_000n) errors.push("liabilities mismatch");
if (bundle.parsed.periodId !== 1n) errors.push("period mismatch");
if (bundle.publicSignals.length !== 4) errors.push("expected 4 public signals");
if (errors.length > 0) {
  console.error("[FAIL]", errors.join("; "));
  process.exit(1);
}

console.log("\n[PASS] SDK real proving path verified end-to-end (no mocks).\n");
process.exit(0);
