#!/usr/bin/env bash
# ceremony.sh — DEMO trusted setup for Stellaris (BLS12-381 curve)
#
# WARNING: SINGLE-CONTRIBUTOR DEMO ONLY.
# This is NOT a secure production trusted setup.
# A real deployment needs a multi-party ceremony with multiple independent
# contributors. This script uses a single deterministic entropy source
# for hackathon demonstration purposes.
#
# Usage:
#   bash setup/ceremony.sh
#
# Prerequisites:
#   - circom (with BLS12-381 support: compile with --curve bls12381)
#   - snarkjs (npm install -g snarkjs OR npx snarkjs)
#   - Node.js
#
# Outputs:
#   - build/por.r1cs           — circuit constraints
#   - build/por.wasm           — witness generation WASM
#   - build/por_final.zkey     — proving key
#   - build/verification_key.json — verification key
#   - build/pot12_final.ptau   — powers of tau file
#
# See: plan/05-DEVELOPMENT-PLAYBOOK.md (P2)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
CIRCUITS_DIR="$PROJECT_DIR/circuits"

echo "=== Stellaris Trusted Setup (DEMO ONLY) ==="
echo "Curve: BLS12-381"
echo "Circuit: $CIRCUITS_DIR/por.circom"
echo "Build:   $BUILD_DIR"
echo ""

mkdir -p "$BUILD_DIR"

# ---- Step 1: Compile circuit ----
echo "[1/7] Compiling circuit..."
circom "$CIRCUITS_DIR/por.circom" \
    --r1cs --wasm --sym \
    --curve bls12381 \
    -o "$BUILD_DIR"
echo "[OK] Compiled."

# ---- Step 2: Start powers of tau ----
echo "[2/7] Starting powers of tau (12 powers)..."
snarkjs powersoftau new bls12381 12 "$BUILD_DIR/pot12_0000.ptau" -v
echo "[OK] Phase 1 started."

# ---- Step 3: Single contribution (DEMO — real ceremony needs many) ----
echo "[3/7] Contributing entropy (SINGLE CONTRIBUTOR — DEMO)..."
# Deterministic entropy for reproducibility in demos.
# In production, use random input from multiple parties.
echo "DEMO ENTROPY: Stellaris hackathon demo 2026" | \
    snarkjs powersoftau contribute "$BUILD_DIR/pot12_0000.ptau" "$BUILD_DIR/pot12_0001.ptau" \
    --name="Demo contributor" -v
echo "[OK] Contributed."

# ---- Step 4: Prepare phase 2 ----
echo "[4/7] Preparing phase 2..."
snarkjs powersoftau prepare phase2 "$BUILD_DIR/pot12_0001.ptau" "$BUILD_DIR/pot12_final.ptau" -v
echo "[OK] Prepared phase 2."

# ---- Step 5: Groth16 setup ----
echo "[5/7] Running Groth16 setup..."
snarkjs groth16 setup "$BUILD_DIR/por.r1cs" "$BUILD_DIR/pot12_final.ptau" "$BUILD_DIR/por_0000.zkey"
echo "[OK] Setup complete."

# ---- Step 6: Single zkey contribution (DEMO) ----
echo "[6/7] Contributing to zkey (SINGLE — DEMO)..."
echo "DEMO ZKEY ENTROPY: 2026-06-22" | \
    snarkjs zkey contribute "$BUILD_DIR/por_0000.zkey" "$BUILD_DIR/por_final.zkey" \
    --name="Demo zkey contributor" -v
echo "[OK] Zkey contributed."

# ---- Step 7: Export verification key ----
echo "[7/7] Exporting verification key..."
snarkjs zkey export verificationkey "$BUILD_DIR/por_final.zkey" "$BUILD_DIR/verification_key.json"
echo "[OK] Verification key exported."

echo ""
echo "=== Setup Complete ==="
echo "Proving key:   $BUILD_DIR/por_final.zkey"
echo "Verification:  $BUILD_DIR/verification_key.json"
echo "WASM witness:  $BUILD_DIR/por_js/por.wasm"
echo ""
echo "WARNING: This is a DEMO single-contributor setup."
echo "DO NOT use these keys in production."
echo ""
