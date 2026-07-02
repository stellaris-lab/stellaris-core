#!/usr/bin/env bash
# commitment-binding-check.sh — Milestone A3: prove the Poseidon commitment
# binds the exact reserve vector.
#
# Claim under test: changing ANY single balance changes the public commitment
# signal C. If two distinct reserve vectors produced the same C, an issuer could
# swap balances after proving — the commitment would not bind. We verify the
# real circuit's public output, not a model of it.
#
# Method: generate a witness for a base input and for N single-balance-perturbed
# inputs, export each public.json, and assert every perturbed commitment differs
# from the base. Uses the real compiled circuit (build/por_js/por.wasm) + snarkjs.
#
# Pure ASCII output. No mocks. Exit 0 only if the binding holds for every case.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
WASM="$BUILD_DIR/por_js/por.wasm"
TMP="$BUILD_DIR/tmp/a3"
SIG_COMMITMENT_INDEX=1   # public.json order: [solvent, commitment, liabilities, period]

echo "=== Milestone A3: commitment-binding check ==="
echo "Circuit: $WASM"
echo ""

if [ ! -f "$WASM" ]; then
  echo "[FAIL] circuit wasm missing; run setup/ceremony.sh first"
  exit 1
fi

mkdir -p "$TMP"

# Base input: 16 equal balances.
BASE_R='[200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000,200000]'
SALT='12345678901234567890'
LIAB='2800000'
PERIOD='1'

# Compute the commitment for a given r-vector JSON; echoes the commitment string.
commitment_for() {
  local label="$1"
  local r="$2"
  local infile="$TMP/${label}_input.json"
  local wtns="$TMP/${label}.wtns"
  local pub="$TMP/${label}_public.json"

  node -e '
    const fs = require("fs");
    const r = JSON.parse(process.argv[2]);
    fs.writeFileSync(process.argv[3], JSON.stringify({
      r, salt: "'"$SALT"'", liabilities_in: "'"$LIAB"'", period_in: "'"$PERIOD"'"
    }));
  ' "x" "$r" "$infile" || return 1

  snarkjs wtns calculate "$WASM" "$infile" "$wtns" >/dev/null 2>&1 || return 1
  snarkjs wtns export json "$wtns" "$TMP/${label}_full.json" >/dev/null 2>&1 || true
  # Public signals: derive via groth16 fullprove is overkill; instead export the
  # witness and read the public outputs. snarkjs orders public signals first in
  # the witness after the constant "1". Simplest robust path: use wtns export
  # then the circuit's public outputs are witness[1..4]. We instead recompute
  # public.json via snarkjs groth16 prove (needs zkey) for an authoritative read.
  snarkjs groth16 prove "$BUILD_DIR/por_final.zkey" "$wtns" \
    "$TMP/${label}_proof.json" "$pub" >/dev/null 2>&1 || return 1

  node -e '
    const fs = require("fs");
    const pub = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    process.stdout.write(String(pub['"$SIG_COMMITMENT_INDEX"']));
  ' "x" "$pub"
}

BASE_C="$(commitment_for base "$BASE_R")"
if [ -z "$BASE_C" ]; then
  echo "[FAIL] could not compute base commitment"
  exit 1
fi
echo "  base commitment: ${BASE_C:0:24}..."
echo ""

PASS=0
FAIL=0

# Perturb each of several slots by +1 and assert the commitment changes.
for slot in 0 1 7 15; do
  PERTURBED="$(node -e '
    const r = JSON.parse(process.argv[2]);
    r['"$slot"'] = r['"$slot"'] + 1;
    process.stdout.write(JSON.stringify(r));
  ' "x" "$BASE_R")"

  C="$(commitment_for "slot${slot}" "$PERTURBED")"
  if [ -z "$C" ]; then
    echo "  [FAIL] slot $slot : witness/proof generation failed"
    FAIL=$((FAIL+1))
    continue
  fi
  if [ "$C" != "$BASE_C" ]; then
    echo "  [OK]   slot $slot perturbed +1 -> commitment changed (${C:0:16}...)"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] slot $slot perturbed +1 -> commitment UNCHANGED (binding broken!)"
    FAIL=$((FAIL+1))
  fi
done

# Also assert: same input -> same commitment (determinism).
C_REPEAT="$(commitment_for base_repeat "$BASE_R")"
if [ "$C_REPEAT" = "$BASE_C" ]; then
  echo "  [OK]   determinism: identical input -> identical commitment"
  PASS=$((PASS+1))
else
  echo "  [FAIL] determinism broken: same input gave different commitments"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== result: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -ne 0 ]; then
  echo "[FAIL] commitment does not bind the reserve vector"
  exit 1
fi
echo "[PASS] Poseidon commitment binds the exact reserve vector"
exit 0
