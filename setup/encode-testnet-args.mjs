/**
 * encode-testnet-args.mjs — OFFLINE encoder for the testnet e2e CLI args.
 *
 * The `stellar contract invoke` CLI converts JSON args to ScVals: a Soroban
 * struct is a JSON object, a `Vec` is a JSON array, and a `BytesN<N>` is a hex
 * string. The only non-trivial part is encoding the BLS12-381 G1/G2 points of
 * the verification key + proof into the EXACT on-chain byte layout.
 *
 * Rather than reimplement that, this script imports the byte-exact serializers
 * straight from the core SDK's built `encoding.js` (`@stellaris/por-sdk`). That
 * module is the SINGLE source of truth for the on-chain byte layout (G1 96B,
 * G2 192B with the c1||c0 Fp2 swap, U256 32B) and is byte-for-byte verified
 * against the Rust on-chain ground truth in the apps test-suite ("BLS12-381
 * encoder matches the real Rust on-chain bytes"). The bytes this emits are thus
 * correct by construction — no network, no new crypto code.
 *
 * encoding.js imports only relative paths (./errors.js), so it resolves without
 * any node_modules — safe to import by file path from here.
 *
 * Output (build/testnet/): vk_v3.json, proof_solvent.json, signals_solvent.json
 * — each a ready-to-pass `stellar contract invoke ... --<arg> <file-contents>`
 * value. This script makes NO network calls.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..");
const FIX = join(CORE, "fixtures", "v3");
const OUT = join(CORE, "build", "testnet");

// Import the byte-exact serializers directly from the core SDK's built dist.
const ENC = join(CORE, "client", "dist", "encoding.js");
const { g1ToBytes, g2ToBytes } = await import(ENC);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Uint8Array -> lowercase hex string (the CLI's BytesN input form). */
function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

/** Assert a byte buffer is exactly `n` bytes — guards against silent drift. */
function expectLen(bytes, n, label) {
  if (bytes.length !== n) {
    throw new Error(`${label}: expected ${n} bytes, got ${bytes.length}`);
  }
  return bytes;
}

// snarkjs G1 = [x, y, "1"]; SDK signature is g1ToBytes(x, y).
function g1(point, label) {
  return expectLen(g1ToBytes(point[0], point[1]), 96, label);
}

// snarkjs G2 = [[x_c0, x_c1], [y_c0, y_c1], ["1","0"]]; SDK signature is
// g2ToBytes(xC0, xC1, yC0, yC1) and does the c1||c0 swap internally.
function g2(point, label) {
  return expectLen(
    g2ToBytes(point[0][0], point[0][1], point[1][0], point[1][1]),
    192,
    label,
  );
}

function main() {
  mkdirSync(OUT, { recursive: true });

  // Encode any snarkjs VK object into the Groth16VerificationKey arg shape.
  function encodeVk(vkObj, label) {
    return {
      alpha: hex(g1(vkObj.vk_alpha_1, `${label}.alpha`)),
      beta: hex(g2(vkObj.vk_beta_2, `${label}.beta`)),
      gamma: hex(g2(vkObj.vk_gamma_2, `${label}.gamma`)),
      delta: hex(g2(vkObj.vk_delta_2, `${label}.delta`)),
      ic: vkObj.IC.map((p, i) => hex(g1(p, `${label}.ic[${i}]`))),
    };
  }

  // --- v1 verification key (for the `init(admin, vk)` call) --------------
  // The contract requires `init` (which sets admin + stores the v1 VK) BEFORE
  // `init_v3`. The deployed token only uses the v3 path, but init must run, so
  // the real v1 VK fixture is encoded here for that bootstrap call.
  const vk1 = readJson(join(CORE, "fixtures", "verification_key.json"));
  const vk1Args = encodeVk(vk1, "vk1");
  writeFileSync(join(OUT, "vk_v1.json"), JSON.stringify(vk1Args));

  // --- v3 verification key (Groth16VerificationKey) ----------------------
  const vk = readJson(join(FIX, "verification_key_v3.json"));
  const vkArgs = encodeVk(vk, "vk");
  writeFileSync(join(OUT, "vk_v3.json"), JSON.stringify(vkArgs));

  // --- solvent proof (Groth16Proof) --------------------------------------
  const proof = readJson(join(FIX, "solvent", "proof.json"));
  const proofArgs = {
    a: hex(g1(proof.pi_a, "proof.a")),
    b: hex(g2(proof.pi_b, "proof.b")),
    c: hex(g1(proof.pi_c, "proof.c")),
  };
  writeFileSync(join(OUT, "proof_solvent.json"), JSON.stringify(proofArgs));

  // --- public signals (Vec<U256>, decimal strings) ----------------------
  const signals = readJson(join(FIX, "solvent", "public.json"));
  if (!Array.isArray(signals) || signals.length !== 8) {
    throw new Error(`expected 8 public signals, got ${signals.length}`);
  }
  writeFileSync(join(OUT, "signals_solvent.json"), JSON.stringify(signals));

  // --- report ------------------------------------------------------------
  console.log("[OK] wrote testnet CLI args to build/testnet/");
  console.log(
    `     vk_v3.json           alpha=${vkArgs.alpha.length / 2}B beta=${vkArgs.beta.length / 2}B ic=${vkArgs.ic.length} pts`,
  );
  console.log(
    `     proof_solvent.json   a=${proofArgs.a.length / 2}B b=${proofArgs.b.length / 2}B c=${proofArgs.c.length / 2}B`,
  );
  console.log(
    `     signals_solvent.json ${signals.length} signals; aggregateSolvent=${signals[0]} period=${signals[7]}`,
  );
}

main();
