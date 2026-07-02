#!/usr/bin/env bash
# negative-witness-check.sh — Milestone A2: prove the circuit's range checks bite.
#
# A sound proof-of-reserves circuit MUST be unable to produce a witness for an
# out-of-range or forged-negative balance. This script feeds adversarial inputs
# to the real compiled circuit (build/por_js/por.wasm) and asserts that witness
# generation FAILS for each. A pass here means the Num2Bits range checks in
# components/range_check.circom are actually enforced, not decorative.
#
# This is a negative test: SUCCESS of the script == FAILURE of every bad witness.
#
# Prereqs: build/por_js/por.wasm (run setup/ceremony.sh first), snarkjs on PATH.
# Pure ASCII output, no Unicode.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
WASM="$BUILD_DIR/por_js/por.wasm"
TMP="$BUILD_DIR/tmp/negcheck"

mkdir -p "$TMP"

if [ ! -f "$WASM" ]; then
  echo "[FAIL] missing $WASM - run setup/ceremony.sh first"
  exit 1
fi

# BLS12-381 scalar field modulus r (decimal). A balance set to r-1 is the field
# encoding of "-1"; it must fail the 64-bit Num2Bits decomposition.
R_MINUS_1="52435875175126190479447740508185965837690552500527637822603658699938581184512"
# 2^64 exactly: the smallest value that overflows a 64-bit range check.
TWO_POW_64="18446744073709551616"

PASS=0
FAIL=0

# attempt_witness <label> <input_json_path>
# Expects witness generation to FAIL. Records PASS when it does.
attempt_witness() {
  local label="$1"
  local input="$2"
  local out="$TMP/${label}.wtns"
  local log="$TMP/${label}.log"

  if snarkjs wtns calculate "$WASM" "$input" "$out" >"$log" 2>&1; then
    echo "  [FAIL] $label : witness generated for an INVALID input (constraint NOT enforced)"
    FAIL=$((FAIL + 1))
  else
    local reason
    reason="$(grep -iEo 'Error:.*|Assert.*|not satisfied.*|Too many.*' "$log" | head -1 || true)"
    echo "  [OK]   $label : rejected (${reason:-unsatisfiable witness})"
    PASS=$((PASS + 1))
  fi
}

# Build an input JSON with 16 balances, overriding slot 0 with $1.
make_input() {
  local slot0="$1"
  local liab="$2"
  local period="$3"
  node -e '
    const [slot0, liab, period] = process.argv.slice(1);
    const r = new Array(16).fill("100");
    r[0] = slot0;
    process.stdout.write(JSON.stringify({
      r, salt: "12345678901234567890",
      liabilities_in: liab, period_in: period,
    }));
  ' "$slot0" "$liab" "$period"
}

echo "=== Milestone A2: adversarial witness checks (negative tests) ==="
echo "Circuit: $WASM"
echo ""

# 1. Forged negative balance (field-encoded -1 == r-1). Must fail range check.
make_input "$R_MINUS_1" "100" "1" > "$TMP/neg.json"
attempt_witness "forged_negative_balance" "$TMP/neg.json"

# 2. Balance exactly 2^64 (one past the 64-bit range). Must fail range check.
make_input "$TWO_POW_64" "100" "1" > "$TMP/overflow.json"
attempt_witness "balance_overflow_2pow64" "$TMP/overflow.json"

# 3. Liability that overflows the 68-bit comparison budget (2^68). Must fail.
make_input "100" "295147905179352825856" "1" > "$TMP/liab_overflow.json"
attempt_witness "liability_overflow_2pow68" "$TMP/liab_overflow.json"

# 4. Control: a fully valid input MUST still succeed (guards against a circuit
#    that rejects everything, which would make the above vacuous).
make_input "100" "100" "1" > "$TMP/valid.json"
if snarkjs wtns calculate "$WASM" "$TMP/valid.json" "$TMP/valid.wtns" \
    >"$TMP/valid.log" 2>&1; then
  echo "  [OK]   control_valid_input : witness generated (circuit accepts valid input)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] control_valid_input : valid input REJECTED (circuit over-constrains)"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== result: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -ne 0 ]; then
  echo "[FAIL] circuit range checks are NOT sound - investigate before shipping"
  exit 1
fi
echo "[PASS] range checks bite: no witness exists for out-of-range/negative inputs"
exit 0
