#!/usr/bin/env node
// B-P2: build a por_v2 witness input. Reserves cover the SNARK-bound liability
// total (solvent case). Leaf formula MUST match agg-input.mjs / inclusion-witness.mjs.
//
// por_v2 signals (see por_v2.circom):
//   private: reserves[16], reserveSalt, period,
//            userId[256], balance[256], salt[256]
//   public outputs: [solvent, reserveCommitment, liabRoot, liabTotal, period]
import { writeFileSync } from "node:fs";

const N_RES = 16;
// Repo-scale default depth=4 (16 leaves) so the ceremony fits in RAM; the
// contract path is identical at any depth (5-signal ABI). Override via argv[3].
const DEPTH = Number(process.argv[3] || 4);
const N = 1 << DEPTH;

// --- liability leaves: same formula as agg-input.mjs ---
const userId = [];
const balance = [];
const salt = [];
let liabTotal = 0n;
for (let i = 0; i < N; i++) {
  const bal = BigInt((i % 7) * 100); // total = sum over 256 leaves
  userId.push(BigInt(i + 1).toString());
  balance.push(bal.toString());
  salt.push(BigInt(i + 1000).toString());
  liabTotal += bal;
}

// --- reserves: 16 buckets summing to >= liabTotal (solvent) ---
// liabTotal for this leaf set = 76200. Put comfortably more in reserves.
const reserves = [];
let resSum = 0n;
for (let i = 0; i < N_RES; i++) {
  const v = 10000n; // 16 * 10000 = 160000 >= 76200
  reserves.push(v.toString());
  resSum += v;
}

// Signal names MUST match por_v2.circom exactly:
//   reserve[16], reserveSalt, userId[256], balance[256], liabSalt[256], period_in
const input = {
  reserve: reserves,
  reserveSalt: "999999",
  userId,
  balance,
  liabSalt: salt,
  period_in: "1",
};

const outDir = process.argv[2] || "build/spike";
writeFileSync(`${outDir}/por_v2_input.json`, JSON.stringify(input, null, 1));
console.log(`[OK] wrote por_v2 input to ${outDir}/por_v2_input.json`);
console.log(`     liabTotal (sum of 256 leaves) = ${liabTotal}`);
console.log(`     reserveSum (16 buckets)       = ${resSum}`);
console.log(`     expect solvent=1 (reserves ${resSum} >= liabilities ${liabTotal})`);
