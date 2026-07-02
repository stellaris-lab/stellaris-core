#!/usr/bin/env bash
# B3 / B-P6 verifier leg: generate a REAL Groth16 per-user inclusion proof and
# verify it against the ceremony VK (build/v2/inclusion_vk.json).
#
# This is the user-facing half of proof-of-liabilities: a user proves their
# (userId, claimedBalance) leaf folds up to the SAME published (rootHash, total)
# that the issuer's solvency-v2 proof committed to as (liabRoot, liabTotal) --
# WITHOUT revealing any sibling balance.
#
# Offline-correctness: the root + sibling path are extracted from the aggregation
# circuit's OWN BLS12-381 witness (agg_spike_repo), so the Poseidon matches the
# inclusion circuit by construction. This sidesteps circomlibjs (BN254-only),
# which cannot reproduce the in-circuit hash (plan 5.1 param-drift trap).
#
# THE TIE (the headline assertion): the depth-4 leaf set (16 users,
# balance=(i%7)*100) is byte-identical to the set por-v2-input.mjs feeds the
# solvency proof, and both use the same MerkleSumRoot component. So the inclusion
# proof's public rootHash MUST equal fixtures/v2/solvency/public.json[liabRoot]
# and its total MUST equal liabTotal (4300). We assert exactly that.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SPIKE=build/spike
V2=build/v2
FIX=fixtures/v2
CIRCOMLIB=/home/harry-riddle/node_modules
DEPTH=4
TARGET=5   # prove leaf #5 (userId=6, balance=(5%7)*100=500)

echo "=== B3/B-P6: REAL Groth16 per-user inclusion proof (depth-$DEPTH) ==="

if [ ! -f "$V2/inclusion_final.zkey" ] || [ ! -f "$V2/inclusion_vk.json" ]; then
  echo "[FAIL] missing ceremony artifacts; run setup/ceremony-v2.sh first" >&2
  exit 1
fi

mkdir -p "$SPIKE"

# --- 0. compile the depth-4 agg ground-truth + use the ceremony inclusion wasm
echo "--- compiling agg_spike_repo (depth=$DEPTH, ground-truth Poseidon) ---"
circom circuits/agg_spike_repo.circom --r1cs --wasm --sym -p bls12381 -l "$CIRCOMLIB" -o "$SPIKE" >/dev/null

# --- 1. agg input (16 leaves) + witness ------------------------------------
echo "--- building depth-$DEPTH agg witness ---"
node client/scripts/agg-input.mjs "$SPIKE/agg_repo_input.json" $((1 << DEPTH))
snarkjs wtns calculate "$SPIKE/agg_spike_repo_js/agg_spike_repo.wasm" \
    "$SPIKE/agg_repo_input.json" "$SPIKE/agg_repo.wtns" >/dev/null
snarkjs wtns export json "$SPIKE/agg_repo.wtns" "$SPIKE/agg_repo_wit.json" >/dev/null

# --- 2. extract the real root + sibling path for the target leaf -----------
echo "--- extracting inclusion witness for leaf #$TARGET ---"
node client/scripts/inclusion-witness.mjs \
    "$SPIKE/agg_repo_wit.json" "$SPIKE/agg_spike_repo.sym" "$TARGET" "$SPIKE" "$DEPTH"

# --- 3. REAL Groth16 inclusion proof + verify against the ceremony VK ------
echo "--- generating Groth16 inclusion proof (valid path) ---"
snarkjs wtns calculate "$V2/inclusion_repo_js/inclusion_repo.wasm" \
    "$SPIKE/inclusion_valid.json" "$SPIKE/inclusion_valid.wtns" >/dev/null
snarkjs groth16 prove "$V2/inclusion_final.zkey" "$SPIKE/inclusion_valid.wtns" \
    "$FIX/inclusion/proof.json" "$FIX/inclusion/public.json"

echo "--- verifying inclusion proof against ceremony VK ---"
mkdir -p "$FIX/inclusion"
if ! snarkjs groth16 verify "$V2/inclusion_vk.json" \
    "$FIX/inclusion/public.json" "$FIX/inclusion/proof.json"; then
  echo "[FAIL] inclusion proof did NOT verify against the ceremony VK" >&2
  exit 1
fi
cp "$V2/inclusion_vk.json" "$FIX/inclusion/verification_key_inclusion.json"

# --- 3b. SOUNDNESS: a forged claim must NOT even produce a witness ----------
# wrong_balance (claim a balance the leaf doesn't have) and wrong_sibling
# (corrupt a sibling hash) must both fail witness calculation against the SAME
# circuit. If either produced a witness, an attacker could forge inclusion.
echo "--- soundness: forged inclusion claims must NOT witness ---"
neg_ok=0; neg_fail=0
negcheck() {  # name file
  local name="$1" file="$2"
  if snarkjs wtns calculate "$V2/inclusion_repo_js/inclusion_repo.wasm" \
      "$file" "$SPIKE/_neg.wtns" >/dev/null 2>&1; then
    echo "  [FAIL] $name produced a witness (should have been rejected)"; neg_fail=$((neg_fail+1))
  else
    echo "  [OK]   $name rejected (no valid witness)"; neg_ok=$((neg_ok+1))
  fi
}
negcheck "wrong_balance"     "$SPIKE/inclusion_wrong_balance.json"
negcheck "corrupted_sibling" "$SPIKE/inclusion_wrong_sibling.json"
if [ "$neg_fail" -ne 0 ]; then
  echo "[FAIL] a forged inclusion claim was accepted" >&2
  exit 1
fi

# --- 4. THE TIE: inclusion public rootHash == solvency liabRoot, total==liabTotal
echo "--- asserting inclusion root === solvency liabRoot (issuer<->user tie) ---"
node -e '
const fs = require("fs");
// inclusion public.json order = [userId, claimedBalance, rootHash, total]
const inc = JSON.parse(fs.readFileSync("fixtures/v2/inclusion/public.json","utf8")).map(String);
// solvency public.json order = [solvent, reserveCommitment, liabRoot, liabTotal, period]
const sol = JSON.parse(fs.readFileSync("fixtures/v2/solvency/public.json","utf8")).map(String);
const incUserId = inc[0], incBalance = inc[1], incRoot = inc[2], incTotal = inc[3];
const liabRoot = sol[2], liabTotal = sol[3];
let pass = true;
function chk(name, got, want){
  const ok = got === want;
  const show = got.length > 28 ? got.slice(0,28)+"..." : got;
  console.log("  ["+(ok?"OK":"FAIL")+"]   "+name+" = "+show+(ok?"":" (expected "+ (want.length>28?want.slice(0,28)+"...":want) +")"));
  if(!ok) pass = false;
}
console.log("  [info] proving leaf userId="+incUserId+" claimedBalance="+incBalance);
chk("inclusion.rootHash === solvency.liabRoot", incRoot, liabRoot);
chk("inclusion.total    === solvency.liabTotal", incTotal, liabTotal);
if(!pass){ console.log("\n[FAIL] inclusion proof does not tie to the attested liability root"); process.exit(1); }
console.log("\n[PASS] a REAL Groth16 inclusion proof verifies AND ties to the issuer-attested (liabRoot, liabTotal)");
'
rc=$?

echo ""
if [ "$rc" -eq 0 ]; then
  echo "=== [PASS] B3/B-P6 inclusion proof: real, verified, and root-tied ==="
  echo "Artifacts: $FIX/inclusion/{proof.json,public.json,verification_key_inclusion.json}"
  exit 0
else
  echo "=== [FAIL] B3/B-P6 inclusion gate failed ==="
  exit 1
fi
