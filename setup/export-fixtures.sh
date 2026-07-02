#!/usr/bin/env bash
# export-fixtures.sh — Generate Groth16 proof fixtures for contract tests and client dev.
#
# Usage:
#   bash setup/export-fixtures.sh
#
# Prerequisites:
#   - bash setup/ceremony.sh must have been run first
#   - snarkjs available
#
# Outputs:
#   - fixtures/solvent/proof.json + public.json
#   - fixtures/insolvent/proof.json + public.json
#   - fixtures/boundary/proof.json + public.json
#   - fixtures/verification_key.json (copy of build/verification_key.json)
#
# See: plan/05-DEVELOPMENT-PLAYBOOK.md (P2)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
CIRCUITS_DIR="$PROJECT_DIR/circuits"
INPUTS_DIR="$CIRCUITS_DIR/inputs"
FIXTURES_DIR="$PROJECT_DIR/fixtures"

echo "=== Stellaris Fixture Generation ==="
echo ""

mkdir -p "$FIXTURES_DIR/solvent" "$FIXTURES_DIR/insolvent" "$FIXTURES_DIR/boundary"

# Helper: generate proof for a given input file
generate_proof() {
    local label="$1"
    local input_file="$2"
    local out_dir="$3"

    echo "[$label] Generating witness..."
    mkdir -p "$BUILD_DIR/tmp"

    # circom's witness calculator requires the input JSON to contain ONLY the
    # circuit's declared signals (r, salt, liabilities_in, period_in). The source
    # input files also carry a human-readable "description" key for docs, so we
    # strip non-signal keys into a sanitized temp file before witness calc.
    local sanitized="$BUILD_DIR/tmp/${label}_input.json"
    node -e '
        const fs = require("fs");
        const src = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        const allow = ["r", "salt", "liabilities_in", "period_in"];
        const out = {};
        for (const k of allow) if (k in src) out[k] = src[k];
        fs.writeFileSync(process.argv[2], JSON.stringify(out));
    ' "$input_file" "$sanitized"

    snarkjs wtns calculate \
        "$BUILD_DIR/por_js/por.wasm" \
        "$sanitized" \
        "$BUILD_DIR/tmp/${label}.wtns"

    echo "[$label] Generating proof..."
    snarkjs groth16 prove \
        "$BUILD_DIR/por_final.zkey" \
        "$BUILD_DIR/tmp/${label}.wtns" \
        "$BUILD_DIR/tmp/${label}_proof.json" \
        "$BUILD_DIR/tmp/${label}_public.json"

    echo "[$label] Verifying proof locally..."
    snarkjs groth16 verify \
        "$BUILD_DIR/verification_key.json" \
        "$BUILD_DIR/tmp/${label}_public.json" \
        "$BUILD_DIR/tmp/${label}_proof.json"

    # Copy to fixtures
    cp "$BUILD_DIR/tmp/${label}_proof.json" "$out_dir/proof.json"
    cp "$BUILD_DIR/tmp/${label}_public.json" "$out_dir/public.json"

    echo "[OK] $label fixtures ready."
}

echo "--- Solvent proof ---"
generate_proof "solvent" "$INPUTS_DIR/solvent.json" "$FIXTURES_DIR/solvent"

echo ""
echo "--- Insolvent proof ---"
generate_proof "insolvent" "$INPUTS_DIR/insolvent.json" "$FIXTURES_DIR/insolvent"

echo ""
echo "--- Boundary proof ---"
generate_proof "boundary" "$INPUTS_DIR/boundary.json" "$FIXTURES_DIR/boundary"

# Copy VK
echo ""
echo "--- Verification key ---"
cp "$BUILD_DIR/verification_key.json" "$FIXTURES_DIR/verification_key.json"
echo "[OK] VK copied."

echo ""
echo "=== Fixtures Ready ==="
echo "Solvent:     $FIXTURES_DIR/solvent/"
echo "Insolvent:   $FIXTURES_DIR/insolvent/"
echo "Boundary:    $FIXTURES_DIR/boundary/"
echo "VK:          $FIXTURES_DIR/verification_key.json"
echo ""
echo "Verify public signal order for contract/client development:"
echo "  cat $FIXTURES_DIR/solvent/public.json"
echo "  Expected: [\"1\", \"<poseidon_hash>\", \"2800000\", \"1\"]"
echo ""
