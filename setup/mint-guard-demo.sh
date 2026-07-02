#!/usr/bin/env bash
# Stellaris mint-guard demo (Sprint A wedge): solvency-gated minting.
#
# THE HEADLINE STORY, run against the REAL contracts on the host target:
#   1. A SolvencyGatedToken is bound to a deployed Stellaris attestation contract.
#   2. With NO fresh attestation, mint() FAILS CLOSED (NoAttestation).
#   3. The issuer records a REAL Groth16/BLS12-381 multi-asset solvency proof.
#   4. The SAME mint now SUCCEEDS.
#   5. A new reporting period opens -> mint blocks again until the issuer re-attests.
#
# This is the Stellar-native analogue of Chainlink "Secure Mint": issuance cannot
# exceed what a privacy-preserving solvency proof currently supports.
#
# WHY THIS RUNS THE TEST SUITE, NOT A TESTNET TX:
#   stellar-cli is not installed in this environment and no testnet account is
#   funded, so a live tx demo is user-gated (see docs/plan/SPRINT-A-SPIKE-GONOGO.md
#   "DEPLOYMENT NOTE"). The cargo test below is a REAL two-contract end-to-end
#   exercise: both #[contract] types are registered as independent instances in
#   one Soroban Env and the guard performs a genuine cross-contract call into the
#   attestation contract, whose verdict comes from the REAL on-chain Groth16
#   pairing check over the real SOLVENT_V3 fixture. No mock attestation.
#
# Pure ASCII output, sleeps between steps, raw test output exposed.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACT="$ROOT/contracts/stellaris"
PAUSE="${PAUSE:-1}"

step() { echo ""; echo "+------------------------------------------------------------+"; echo "| $1"; echo "+------------------------------------------------------------+"; sleep "$PAUSE"; }

echo "============================================================"
echo " STELLARIS MINT-GUARD DEMO -- solvency-gated minting"
echo " (real two-contract e2e; real Groth16 pairing check)"
echo "============================================================"
sleep "$PAUSE"

step "STEP 1: the guard semantics (what mint() enforces, in order)"
cat <<'EOF'
  mint(to, amount) on SolvencyGatedToken:
    1. require_auth(issuer)
    2. cross-contract read: get_attestation_v3(issuer, current_period)
         none           -> revert NoAttestation          (FAIL CLOSED)
    3. aggregate_solvent == false  -> revert NotSolvent
    4. attestation.period_id < current_period -> StaleAttestationPeriod
    5. age > max_age_secs (if set) -> StaleAttestationAge
    6. require_oracle_bound  && !oracle_bound    -> OracleBindingRequired
       require_custodian_bound && !custodian_bound -> CustodianBindingRequired
    7. supply_cap exceeded -> SupplyCapExceeded
    8. all pass            -> credit balance, bump supply
EOF
sleep "$PAUSE"

step "STEP 2: run the REAL blocked -> attest -> allowed test"
echo "    test: test_mint_allowed_after_real_attestation"
echo "    (mint blocked with no attestation; then a REAL solvent v3 proof is"
echo "     recorded through the real pairing check; the same mint then succeeds)"
echo ""
cargo test -p stellaris-contract --manifest-path "$CONTRACT/Cargo.toml" \
  test_mint_allowed_after_real_attestation -- --nocapture 2>&1 || true
sleep "$PAUSE"

step "STEP 3: run the period-rollover gate (re-attest required)"
echo "    test: test_period_rollover_blocks_until_reattest"
echo ""
cargo test -p stellaris-contract --manifest-path "$CONTRACT/Cargo.toml" \
  test_period_rollover_blocks_until_reattest -- --nocapture 2>&1 || true
sleep "$PAUSE"

step "STEP 4: run the FULL mint-guard suite (all 11 guard arms)"
echo "    fail-closed, freshness, oracle/custodian binding, supply cap, init"
echo ""
cargo test -p stellaris-contract --manifest-path "$CONTRACT/Cargo.toml" \
  test_mint_guard 2>&1 || true
sleep "$PAUSE"

step "STEP 5: prove the default deployable WASM is the attestation contract ONLY"
echo "    (the guard is #[cfg(test)] only; a standalone guard WASM needs the"
echo "     crate split tracked for the testnet sprint -- see SPRINT-A-SPIKE-GONOGO.md)"
echo ""
WASM="$CONTRACT/target/wasm32v1-none/release/stellaris_contract.wasm"
if [ -f "$WASM" ]; then
  echo "    [OK] deployable WASM present:"
  ls -l "$WASM" | sed 's/^/      /'
else
  echo "    [INFO] WASM not built yet; build with:"
  echo "      cargo build --manifest-path $CONTRACT/Cargo.toml --target wasm32v1-none --release"
fi
sleep "$PAUSE"

echo ""
echo "============================================================"
echo " DEMO COMPLETE"
echo "   - mint fails CLOSED without a fresh solvent attestation"
echo "   - a REAL Groth16 multi-asset proof unlocks the mint"
echo "   - a new period re-locks the mint until re-attestation"
echo " HONEST SCOPE: the guard reads a verdict the Stellaris contract"
echo " verified on-chain; input truthfulness is bounded by C2 (custodian"
echo " BLS) / C3 (oracle) bindings -- see docs/plan/REGULATORY-TRUST-BOUNDARY.md"
echo "============================================================"
