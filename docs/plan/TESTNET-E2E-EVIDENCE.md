# Testnet E2E Evidence — Mint-Guard Live on Stellar Testnet

Network: Test SDF Network ; September 2015 (testnet)
Date (UTC): 2026-06-29 15:34 UTC
Source/admin/issuer: GBWD3SUGWEJWVGYB4ULLTKZWVSHDF3EP3HQWNE4Z7MTY3UX2QWTAYMGH (alias `harry`)
stellar-cli: 27.0.0

## Deployed contracts

| Role | Contract ID | WASM | Explorer |
|---|---|---|---|
| Attestation (Stellaris PoR) | `CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H` | stellaris_contract.wasm (26,822 B) | https://stellar.expert/explorer/testnet/contract/CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H |
| Guard (SolvencyGatedToken) | `CCXJQ77B5G7PVIOOBCWXVPERD7Q35WKDRU5744G5QA6DQX6TSYWG4OIQ` | stellaris_mint_guard.wasm (10,629 B) | https://stellar.expert/explorer/testnet/contract/CCXJQ77B5G7PVIOOBCWXVPERD7Q35WKDRU5744G5QA6DQX6TSYWG4OIQ |

These are TWO SEPARATE deployed WASMs (the crate-split). The guard reads the
attestation via a real cross-contract call.

## Transaction trail (all confirmed `successful` on Horizon)

| Step | Operation | Tx hash |
|---|---|---|
| init | attestation `init(admin, v1 VK)` | `719ade4941a6b155195cfa21b9ee72be99903d60275dfec78e3bd22d60b16039` |
| init_v3 | attestation `init_v3(v3 VK)` | `57b09fc024f041072636bdffc911a79a440afe2a79c3125a70586dcb6fb9f5d2` |
| guard init | guard `init(config, current_period=1)` | `a166daaaa7a552fd9a72506e586bbc6afb06de23927496941311b279c539f8a1` |
| attest_v3 | attestation `attest_v3(issuer, REAL proof, signals)` | `f39ac959b4a7c0be05ae3e6624bcaa9fcc7d42f090ce73f680add879f621e65e` |
| mint | guard `mint(issuer, 2_000_000)` | `6676b00ed77914509d71834aac6c41bbb7e069921f1a7f37dfd5ad518e919549` |

## The headline, proven on-chain (blocked -> attest -> allowed)

BEFORE attestation:
- `check_mint_allowed()` -> `Error(Contract, #3)` = `NoAttestation`
- `mint(2_000_000)` -> reverts `Error(Contract, #3)` (fails CLOSED)
- `get_attestation_v3(issuer, 1)` -> null

ATTEST (the cryptographic crux, verified live):
- `attest_v3` with the REAL solvent Groth16 proof emitted event
  `AttestationRecordedV3` with `aggregate_solvent: true`,
  `asset_solvent: [true,true,true,true]`, `period_id: 1`.
- The BLS12-381 Groth16 pairing check ran inside the Soroban host on testnet
  and ACCEPTED the proof. This is not a mock — it is the same proof the host
  test verifies, now verified by the deployed contract on-chain.

AFTER attestation:
- `check_mint_allowed()` -> Ok (void, no error) — the gate flipped
- `mint(2_000_000)` -> success (tx above, Horizon `successful: true`)
- `total_supply()` -> `2000000`
- `balance(issuer)` -> `2000000`

The SAME mint call that reverted with NoAttestation now succeeds, solely
because a fresh, real, solvent attestation exists for the current period.
That is the Chainlink "Secure Mint" parity property, live on Stellar.

## Honest notes / operational lessons

- Testnet ledger close (~5s) means read-after-write races are real: several
  reads returned null immediately after a successful write and resolved after a
  ~12s settle. Every "null" in the live run was a race, not a logic failure —
  confirmed by re-reading and by Horizon tx status.
- `init_v3` initially failed `Error(#1) NotInitialized` because it simulated
  before `init` was ingested; it succeeded once admin was confirmed on-chain.
- The guard `init` GuardConfig arg encoding: u64 fields are bare JSON numbers,
  i128 fields are quoted strings (per `stellar contract invoke ... init --help`).
  Addresses are plain strings. This mixed shape is the CLI's spec-JSON convention.
- The `testnet-deploy.sh` "[OK]" lines were over-optimistic on the first run
  (printed regardless of step success); the authoritative truth is this evidence
  file + the Horizon tx statuses + the read-back state values, all captured by
  re-querying on-chain after settling.

## Verification commands (reproducible)

```bash
# admin set?
stellar contract invoke --id CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H \
  --source harry --network testnet -- get_admin
# v3 VK stored?
stellar contract invoke --id CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H \
  --source harry --network testnet -- get_vk_v3
# attestation recorded?
stellar contract invoke --id CA5JQT754432JAWWDDBLWLXBRECIN5ZPIRGGN36WFVSDJEFRKS2DTV5H \
  --source harry --network testnet -- get_attestation_v3 \
  --issuer GBWD3SUGWEJWVGYB4ULLTKZWVSHDF3EP3HQWNE4Z7MTY3UX2QWTAYMGH --period_id 1
# guard supply after mint?
stellar contract invoke --id CCXJQ77B5G7PVIOOBCWXVPERD7Q35WKDRU5744G5QA6DQX6TSYWG4OIQ \
  --source harry --network testnet -- total_supply
```
