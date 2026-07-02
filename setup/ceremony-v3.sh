#!/usr/bin/env bash
# Milestone C1 trusted setup for the v3 multi-asset solvency statement.
#
# por_v3 @ 4 assets x 4 reserves = 5,496 constraints -> 2^15 ptau (32,768) fits
# comfortably (measured pre-ceremony via setup/por-v3-check.sh; the constraint
# count was verified BEFORE this ceremony to avoid the depth-8 OOM trap that bit
# Milestone B). The contract path is statement-agnostic (8-signal ABI,
# IC.len()==9); a production multi-asset scale (more assets/reserves) only needs
# a larger ptau, not a statement change.
#
# Outputs (build/v3/):
#   por_v3_final.zkey, por_v3_vk.json + compiled wasm
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CIRCOMLIB="/home/harry-riddle/node_modules"
if [ ! -d "$CIRCOMLIB/circomlib" ]; then CIRCOMLIB="$(cd "$ROOT" && npm root 2>/dev/null || echo /home/harry-riddle/node_modules)"; fi

V3="build/v3"
POWER=15          # 2^15 = 32768 >= 5496 (por_v3 4x4)
mkdir -p "$V3"

echo "=== Stellaris v3 ceremony (multi-asset, 2^$POWER ptau) ==="

# --- 0. compile por_v3 ------------------------------------------------------
echo "--- compiling por_v3 (4 assets x 4 reserves) ---"
circom circuits/por_v3.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$V3" >/dev/null

# --- 1. powers of tau (phase 1, BLS12-381) ----------------------------------
echo "--- powers of tau (2^$POWER) ---"
snarkjs powersoftau new bls12381 "$POWER" "$V3/pot_0000.ptau" -v
snarkjs powersoftau contribute "$V3/pot_0000.ptau" "$V3/pot_0001.ptau" \
    --name="stellaris-v3-c1" -v -e="stellaris v3 entropy $(date +%s)"
snarkjs powersoftau prepare phase2 "$V3/pot_0001.ptau" "$V3/pot_final.ptau" -v

# --- 2. groth16 setup -------------------------------------------------------
echo "--- groth16 setup: por_v3 ---"
snarkjs groth16 setup "$V3/por_v3.r1cs" "$V3/pot_final.ptau" "$V3/por_v3_0000.zkey"
snarkjs zkey contribute "$V3/por_v3_0000.zkey" "$V3/por_v3_final.zkey" \
    --name="por_v3-c1" -v -e="por_v3 entropy $(date +%s)"
snarkjs zkey export verificationkey "$V3/por_v3_final.zkey" "$V3/por_v3_vk.json"

echo ""
echo "=== v3 ceremony complete (multi-asset) ==="
echo "por_v3: $V3/por_v3_final.zkey + por_v3_vk.json"
