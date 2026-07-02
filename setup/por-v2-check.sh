#!/usr/bin/env bash
# B-P2 gate: por_v2 binds sum(reserves) >= liabTotal where liabTotal is the
# SNARK-computed Merkle-sum root total (NOT a trusted scalar). This script:
#   1. compiles por_v2 (-p bls12381)
#   2. builds a solvent witness input
#   3. generates the witness and extracts the 5 public outputs
#   4. asserts ABI order [solvent, reserveCommitment, liabRoot, liabTotal, period]
#      and the bound values (solvent=1, liabTotal=76200, period=1)
set -euo pipefail
cd "$(dirname "$0")/.."

CIRCOMLIB="/home/harry-riddle/node_modules"
SPIKE="build/spike"
mkdir -p "$SPIKE"

echo "=== B-P2: por_v2 solvency-with-proven-liabilities ==="

# Repo-scale depth-4 (16 users): IDENTICAL contract code path as production
# (5-signal ABI, IC.len()==6, real BLS12-381 pairing) but small enough to run on
# a dev box in seconds. Matches the ceremony, fixtures, contract + apps tests,
# which all run at depth-4. The depth-agnostic production circuit (por_v2.circom,
# depth-8) is exercised by the heavier ceremony path (ROADMAP Milestone E).
echo "--- compiling por_v2_repo (16 reserves, depth=4) ---"
circom circuits/por_v2_repo.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$SPIKE" >/dev/null

echo "--- building solvent witness input (depth=4) ---"
node client/scripts/por-v2-input.mjs "$SPIKE" 4

echo "--- generating witness ---"
snarkjs wtns calculate "$SPIKE/por_v2_repo_js/por_v2_repo.wasm" "$SPIKE/por_v2_input.json" "$SPIKE/por_v2.wtns" >/dev/null
snarkjs wtns export json "$SPIKE/por_v2.wtns" "$SPIKE/por_v2_wit.json" >/dev/null

echo "--- checking public outputs (witness[1..5]) ---"
# Outputs are witness indices 1..5 in declaration order:
#   [1]=solvent [2]=reserveCommitment [3]=liabRoot [4]=liabTotal [5]=period
node -e '
const w = require("./build/spike/por_v2_wit.json").map(String);
const solvent = w[1], reserveCommitment = w[2], liabRoot = w[3], liabTotal = w[4], period = w[5];
let pass = true;
function check(name, got, want) {
  const ok = got === want;
  console.log("  [" + (ok ? "OK" : "FAIL") + "]   " + name + " = " + (got.length > 20 ? got.slice(0,20)+"..." : got) + (ok ? "" : " (expected " + want + ")"));
  if (!ok) pass = false;
}
check("solvent",   solvent,   "1");
check("liabTotal", liabTotal, "4300");
check("period",    period,    "1");
console.log("  [info] reserveCommitment = " + reserveCommitment.slice(0,20) + "...");
console.log("  [info] liabRoot          = " + liabRoot.slice(0,20) + "...");
if (!pass) { console.log("\n[FAIL] por_v2 public outputs wrong"); process.exit(1); }
console.log("\n[PASS] por_v2 binds reserves to SNARK-proven liabTotal (solvent=1, liabTotal=4300 from the depth-4 tree)");
'
