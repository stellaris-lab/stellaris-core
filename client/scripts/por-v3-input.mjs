#!/usr/bin/env node
// C1: build a por_v3 multi-asset witness input.
//
// 4 assets x 4 reserve cells. Per-asset reserves cover per-asset liabilities
// (all assetSolvent=1) AND the price-weighted aggregate is solvent.
//
// Signal layout (por_v3.circom):
//   private: reserve[4][4], reserveSalt, price[4], priceSalt, liabilities[4], period_in
//   public:  [aggregateSolvent, reserveCommitment, priceCommitment,
//             assetSolvent[0..3], period]
//
// Usage: node por-v3-input.mjs <outDir> [mode]
//   mode = solvent (default) | priced_insolvent | one_asset_underwater

import { writeFileSync } from "node:fs";

const N_ASSETS = 4;
const N_PER_ASSET = 4;
const outDir = process.argv[2] || "build/spike";
const mode = process.argv[3] || "solvent";

// Per-asset reserve cells and liabilities. Base case: every asset solvent and
// the priced aggregate solvent.
// reserve[a][i] = (a+1)*1000 + i*10 ; liab[a] = sum(reserve[a]) - 500 (solvent)
const reserve = [];
const liabilities = [];
const assetReserveSum = [];
for (let a = 0; a < N_ASSETS; a++) {
  const row = [];
  let sum = 0n;
  for (let i = 0; i < N_PER_ASSET; i++) {
    const v = BigInt((a + 1) * 1000 + i * 10);
    row.push(v);
    sum += v;
  }
  reserve.push(row);
  assetReserveSum.push(sum);
  liabilities.push(sum - 500n); // each asset comfortably solvent
}

// Oracle prices (32-bit fixed-point, common unit). Distinct per asset.
const price = [2n, 5n, 3n, 7n];

// --- mode adjustments -------------------------------------------------------
if (mode === "one_asset_underwater") {
  // Make asset 0 individually insolvent (liab > reserves) but keep the priced
  // aggregate solvent (other assets over-cover). assetSolvent[0] must be 0,
  // aggregateSolvent must be 1.
  liabilities[0] = assetReserveSum[0] + 100000n; // asset 0 underwater
  // boost asset 1 reserves so aggregate still solvent
  reserve[1][0] += 500000n;
  assetReserveSum[1] += 500000n;
} else if (mode === "priced_insolvent") {
  // Every asset individually solvent, but the PRICED aggregate is insolvent:
  // inflate one asset's liability just under its own reserve (still solvent per
  // asset) is not enough; instead raise ALL liabilities so priced sum flips.
  for (let a = 0; a < N_ASSETS; a++) {
    liabilities[a] = assetReserveSum[a]; // per-asset boundary (still solvent, >=)
  }
  // Now drop one asset's reserves below liab via price-weighted gap: make asset
  // 3 (highest price=7) liability exceed its reserves so priced aggregate flips
  // but keep per-asset... no: to get aggregateSolvent=0 we need priced liab >
  // priced reserve. Raise asset 3 liab above its reserve (asset 3 insolvent too).
  liabilities[3] = assetReserveSum[3] + 1000n;
}

const reserveFlat = reserve.map((row) => row.map((v) => v.toString()));
const input = {
  reserve: reserveFlat,
  reserveSalt: "123456789",
  price: price.map((p) => p.toString()),
  priceSalt: "987654321",
  liabilities: liabilities.map((l) => l.toString()),
  period_in: "1",
};

writeFileSync(`${outDir}/por_v3_input.json`, JSON.stringify(input, null, 1));

// Compute expected aggregate for the log.
let pr = 0n;
let pl = 0n;
for (let a = 0; a < N_ASSETS; a++) {
  pr += price[a] * assetReserveSum[a];
  pl += price[a] * liabilities[a];
}
console.log(`[OK] wrote por_v3 input (mode=${mode}) to ${outDir}/por_v3_input.json`);
console.log(`     per-asset reserveSum = ${assetReserveSum.map(String).join(", ")}`);
console.log(`     per-asset liab       = ${liabilities.map(String).join(", ")}`);
console.log(`     priced reserve = ${pr}, priced liab = ${pl}`);
console.log(`     expect aggregateSolvent = ${pr >= pl ? 1 : 0}`);
for (let a = 0; a < N_ASSETS; a++) {
  console.log(`     expect assetSolvent[${a}] = ${assetReserveSum[a] >= liabilities[a] ? 1 : 0}`);
}
