#!/usr/bin/env bash
# C1: generate real v3 multi-asset fixtures — a solvent proof, a priced-insolvent
# proof, and a one-asset-underwater proof, each snarkjs-verified — for the
# contract v3 tests. Run AFTER setup/ceremony-v3.sh has produced
# build/v3/{por_v3_final.zkey, por_v3_vk.json} and the wasm.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
V3="build/v3"
FIX="fixtures/v3"

mkdir -p "$FIX/solvent" "$FIX/priced_insolvent" "$FIX/one_asset_underwater"

if [ ! -f "$V3/por_v3_final.zkey" ] || [ ! -f "$V3/por_v3_vk.json" ]; then
  echo "[FAIL] missing v3 ceremony artifacts; run setup/ceremony-v3.sh first" >&2
  exit 1
fi

prove_mode() {  # mode outdir
  local mode="$1" out="$2"
  echo "--- $mode ---"
  node client/scripts/por-v3-input.mjs "$V3" "$mode" >/dev/null
  snarkjs wtns calculate "$V3/por_v3_js/por_v3.wasm" \
      "$V3/por_v3_input.json" "$V3/por_v3_$mode.wtns" >/dev/null
  snarkjs groth16 prove "$V3/por_v3_final.zkey" "$V3/por_v3_$mode.wtns" \
      "$FIX/$out/proof.json" "$FIX/$out/public.json"
  snarkjs groth16 verify "$V3/por_v3_vk.json" \
      "$FIX/$out/public.json" "$FIX/$out/proof.json"
}

echo "=== v3 multi-asset fixtures ==="
prove_mode "solvent" "solvent"
prove_mode "priced_insolvent" "priced_insolvent"
prove_mode "one_asset_underwater" "one_asset_underwater"

cp "$V3/por_v3_vk.json" "$FIX/verification_key_v3.json"

echo ""
echo "=== v3 fixtures ready ==="
echo "Solvent:              $FIX/solvent/              public: $(tr -d '\n ' < "$FIX/solvent/public.json")"
echo "Priced-insolvent:     $FIX/priced_insolvent/     public: $(tr -d '\n ' < "$FIX/priced_insolvent/public.json")"
echo "One-asset-underwater: $FIX/one_asset_underwater/ public: $(tr -d '\n ' < "$FIX/one_asset_underwater/public.json")"
echo "VK:                   $FIX/verification_key_v3.json"
