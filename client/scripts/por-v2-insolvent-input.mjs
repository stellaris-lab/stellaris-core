#!/usr/bin/env node
// B-P4: build an INSOLVENT por_v2 witness input — reserves < SNARK-bound
// liability total. The proof is still VALID (the circuit proves solvent=0), and
// the contract's attest_v2 must REJECT it with NotSolvent. This is the
// failing-case test that the solvency comparison actually binds.
//
// Signal names match por_v2.circom: reserve[16], reserveSalt, userId[256],
// balance[256], liabSalt[256], period_in. Leaf formula matches por-v2-input.mjs.
import { writeFileSync } from "node:fs";

const N_RES = 16;
// Repo-scale default depth=4 (16 leaves); override via argv[3]. Contract path
// is identical at any depth (5-signal ABI).
const DEPTH = Number(process.argv[3] || 4);
const N = 1 << DEPTH;

const userId = [];
const balance = [];
const liabSalt = [];
let liabTotal = 0n;
for (let i = 0; i < N; i++) {
  const bal = BigInt((i % 7) * 100);
  userId.push(BigInt(i + 1).toString());
  balance.push(bal.toString());
  liabSalt.push(BigInt(i + 1000).toString());
  liabTotal += bal;
}

// reserves intentionally LESS than liabTotal (insolvent): 16 buckets of 100 = 1600 << 76200.
const reserve = [];
let resSum = 0n;
for (let i = 0; i < N_RES; i++) {
  reserve.push("100");
  resSum += 100n;
}

const input = {
  reserve,
  reserveSalt: "999999",
  userId,
  balance,
  liabSalt,
  period_in: "2", // different period from the solvent fixture
};

const outDir = process.argv[2] || "build/spike";
writeFileSync(`${outDir}/por_v2_insolvent_input.json`, JSON.stringify(input, null, 1));
console.log(`[OK] wrote insolvent por_v2 input to ${outDir}/por_v2_insolvent_input.json`);
console.log(`     liabTotal = ${liabTotal}, reserveSum = ${resSum} (insolvent: reserves < liabilities)`);
console.log(`     expect solvent=0`);
