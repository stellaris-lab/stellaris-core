#!/usr/bin/env bash
# C1 witness-crux gate (cheap, pre-ceremony): por_v3 multi-asset solvency.
#
# Compiles por_v3 (-p bls12381), then for three input modes generates the
# witness and checks the 8 public outputs (witness[1..8]) come out correct:
#   public.json order = [ aggregateSolvent, reserveCommitment, priceCommitment,
#                         assetSolvent[0..3], period ]
#
# Modes:
#   solvent              -> aggregateSolvent=1, all assetSolvent=1
#   one_asset_underwater -> assetSolvent[0]=0 but aggregateSolvent=1 (the headline
#                           multi-asset property: one asset can be underwater while
#                           the priced aggregate is still solvent)
#   priced_insolvent     -> aggregateSolvent=0 (priced liabilities exceed priced
#                           reserves)
#
# This is the offline-correct crux check BEFORE spending a ceremony: it proves
# the circuit computes the per-asset + aggregate solvency logic correctly.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CIRCOMLIB="/home/harry-riddle/node_modules"
V3="build/v3"
mkdir -p "$V3"

echo "=== C1: por_v3 multi-asset solvency witness-crux gate ==="

echo "--- compiling por_v3 (4 assets x 4 reserves) ---"
circom circuits/por_v3.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$V3" >/dev/null

pass=0; fail=0

# check_signal <name> <got> <want>
check() {
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    echo "    [OK]   $name = $got"
    pass=$((pass+1))
  else
    echo "    [FAIL] $name = $got (expected $want)"
    fail=$((fail+1))
  fi
}

run_mode() {  # mode aggExpect a0 a1 a2 a3
  local mode="$1" aggExp="$2" a0="$3" a1="$4" a2="$5" a3="$6"
  echo "--- mode: $mode ---"
  node client/scripts/por-v3-input.mjs "$V3" "$mode" >/dev/null
  snarkjs wtns calculate "$V3/por_v3_js/por_v3.wasm" "$V3/por_v3_input.json" "$V3/por_v3.wtns" >/dev/null 2>&1
  snarkjs wtns export json "$V3/por_v3.wtns" "$V3/por_v3_wit.json" >/dev/null 2>&1
  # witness[1..8] = public outputs in declaration order:
  #   [1]=aggregateSolvent [2]=reserveCommitment [3]=priceCommitment
  #   [4..7]=assetSolvent[0..3] [8]=period
  local got
  got=$(node -e '
    const w = require("./build/v3/por_v3_wit.json").map(String);
    console.log(JSON.stringify({
      agg: w[1], a0: w[4], a1: w[5], a2: w[6], a3: w[7], period: w[8]
    }));
  ')
  local agg a0g a1g a2g a3g period
  agg=$(echo "$got"     | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).agg))')
  a0g=$(echo "$got"     | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).a0))')
  a1g=$(echo "$got"     | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).a1))')
  a2g=$(echo "$got"     | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).a2))')
  a3g=$(echo "$got"     | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).a3))')
  period=$(echo "$got"  | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).period))')
  check "aggregateSolvent" "$agg" "$aggExp"
  check "assetSolvent[0]"  "$a0g" "$a0"
  check "assetSolvent[1]"  "$a1g" "$a1"
  check "assetSolvent[2]"  "$a2g" "$a2"
  check "assetSolvent[3]"  "$a3g" "$a3"
  check "period"           "$period" "1"
}

# solvent: agg=1, all assets solvent
run_mode "solvent" 1 1 1 1 1
# one asset underwater: asset0=0, others=1, aggregate still solvent
run_mode "one_asset_underwater" 1 0 1 1 1
# priced insolvent: agg=0 (asset3 also underwater drives the priced sum below)
run_mode "priced_insolvent" 0 1 1 1 0

echo ""
echo "=== result: $pass passed, $fail failed ==="
if [ "$fail" -eq 0 ]; then
  echo "[PASS] por_v3 computes per-asset + priced-aggregate solvency correctly"
  exit 0
else
  echo "[FAIL] por_v3 crux gate failed"
  exit 1
fi
