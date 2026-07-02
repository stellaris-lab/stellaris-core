#!/usr/bin/env bash
# B-P1 inclusion soundness gate (offline-correct).
#
# Strategy: the aggregation circuit (agg_spike, -p bls12381) is the ground-truth
# Poseidon. We (1) build a 256-leaf agg input, (2) generate the agg witness,
# (3) extract the real root + sibling path from that witness, (4) feed them into
# the inclusion circuit and assert: valid path proves, tampered inputs do NOT.
#
# This avoids circomlibjs (BN254-only), which cannot reproduce the BLS12-381
# in-circuit Poseidon — the param-drift trap (plan 5.1).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SPIKE=build/spike
CIRCOMLIB=/home/harry-riddle/node_modules
TARGET=5

echo "=== B-P1: Merkle-sum inclusion soundness (in-circuit Poseidon ground truth) ==="

mkdir -p "$SPIKE"

# --- 0. (re)compile agg_spike + inclusion (always, so circuit edits take effect) ---
echo "--- compiling agg_spike (depth=8) ---"
circom circuits/agg_spike.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$SPIKE" >/dev/null
echo "--- compiling inclusion (depth=8) ---"
circom circuits/inclusion.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$SPIKE" >/dev/null

# --- 1. agg input + witness (ground-truth Poseidon) ---
echo "--- building agg witness ---"
node client/scripts/agg-input.mjs "$SPIKE/agg_input.json"
snarkjs wtns calculate "$SPIKE/agg_spike_js/agg_spike.wasm" "$SPIKE/agg_input.json" "$SPIKE/agg.wtns" >/dev/null
snarkjs wtns export json "$SPIKE/agg.wtns" "$SPIKE/agg_wit.json" >/dev/null

# --- 2. extract root + sibling path for the target leaf ---
echo "--- extracting inclusion witnesses ---"
node client/scripts/inclusion-witness.mjs "$SPIKE/agg_wit.json" "$SPIKE/agg_spike.sym" "$TARGET" "$SPIKE"

# --- 3. run the gate: valid proves, tampered fails ---
pass=0; fail=0
check() {  # name file expect(ok|fail)
  local name="$1" file="$2" expect="$3"
  if snarkjs wtns calculate "$SPIKE/inclusion_js/inclusion.wasm" "$file" "$SPIKE/_t.wtns" >/dev/null 2>&1; then
    got=ok
  else
    got=fail
  fi
  if [ "$got" = "$expect" ]; then
    echo "  [OK]   $name -> $got (expected $expect)"; pass=$((pass+1))
  else
    echo "  [FAIL] $name -> $got (expected $expect)"; fail=$((fail+1))
  fi
}

echo "--- inclusion gate ---"
check "valid_path"        "$SPIKE/inclusion_valid.json"         ok
check "wrong_balance"     "$SPIKE/inclusion_wrong_balance.json" fail
check "corrupted_sibling" "$SPIKE/inclusion_wrong_sibling.json" fail

echo ""
echo "=== result: $pass passed, $fail failed ==="
if [ "$fail" -eq 0 ]; then
  echo "[PASS] inclusion is sound: real path proves, tampered inputs rejected"
  exit 0
else
  echo "[FAIL] inclusion soundness gate failed"
  exit 1
fi
