#!/usr/bin/env node
// B-P1 correctness gate (offline-correct): build inclusion witnesses whose root +
// sibling path come from the AGGREGATION CIRCUIT'S OWN witness, so the Poseidon
// is BLS12-381 by construction. This sidesteps circomlibjs (BN254-only), which
// cannot reproduce the in-circuit hash — the Poseidon-param drift trap (plan 5.1).
//
// Inputs (argv): <aggWitnessJson> <aggSymFile> <targetLeaf> <outDir>
// Emits: inclusion_valid.json, inclusion_wrong_balance.json,
//        inclusion_wrong_sibling.json  (the latter two MUST fail to prove).

import { readFileSync, writeFileSync } from "node:fs";

const [, , witPath, symPath, targetArg, outDir, depthArg] = process.argv;
const TARGET = Number(targetArg);
// Depth defaults to 8 (preserves the original depth-8 soundness gate) but can be
// overridden (e.g. 4) to extract from the repo-scale agg witness.
const DEPTH = Number(depthArg || 8);
const N = 1 << DEPTH;

// --- leaf inputs MUST match agg_spike input.json exactly --------------------
// userId_i = i+1, balance = (i%7)*100, salt = i+1000
function leafBalance(i) {
  return BigInt((i % 7) * 100);
}
function leafUserId(i) {
  return BigInt(i + 1);
}
function leafSalt(i) {
  return BigInt(i + 1000);
}

// --- read witness + sym -----------------------------------------------------
const witness = JSON.parse(readFileSync(witPath, "utf8")).map((x) => BigInt(x));
const sym = readFileSync(symPath, "utf8");

// name -> witness index
const nameToWit = new Map();
for (const line of sym.split("\n")) {
  if (!line) continue;
  const [, witIdx, , name] = line.split(",");
  if (name !== undefined) nameToWit.set(name, Number(witIdx));
}
function sig(name) {
  const wi = nameToWit.get(name);
  if (wi === undefined || wi < 0) {
    throw new Error(`signal not found or eliminated: ${name}`);
  }
  return witness[wi];
}

// Flat buffer level bases for N=256 (see merkle_sum_root layout).
// level k holds (N >> k) entries; base[k+1] = base[k] + (N>>k).
const base = [];
let b = 0;
let cnt = N;
for (let k = 0; k <= DEPTH; k++) {
  base.push(b);
  b += cnt;
  cnt >>= 1;
}

// circom eliminates duplicate signals: level-0 curHash[0..N-1] (== leafHash[i])
// and the root curHash[base[DEPTH]] (== main.rootHash) are optimized away.
// Level-0 hashes come from the exposed leafHashOut[] outputs (survive); the
// root comes from main.rootHash/total; levels 1..DEPTH-1 from curHash/curSum.
function levelHash(level, idx) {
  if (level === 0) return sig(`main.leafHashOut[${idx}]`);
  if (level === DEPTH) return sig(`main.rootHash`);
  return sig(`main.root.curHash[${base[level] + idx}]`);
}
function levelSum(level, idx) {
  if (level === 0) return leafBalance(idx); // level-0 sum is the balance
  if (level === DEPTH) return sig(`main.total`);
  return sig(`main.root.curSum[${base[level] + idx}]`);
}

const rootHash = levelHash(DEPTH, 0);
const total = levelSum(DEPTH, 0);

// --- extract sibling path for TARGET ---------------------------------------
const sibHash = [];
const sibSum = [];
const pathDir = [];
let pos = TARGET;
for (let k = 0; k < DEPTH; k++) {
  const sibPos = pos ^ 1;
  sibHash.push(levelHash(k, sibPos));
  sibSum.push(levelSum(k, sibPos));
  pathDir.push(pos & 1); // 0 = current is left, 1 = current is right
  pos >>= 1;
}

const tBalance = leafBalance(TARGET);
const tUserId = leafUserId(TARGET);
const tSalt = leafSalt(TARGET);

function witnessJson(claimedBalance, sibHashOverride) {
  return {
    userId: tUserId.toString(),
    claimedBalance: claimedBalance.toString(),
    rootHash: rootHash.toString(),
    total: total.toString(),
    salt: tSalt.toString(),
    sibHash: sibHash.map((h, i) =>
      sibHashOverride && i === sibHashOverride.level
        ? sibHashOverride.value
        : h.toString(),
    ),
    sibSum: sibSum.map((s) => s.toString()),
    pathDir: pathDir.map((d) => d.toString()),
  };
}

writeFileSync(`${outDir}/inclusion_valid.json`, JSON.stringify(witnessJson(tBalance), null, 1));
writeFileSync(
  `${outDir}/inclusion_wrong_balance.json`,
  JSON.stringify(witnessJson(tBalance + 1n), null, 1),
);
writeFileSync(
  `${outDir}/inclusion_wrong_sibling.json`,
  JSON.stringify(witnessJson(tBalance, { level: 0, value: "12345" }), null, 1),
);

console.log(`[OK] extracted root + path from agg witness (BLS12-381, in-circuit Poseidon)`);
console.log(`     root.total = ${total.toString()}`);
console.log(`     root.hash  = ${rootHash.toString().slice(0, 24)}...`);
console.log(`     target leaf #${TARGET} balance=${tBalance} userId=${tUserId}`);
console.log(`     wrote 3 inclusion witness files to ${outDir}/`);
