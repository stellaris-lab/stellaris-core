#!/usr/bin/env node
// Emit agg_spike input.json: 256 leaves, userId=i+1, balance=(i%7)*100, salt=i+1000.
// MUST match the leaf formulas in inclusion-witness.mjs.
import { writeFileSync } from "node:fs";
const N = Number(process.argv[3] || 256);
const userId = [];
const balance = [];
const salt = [];
for (let i = 0; i < N; i++) {
  userId.push((i + 1).toString());
  balance.push(((i % 7) * 100).toString());
  salt.push((i + 1000).toString());
}
const out = process.argv[2] || "build/spike/agg_input.json";
writeFileSync(out, JSON.stringify({ userId, balance, salt }, null, 1));
console.log(`[OK] wrote ${N}-leaf agg input to ${out}`);
// N is parameterized (argv[3]) so the same builder feeds the depth-8 soundness
// gate (256 leaves) and the repo-scale depth-4 inclusion proof (16 leaves).
