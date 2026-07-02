/**
 * Byte-equality self-test for the SDK's BLS12-381 encoder (encoding.ts).
 *
 * Asserts that the SDK's pure serializer produces EXACTLY the bytes the on-chain
 * Soroban verifier consumes. The ground-truth hex values were dumped from the
 * working Rust pairing path (contracts/stellaris: ark-bls12-381
 * serialize_uncompressed feeding the G1Affine/G2Affine the verifier accepts).
 *
 * Run:  node client/scripts/encoding-check.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  g1ToBytes,
  g2ToBytes,
  proofToBytes,
  signalToBytes,
  bytesToHex,
  G1_SIZE,
  G2_SIZE,
  U256_SIZE,
} from "../dist/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "..");

// Ground truth captured from the Rust on-chain pairing path (verifier accepts these).
const G1_ALPHA_HEX =
  "0194b557cff2e1d76be5f71d79fe5357516e2f39b15098b97543080da572dd82d22a3638141291a932cc378fa0b11a72112b448493315903365759b93a0810e75f97f6d5220586d66e659a0d68ea7bccc1e35f0b135967aba48006c21ce8cc99";
const G2_BETA_HEX =
  "09e0c53c54b86d1eeee252ad1d07cd5ad6f362e42cc1abcca577edb5f698358ede1cb49bd319c3f5174a7826227e81bb0a3fe2ac743cbdaa4ac4473f8999e143f095d33da978d8e4e3528cba58c34f55d7c818dd4c01ee58b7fb821583ff67c810950d3c84d825186a6aa224e5c07b0a2407f468bb8c08b0c93e568f6661304588b63f8f9edfee2eeb63b3f5796ad19014dd46ab99de70dc7ae361896b2fdda520f0a02510ccf6e25d73fce890c0e9477cfec560598f217ff0ebf303865ea209";

const vk = JSON.parse(
  readFileSync(join(CORE, "fixtures", "verification_key.json"), "utf8"),
);
const proof = JSON.parse(
  readFileSync(join(CORE, "fixtures", "solvent", "proof.json"), "utf8"),
);
const pub = JSON.parse(
  readFileSync(join(CORE, "fixtures", "solvent", "public.json"), "utf8"),
);

let failures = 0;
function check(name, actual, expected) {
  if (actual === expected) {
    console.log(`  [OK] ${name}`);
  } else {
    failures++;
    console.log(`  [FAIL] ${name}`);
    console.log(`     actual:   ${actual}`);
    console.log(`     expected: ${expected}`);
  }
}

console.log("[1] G1 alpha matches Rust ground truth");
const alpha = g1ToBytes(vk.vk_alpha_1[0], vk.vk_alpha_1[1]);
check("vk.alpha G1 96B", bytesToHex(alpha), G1_ALPHA_HEX);

console.log("[2] G2 beta matches Rust ground truth (c1||c0 swap)");
const beta = g2ToBytes(
  vk.vk_beta_2[0][0],
  vk.vk_beta_2[0][1],
  vk.vk_beta_2[1][0],
  vk.vk_beta_2[1][1],
);
check("vk.beta G2 192B", bytesToHex(beta), G2_BETA_HEX);

console.log("[3] proofToBytes produces correct widths");
const pb = proofToBytes(proof);
check("proof.a width", String(pb.a.length), String(G1_SIZE));
check("proof.b width", String(pb.b.length), String(G2_SIZE));
check("proof.c width", String(pb.c.length), String(G1_SIZE));

console.log("[4] public signals -> 32B big-endian U256");
for (const s of pub) {
  const b = signalToBytes(s);
  if (b.length !== U256_SIZE) {
    failures++;
    console.log(`  [FAIL] signal ${s} width ${b.length}`);
  }
  // round-trip: bytes back to bigint must equal original
  let v = 0n;
  for (const byte of b) v = (v << 8n) | BigInt(byte);
  check(`signal round-trip ${s.slice(0, 12)}...`, v.toString(), s);
}

console.log("");
if (failures === 0) {
  console.log("[PASS] SDK encoder is byte-identical to the on-chain verifier path.");
  process.exit(0);
} else {
  console.log(`[FAIL] ${failures} mismatch(es).`);
  process.exit(1);
}
