#!/usr/bin/env node
// B-P1 correctness gate: build a real depth=8 Merkle-sum tree, extract a real
// inclusion witness, and confirm the inclusion circuit (1) accepts a valid path,
// (2) rejects a tampered sibling. Uses circomlibjs Poseidon — MUST match the
// in-circuit Poseidon (BLS12-381) or roots won't agree (the consistency trap).
//
// Output: writes witness JSON files to build/spike/ and prints PASS/FAIL.
// snarkjs witness calculation is the actual gate (run by inclusion-check.sh).

import { readFileSync, writeFileSync } from "node:fs";
import { buildPoseidon } from "circomlibjs";

const DEPTH = 8;
const N = 1 << DEPTH; // 256 leaves
const LB = 64n;

const poseidon = await buildPoseidon();
const F = poseidon.F;

// Field-friendly Poseidon returning a decimal string.
function H(inputs) {
  return F.toString(poseidon(inputs));
}

// Leaf = Poseidon(userId, balance, salt); sum = balance.
function leafNode(userId, balance, salt) {
  return { hash: H([userId, balance, salt]), sum: balance };
}
// Node = Poseidon(hashL, sumL, hashR, sumR); sum = sumL + sumR.
function parent(l, r) {
  return { hash: H([l.hash, l.sum, r.hash, r.sum]), sum: l.sum + r.sum };
}

// Build a full tree from 256 leaves (pad with zero leaves).
function buildTree(leaves) {
  let level = leaves.slice();
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(parent(level[i], level[i + 1]));
    }
    levels.push(next);
    level = next;
  }
  return { root: level[0], levels };
}

// Inclusion witness for leafIndex: siblings + direction bits, bottom-up.
function inclusionWitness(tree, leafIndex) {
  const siblings = [];
  const pathDir = []; // 0 if our node is left child, 1 if right
  let idx = leafIndex;
  for (let lvl = 0; lvl < DEPTH; lvl++) {
    const isRight = idx & 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    siblings.push(tree.levels[lvl][sibIdx]);
    pathDir.push(isRight); // if we are right child, dir=1 (sibling on left)
    idx >>= 1;
  }
  return { siblings, pathDir };
}

// --- build a real tree -----------------------------------------------------
const leaves = [];
for (let i = 0; i < N; i++) {
  // userId_i = i+1, balance varied, salt = i+1000
  const userId = BigInt(i + 1);
  const balance = BigInt((i % 7) * 100); // some zero, some nonzero, all < 2^64
  const salt = BigInt(i + 1000);
  leaves.push({ userId, balance, salt, node: leafNode(userId, balance, salt) });
}
const tree = buildTree(leaves.map((l) => l.node));
const total = tree.root.sum;

// pick a leaf to prove
const TARGET = 5;
const t = leaves[TARGET];
const w = inclusionWitness(tree, TARGET);

// circuit signal layout (see inclusion.circom):
// public: userId, claimedBalance, rootHash, total
// private: salt, sibHash[DEPTH], sibSum[DEPTH], pathDir[DEPTH]
function witnessJson(claimedBalance, sibHashOverride) {
  const sibHash = w.siblings.map((s, i) =>
    sibHashOverride && i === sibHashOverride.level
      ? sibHashOverride.value
      : s.hash,
  );
  return {
    userId: t.userId.toString(),
    claimedBalance: claimedBalance.toString(),
    rootHash: tree.root.hash,
    total: total.toString(),
    salt: t.salt.toString(),
    sibHash,
    sibSum: w.siblings.map((s) => s.sum.toString()),
    pathDir: w.pathDir.map((d) => d.toString()),
  };
}

// valid witness
writeFileSync(
  "build/spike/inclusion_valid.json",
  JSON.stringify(witnessJson(t.balance), null, 1),
);
// tampered: claim a wrong balance (should fail — hash won't match)
writeFileSync(
  "build/spike/inclusion_wrong_balance.json",
  JSON.stringify(witnessJson(t.balance + 1n), null, 1),
);
// tampered: corrupt a sibling hash (should fail — root won't match)
writeFileSync(
  "build/spike/inclusion_wrong_sibling.json",
  JSON.stringify(
    witnessJson(t.balance, { level: 0, value: "12345" }),
    null,
    1,
  ),
);

console.log("[OK] tree built, depth=" + DEPTH + " leaves=" + N);
console.log("     root.sum (total) = " + total.toString());
console.log("     root.hash = " + tree.root.hash.slice(0, 24) + "...");
console.log("     target leaf #" + TARGET + " balance=" + t.balance);
console.log("     wrote 3 witness files to build/spike/");
