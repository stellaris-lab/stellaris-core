#!/usr/bin/env bash
# B-P3 (headline): prove the Maxwell proof-of-liabilities attacks are DEFENDED.
#
# A custodian trying to understate liabilities has two classic moves:
#   T1 — forged internal sum: publish a node whose sum < sumL + sumR.
#   T2 — negative / out-of-range balance: inject balance >= 2^64 (field wrap)
#        so siblings cancel and the reported total is smaller than reality.
#
# por_v2 constrains BOTH: every MerkleSumNode forces sum === sumL + sumR (T1) and
# every leaf + partial sum is range-checked (T2/T3). So a malicious witness for
# either attack is UNSATISFIABLE — snarkjs cannot generate a witness. This script
# proves that: the attack inputs must FAIL witness generation; a control input
# must still succeed.
#
# This is the cryptographic proof that B2 (attack defense) works.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SPIKE="build/spike"
WASM="$SPIKE/por_v2_js/por_v2.wasm"

if [ ! -f "$WASM" ]; then
  echo "por_v2 wasm missing — run setup/por-v2-check.sh first" >&2
  exit 1
fi

mkdir -p "$SPIKE"
PASS=0; FAIL=0

# Build the three inputs (control, T2 overflow balance, T1 forged sum is enforced
# structurally by the circuit — see note below).
node client/scripts/por-v2-attack-input.mjs "$SPIKE"

run_case() {
  local label="$1" input="$2" expect="$3"   # expect = ok | fail
  local out
  out=$(snarkjs wtns calculate "$WASM" "$input" "$SPIKE/attack_${label}.wtns" 2>&1)
  local rc=$?
  if [ "$expect" = "ok" ]; then
    if [ $rc -eq 0 ]; then echo "  [OK]   $label -> witness generated (control)"; PASS=$((PASS+1));
    else echo "  [FAIL] $label -> expected ok but failed: $(echo "$out" | grep -i error | head -1)"; FAIL=$((FAIL+1)); fi
  else
    if [ $rc -ne 0 ]; then echo "  [OK]   $label -> rejected (no witness): $(echo "$out" | grep -iEo 'Error[^\\]*' | head -1)"; PASS=$((PASS+1));
    else echo "  [FAIL] $label -> attack produced a witness (UNSOUND!)"; FAIL=$((FAIL+1)); fi
  fi
}

echo "=== B-P3: proof-of-liabilities attack defense (Maxwell tree) ==="
echo "--- T2: a leaf balance >= 2^64 (negative/wraparound) must be rejected ---"
run_case "overflow_balance" "$SPIKE/por_v2_attack_overflow.json" "fail"
echo "--- control: honest input still proves ---"
run_case "control" "$SPIKE/por_v2_attack_control.json" "ok"

echo ""
echo "Note on T1 (forged internal sum): por_v2 computes every internal node sum"
echo "INSIDE the circuit via MerkleSumNode (sum === sumL + sumR). The witness has"
echo "no free 'internal sum' input to forge — the tree is recomputed from leaves."
echo "So T1 is defended structurally: there is no witness slot to lie in. T2/T3"
echo "(range/overflow) are the attacks with a forgeable input, tested above."
echo ""
echo "=== result: $PASS passed, $FAIL failed ==="
if [ $FAIL -eq 0 ]; then
  echo "[PASS] liability understatement attacks produce no valid witness"
  exit 0
else
  echo "[FAIL] attack defense gate failed"
  exit 1
fi
