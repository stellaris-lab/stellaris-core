#!/usr/bin/env bash
# testnet-deploy.sh — Stellaris mint-guard live e2e on Stellar testnet.
#
# Proves the headline: a SolvencyGatedToken mint is BLOCKED until a fresh, solvent
# v3 attestation exists, then ALLOWED. Two real contracts, real Groth16 proof,
# real testnet transactions with hashes + explorer links.
#
# PREREQUISITES (all user-gated; this script does not silently fund or spend):
#   1. stellar-cli installed (verified: 27.0.0).
#   2. Identity `harry` exists AND is funded on testnet. Fund via:
#        stellar keys fund harry --network testnet
#      (friendbot). This script checks the balance and STOPS if unfunded.
#   3. Both WASMs built (run setup/build-wasms first, or see below).
#   4. CLI args encoded: node setup/encode-testnet-args.mjs  (offline, already run).
#
# This script is IDEMPOTENT where possible: deploy steps that already produced an
# id are skipped if build/testnet/manifest.env records them. Re-running after a
# funded account resumes from the last completed step.
#
# Output: build/testnet/manifest.env (contract ids), and tx hashes printed inline.
# Pure ASCII. Raw CLI output is exposed at every step.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NET="testnet"
SRC="harry"
OUT="build/testnet"
ATT_WASM="contracts/stellaris/target/wasm32v1-none/release/stellaris_contract.wasm"
GUARD_WASM="contracts/mint-guard/target/wasm32v1-none/release/stellaris_mint_guard.wasm"
MANIFEST="$OUT/manifest.env"
EXPLORER="https://stellar.expert/explorer/testnet"

mkdir -p "$OUT"
[ -f "$MANIFEST" ] && source "$MANIFEST"

say()  { echo ""; echo "+============================================================"; echo "| $*"; echo "+============================================================"; }
ok()   { echo "    [OK] $*"; }
die()  { echo "    [FAIL] $*"; exit 1; }

# retry_capture <description> <command...> : run command, capturing combined
# output to $RETRY_OUT. Retries up to 5x with backoff on transient submission
# races (TxBadSeq) which happen when txns are fired faster than the source
# account's sequence number is ingested. Returns the command's last exit code.
RETRY_OUT=""
retry_capture() {
  local desc="$1"; shift
  local attempt=1 max=5 delay=4
  while :; do
    RETRY_OUT="$("$@" 2>&1)"; local rc=$?
    if echo "$RETRY_OUT" | grep -q "TxBadSeq"; then
      if [ "$attempt" -ge "$max" ]; then
        echo "    [warn] $desc: TxBadSeq after $max attempts"; return "$rc"
      fi
      echo "    [retry $attempt/$max] $desc hit TxBadSeq; waiting ${delay}s for sequence to settle"
      sleep "$delay"; attempt=$((attempt+1)); delay=$((delay+2)); continue
    fi
    return "$rc"
  done
}

ISSUER_ADDR="$(stellar keys address "$SRC" 2>/dev/null)" || die "key '$SRC' not found"
echo "issuer/admin ($SRC) = $ISSUER_ADDR"

# ---------------------------------------------------------------------------
say "STEP 0: preflight — toolchain, artifacts, encoded args, FUNDING"
# ---------------------------------------------------------------------------
stellar --version | head -1
[ -f "$ATT_WASM" ]   || die "attestation WASM missing: $ATT_WASM  (build it first)"
[ -f "$GUARD_WASM" ] || die "guard WASM missing: $GUARD_WASM  (build it first)"
ok "attestation WASM: $(wc -c < "$ATT_WASM") bytes"
ok "guard WASM:       $(wc -c < "$GUARD_WASM") bytes"
for f in vk_v1.json vk_v3.json proof_solvent.json signals_solvent.json; do
  [ -f "$OUT/$f" ] || die "encoded arg missing: $OUT/$f  (run: node setup/encode-testnet-args.mjs)"
done
ok "encoded args present (vk_v1, vk_v3, proof_solvent, signals_solvent)"

echo "--- funding check (friendbot is user-gated; not auto-run) ---"
# CLI 27.0.0 has no `stellar account` subcommand; read balance from Horizon
# (read-only, no spend). If the account does not exist / is unfunded, stop.
HORIZON="https://horizon-testnet.stellar.org"
ACCT_JSON="$(curl -s "$HORIZON/accounts/$ISSUER_ADDR")"
if echo "$ACCT_JSON" | grep -q '"status": 404' || ! echo "$ACCT_JSON" | grep -q '"balance"'; then
  echo ""
  echo "    Account is NOT funded on $NET. Fund it yourself, then re-run:"
  echo "        stellar keys fund $SRC --network $NET"
  die "unfunded account — stopping before any spend"
fi
XLM_BAL="$(echo "$ACCT_JSON" | grep '"balance"' | head -1 | sed 's/[^0-9.]//g')"
ok "account funded on $NET — native balance: $XLM_BAL XLM"

# ---------------------------------------------------------------------------
say "STEP 1: VERIFY-FIRST spec dump (no spend) — confirm BytesN arg shape"
# ---------------------------------------------------------------------------
# This empirically closes the research residual: confirm the VK fields are
# BytesN (bare-hex JSON, as the encoder emits) and not a UDT wrapper. Costs
# nothing — pure local WASM introspection. NOTE: the command is
# `contract info interface` (CLI 27.0.0); `bindings json` does not exist.
stellar contract info interface --wasm "$ATT_WASM" > "$OUT/attestation-interface.rs" 2>/dev/null \
  && ok "wrote $OUT/attestation-interface.rs" \
  || echo "    [warn] info interface failed; proceeding (CLI will still type-check args)"
if [ -f "$OUT/attestation-interface.rs" ]; then
  if grep -q "BytesN<96>" "$OUT/attestation-interface.rs"; then
    ok "spec types VK/proof fields as BytesN<96>/<192> — bare-hex JSON arg shape confirmed"
  else
    echo "    [warn] expected BytesN not found; if invoke rejects the JSON, use the"
    echo "           TS fallback (stellarisContractCodec + SorobanRpcInvoker)."
  fi
fi

# ---------------------------------------------------------------------------
say "STEP 2: deploy the attestation contract WASM"
# ---------------------------------------------------------------------------
if [ -n "${ATT_ID:-}" ]; then
  ok "already deployed: ATT_ID=$ATT_ID (skipping)"
else
  ATT_ID="$(stellar contract deploy --wasm "$ATT_WASM" --source "$SRC" --network "$NET" 2>&1 | tail -1)"
  echo "    deploy output: $ATT_ID"
  case "$ATT_ID" in
    C*) ok "attestation contract: $ATT_ID"; echo "ATT_ID=$ATT_ID" >> "$MANIFEST" ;;
    *)  die "attestation deploy did not return a C... id" ;;
  esac
fi
echo "    explorer: $EXPLORER/contract/$ATT_ID"

# ---------------------------------------------------------------------------
say "STEP 3: deploy the guard contract WASM"
# ---------------------------------------------------------------------------
if [ -n "${GUARD_ID:-}" ]; then
  ok "already deployed: GUARD_ID=$GUARD_ID (skipping)"
else
  retry_capture "guard deploy" stellar contract deploy --wasm "$GUARD_WASM" --source "$SRC" --network "$NET"
  GUARD_ID="$(echo "$RETRY_OUT" | tail -1)"
  echo "    deploy output: $GUARD_ID"
  case "$GUARD_ID" in
    C*) ok "guard contract: $GUARD_ID"; echo "GUARD_ID=$GUARD_ID" >> "$MANIFEST" ;;
    *)  die "guard deploy did not return a C... id" ;;
  esac
fi
echo "    explorer: $EXPLORER/contract/$GUARD_ID"

sleep 2

# ---------------------------------------------------------------------------
say "STEP 4: init the attestation contract (admin + v1 VK, then v3 VK)"
# ---------------------------------------------------------------------------
# init(admin, vk) — admin is harry; vk is the v1 VK (required bootstrap).
# CRITICAL ORDERING: init_v3 reads the admin set by init. If init_v3 simulates
# before init has been ingested by the ledger, it fails Error(Contract,#1)
# NotInitialized. So we VERIFY admin landed (settle + read get_admin) before
# firing init_v3 — not just sleep-and-hope.
echo "--- init(admin=$SRC, vk=@vk_v1.json) ---"
retry_capture "init" stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- \
  init --admin "$ISSUER_ADDR" --vk-file-path "$OUT/vk_v1.json"
echo "$RETRY_OUT" | tail -5
sleep 12
ADMIN_NOW="$(stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- get_admin 2>/dev/null)"
case "$ADMIN_NOW" in
  *"$ISSUER_ADDR"*) ok "init landed — admin=$ISSUER_ADDR confirmed on-chain" ;;
  *) die "init did not persist (get_admin returned: $ADMIN_NOW)" ;;
esac
echo "--- init_v3(vk=@vk_v3.json) ---"
retry_capture "init_v3" stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- \
  init_v3 --vk-file-path "$OUT/vk_v3.json"
echo "$RETRY_OUT" | tail -5
sleep 12
VK3_NOW="$(stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- get_vk_v3 2>/dev/null)"
case "$VK3_NOW" in
  *alpha*) ok "init_v3 landed — v3 VK stored on-chain" ;;
  *) die "init_v3 did not persist (get_vk_v3 returned: $VK3_NOW)" ;;
esac

# ---------------------------------------------------------------------------
say "STEP 5: init the guard token (bind to attestation + issuer, period 1)"
# ---------------------------------------------------------------------------
# GuardConfig { attestation_contract, issuer, max_age_secs, require_oracle_bound,
#               require_custodian_bound, supply_cap }. current_period = 1.
CONFIG_JSON="$OUT/guard_config.json"
# CRITICAL ENCODING (confirmed against `stellar contract invoke ... init --help`):
# in the struct-JSON arg, u64 fields (max_age_secs) are BARE numbers, but i128
# fields (supply_cap) MUST be QUOTED strings. Addresses are quoted strings.
# Mixing these up yields either "invalid type: number, expected string or map"
# (i128 as bare number) or "unknown variant `0`" (u64 as quoted string).
cat > "$CONFIG_JSON" <<JSON
{ "attestation_contract": "$ATT_ID", "issuer": "$ISSUER_ADDR", "max_age_secs": 0, "require_oracle_bound": false, "require_custodian_bound": false, "supply_cap": "0" }
JSON
echo "    wrote $CONFIG_JSON:"; cat "$CONFIG_JSON"
# NOTE: the generated flag is --current_period (underscore), not --current-period.
retry_capture "guard init" stellar contract invoke --id "$GUARD_ID" --source "$SRC" --network "$NET" -- \
  init --config-file-path "$CONFIG_JSON" --current_period 1
echo "$RETRY_OUT" | tail -5
# Verify the init actually landed (settle past the ledger close, then read state)
# rather than trusting the optimistic "submitted" line.
sleep 12
GCFG="$(stellar contract invoke --id "$GUARD_ID" --source "$SRC" --network "$NET" -- get_config 2>/dev/null)"
case "$GCFG" in
  *attestation_contract*) ok "guard initialized + verified on-chain (current_period=1)" ;;
  *) die "guard init did not persist (get_config returned: $GCFG)" ;;
esac

# ---------------------------------------------------------------------------
say "STEP 6: BEFORE — mint must be BLOCKED (no attestation yet)"
# ---------------------------------------------------------------------------
# ASSERT the mint is actually blocked. We REQUIRE the guard to reject with
# Error(Contract,#3)=NoAttestation; a missing error or a different error is a
# real failure, not an [OK]. (The earlier version printed [OK] unconditionally
# via `|| ok`, which masked failures — fixed here.)
echo "--- check_mint_allowed() — expect Error(Contract, #3) NoAttestation ---"
CMA_OUT="$(stellar contract invoke --id "$GUARD_ID" --source "$SRC" --network "$NET" -- check_mint_allowed 2>&1)"
echo "$CMA_OUT" | tail -8
case "$CMA_OUT" in
  *"Error(Contract, #3)"*) ok "mint gate correctly CLOSED pre-attestation (NoAttestation)" ;;
  *) die "expected NoAttestation block, got: $(echo "$CMA_OUT" | tail -2)" ;;
esac
# Belt-and-suspenders: confirm no attestation actually exists for the period.
NOATT="$(stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- get_attestation_v3 --issuer "$ISSUER_ADDR" --period-id 1 2>/dev/null)"
case "$NOATT" in
  null|"") ok "confirmed: no attestation exists for period 1 yet" ;;
  *) echo "    [warn] expected null attestation pre-attest, got: $NOATT" ;;
esac

sleep 2

# ---------------------------------------------------------------------------
say "STEP 7: record a REAL solvent v3 attestation for period 1"
# ---------------------------------------------------------------------------
echo "--- attest_v3(issuer, proof=@proof_solvent.json, signals=@signals_solvent.json) ---"
retry_capture "attest_v3" stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- \
  attest_v3 --issuer "$ISSUER_ADDR" \
            --proof-file-path "$OUT/proof_solvent.json" \
            --pub-signals-file-path "$OUT/signals_solvent.json"
echo "$RETRY_OUT" | tail -8
# ASSERT the attestation actually recorded. The attest_v3 output emits the
# AttestationRecordedV3 event with aggregate_solvent:true when the real Groth16
# pairing check passed; verify via a settled read rather than trusting the line.
sleep 12
echo "--- read it back: get_attestation_v3(issuer, 1) ---"
ATT_READ="$(stellar contract invoke --id "$ATT_ID" --source "$SRC" --network "$NET" -- get_attestation_v3 --issuer "$ISSUER_ADDR" --period-id 1 2>/dev/null)"
echo "    $ATT_READ"
case "$ATT_READ" in
  *'"aggregate_solvent":true'*) ok "attestation recorded + verified on-chain (real Groth16 proof accepted, aggregate_solvent=true)" ;;
  *) die "attest_v3 did not persist a solvent attestation (got: $ATT_READ)" ;;
esac

sleep 2

# ---------------------------------------------------------------------------
say "STEP 8: AFTER — the same mint now SUCCEEDS"
# ---------------------------------------------------------------------------
# ASSERT the gate flipped to allowed. check_mint_allowed must now return Ok
# (null), with NO Error(Contract,#N).
echo "--- check_mint_allowed() — expect Ok (null), no error ---"
CMA2="$(stellar contract invoke --id "$GUARD_ID" --source "$SRC" --network "$NET" -- check_mint_allowed 2>&1)"
echo "$CMA2" | tail -5
case "$CMA2" in
  *"Error(Contract"*) die "gate still closed after attestation (got: $(echo "$CMA2" | tail -2))" ;;
  *) ok "mint gate now OPEN (check_mint_allowed = Ok)" ;;
esac
sleep 3
echo "--- mint(+2,000,000) — expect success ---"
retry_capture "mint" stellar contract invoke --id "$GUARD_ID" --source "$SRC" --network "$NET" -- \
  mint --to "$ISSUER_ADDR" --amount 2000000
echo "$RETRY_OUT" | tail -5
# ASSERT the mint actually changed state: total_supply must read 2000000, not 0.
sleep 12
SUPPLY="$(stellar contract invoke --id "$GUARD_ID" --source "$SRC" --network "$NET" -- total_supply 2>/dev/null)"
echo "    total_supply = $SUPPLY"
case "$SUPPLY" in
  *2000000*) ok "mint ALLOWED + verified: total_supply=2000000 after fresh solvent attestation" ;;
  *) die "mint did not change supply (total_supply=$SUPPLY, expected 2000000)" ;;
esac

# ---------------------------------------------------------------------------
say "DONE — testnet e2e complete"
# ---------------------------------------------------------------------------
echo "  attestation: $EXPLORER/contract/$ATT_ID"
echo "  guard:       $EXPLORER/contract/$GUARD_ID"
echo "  issuer:      $EXPLORER/account/$ISSUER_ADDR"
echo ""
echo "  Manifest written to $MANIFEST:"
cat "$MANIFEST"
echo ""
echo "  Headline proven on-chain: mint blocked -> attest_v3 (real proof) -> mint allowed."
