#!/usr/bin/env bash
# Milestone B trusted setup for the v2 solvency-with-liabilities statement.
#
# IN-REPO SCALE: depth=4 liability tree (16 users). This exercises the IDENTICAL
# contract code path as production (5-signal ABI, IC.len()==6, real BLS12-381
# pairing) but keeps the trusted setup small enough to run on a dev box in
# seconds. por_v2 @ depth-4 = ~26.6K constraints -> 2^15 ptau; inclusion @
# depth-4 = ~3.9K -> 2^15 covers both.
#
# PRODUCTION SCALE (depth 8-10, 256-1024 users) needs a much larger ceremony
# (2^19-2^21 ptau, memory-heavy) and is a documented heavier-ceremony / recursion
# concern (ROADMAP Milestone E). The in-repo proof deliberately does NOT silently
# shrink the statement — the circuit, ABI, and contract are depth-agnostic; only
# the trusted-setup size differs. See plan 06 §3.4 pitfall.
#
# Outputs (build/v2/):
#   por_v2_final.zkey, por_v2_vk.json
#   inclusion_final.zkey, inclusion_vk.json
#   + compiled wasm for both circuits
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CIRCOMLIB="$(cd "$ROOT" && npm root 2>/dev/null || echo /home/harry-riddle/node_modules)"
# circomlib lives at the home-level node_modules (hoisted); fall back if needed.
if [ ! -d "$CIRCOMLIB/circomlib" ]; then CIRCOMLIB="/home/harry-riddle/node_modules"; fi

V2="build/v2"
POWER=15          # 2^15 = 32768 >= 26643 (por_v2 depth-4)
mkdir -p "$V2"

echo "=== Stellaris v2 ceremony (depth-4 in-repo scale, 2^$POWER ptau) ==="

# --- 0. compile both circuits at depth-4 (the repo-scale mains) -------------
echo "--- compiling por_v2_repo (depth=4) ---"
circom circuits/por_v2_repo.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$V2" >/dev/null
echo "--- compiling inclusion_repo (depth=4) ---"
circom circuits/inclusion_repo.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$V2" >/dev/null

# --- 1. powers of tau (phase 1, BLS12-381) ----------------------------------
echo "--- powers of tau (2^$POWER) ---"
snarkjs powersoftau new bls12381 "$POWER" "$V2/pot_0000.ptau" -v
snarkjs powersoftau contribute "$V2/pot_0000.ptau" "$V2/pot_0001.ptau" \
    --name="stellaris-v2-c1" -v -e="stellaris v2 entropy $(date +%s)"
snarkjs powersoftau prepare phase2 "$V2/pot_0001.ptau" "$V2/pot_final.ptau" -v

# --- 2. groth16 setup per circuit -------------------------------------------
setup_circuit() {
    local name="$1"
    echo "--- groth16 setup: $name ---"
    snarkjs groth16 setup "$V2/${name}.r1cs" "$V2/pot_final.ptau" "$V2/${name}_0000.zkey"
    snarkjs zkey contribute "$V2/${name}_0000.zkey" "$V2/${name}_final.zkey" \
        --name="${name}-c1" -v -e="$name entropy $(date +%s)"
    snarkjs zkey export verificationkey "$V2/${name}_final.zkey" "$V2/${name}_vk.json"
}

setup_circuit "por_v2_repo"
setup_circuit "inclusion_repo"

# Normalize artifact names the export script expects.
cp "$V2/por_v2_repo_final.zkey"   "$V2/por_v2_final.zkey"
cp "$V2/por_v2_repo_vk.json"      "$V2/por_v2_vk.json"
cp "$V2/inclusion_repo_final.zkey" "$V2/inclusion_final.zkey"
cp "$V2/inclusion_repo_vk.json"    "$V2/inclusion_vk.json"
# wasm dirs: export script reads por_v2_js / inclusion_js
cp -r "$V2/por_v2_repo_js"   "$V2/por_v2_js" 2>/dev/null || true
cp -r "$V2/inclusion_repo_js" "$V2/inclusion_js" 2>/dev/null || true

echo ""
echo "=== v2 ceremony complete (depth-4 in-repo scale) ==="
echo "por_v2:    $V2/por_v2_final.zkey + por_v2_vk.json"
echo "inclusion: $V2/inclusion_final.zkey + inclusion_vk.json"
