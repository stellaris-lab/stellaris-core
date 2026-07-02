#!/usr/bin/env bash
# B-P4: generate real v2 fixtures — a solvency-v2 proof and a per-user inclusion
# proof, both snarkjs-verified — for the contract v2 tests. Run AFTER
# setup/ceremony-v2.sh has produced build/v2/{por_v2_final.zkey,
# inclusion_final.zkey, *_vk.json} and the witness inputs exist.
#
# Strips non-signal keys from inputs before witness calc (the `description` fix
# from export-fixtures.sh carries over: circom's witness calc rejects extra keys).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SPIKE="build/spike"
V2="build/v2"
FIX="fixtures/v2"

mkdir -p "$FIX/solvency" "$FIX/insolvent" "$FIX/inclusion"

# Depth must match the repo-scale circuits the ceremony compiled (depth=4).
DEPTH=4

# --- 1. solvency-v2 proof (solvent=1) ----------------------------------------
echo "[1/3] solvency-v2 witness + proof (solvent=1)..."
node client/scripts/por-v2-input.mjs "$SPIKE" "$DEPTH"
snarkjs wtns calculate "$V2/por_v2_repo_js/por_v2_repo.wasm" \
    "$SPIKE/por_v2_input.json" "$SPIKE/por_v2.wtns"
snarkjs groth16 prove "$V2/por_v2_final.zkey" "$SPIKE/por_v2.wtns" \
    "$FIX/solvency/proof.json" "$FIX/solvency/public.json"
snarkjs groth16 verify "$V2/por_v2_vk.json" \
    "$FIX/solvency/public.json" "$FIX/solvency/proof.json"

# --- 1b. insolvent-v2 proof (VALID proof, solvent=0 — contract must reject) --
echo "[2/3] insolvent-v2 witness + proof (solvent=0)..."
node client/scripts/por-v2-insolvent-input.mjs "$SPIKE" "$DEPTH"
snarkjs wtns calculate "$V2/por_v2_repo_js/por_v2_repo.wasm" \
    "$SPIKE/por_v2_insolvent_input.json" "$SPIKE/por_v2_insolvent.wtns"
snarkjs groth16 prove "$V2/por_v2_final.zkey" "$SPIKE/por_v2_insolvent.wtns" \
    "$FIX/insolvent/proof.json" "$FIX/insolvent/public.json"
snarkjs groth16 verify "$V2/por_v2_vk.json" \
    "$FIX/insolvent/public.json" "$FIX/insolvent/proof.json"

# --- 3. copy VK --------------------------------------------------------------
echo "[3/3] copying VK..."
cp "$V2/por_v2_vk.json" "$FIX/verification_key_v2.json"

echo ""
echo "=== v2 fixtures ready (depth-$DEPTH in-repo scale) ==="
echo "Solvent:   $FIX/solvency/    public: $(cat "$FIX/solvency/public.json" | tr -d '\n ')"
echo "Insolvent: $FIX/insolvent/   public: $(cat "$FIX/insolvent/public.json" | tr -d '\n ')"
echo "VK:        $FIX/verification_key_v2.json"
