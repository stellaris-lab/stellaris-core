# 03 — Client RPD (WASM proving, issuer UI, glue)

The off-chain client. TypeScript + snarkjs (WASM) + stellar SDK. Secrets never
leave the browser; all chain calls isolated for mockability.

---

### 3.1 `client/src/prove.ts`

**R - Role**
Generate a Groth16 proof in-browser from issuer-entered reserve balances, so raw
balances never touch a server.

**P - Public API**
```ts
export interface ReserveInput {
  balances: bigint[];   // r[0..n-1], padded to n=16
  salt: bigint;
  liabilities: bigint;  // L
  periodId: bigint;
}
export interface ProofBundle {
  proof: Groth16Proof;
  publicSignals: string[]; // actual order from circuits/PUBLIC_SIGNALS.md
}
export async function generateProof(input: ReserveInput): Promise<ProofBundle>;
export function toContractArgs(b: ProofBundle): { proof: Buffer; signals: bigint[] };
```

**D - Detailed Flow for `generateProof`**
1. Validate `balances.length <= 16`; pad with zeros to n=16.
2. Build the witness input object matching `por.circom` signal names exactly.
3. `snarkjs.groth16.fullProve(input, porWasmUrl, porZkeyUrl)` -> {proof,
   publicSignals}.
4. Assert `publicSignals.length === 4` and index 0 ∈ {"0","1"}.
5. Return bundle. NEVER log raw balances; only the commitment is loggable.
Pitfall: witness input keys must match circuit signal names 1:1 or snarkjs
throws cryptic errors. Keep a shared constant of signal names.

**D - Detailed Flow for `toContractArgs`**
1. Convert proof JSON to the contract's expected byte layout (reuse the SAME
   converter logic as `setup/export-vk.sh`; do not diverge).
2. Map publicSignals to the contract's `Vec<U256>` arg in locked order.

---

### 3.2 `client/src/stellar.ts`

**R - Role**
Single module owning ALL Soroban interaction so the UI is chain-agnostic and a
mock can be swapped for demo reliability.

**P - Public API**
```ts
export interface StellarisClient {
  attest(issuer: Keypair, b: ProofBundle): Promise<Attestation>;
  getAttestation(issuer: string, periodId: bigint): Promise<Attestation | null>;
  listPeriods(issuer: string): Promise<bigint[]>;
}
export function makeLiveClient(rpcUrl: string, contractId: string): StellarisClient;
export function makeMockClient(): StellarisClient; // demo fallback
```

**D - Detailed Flow for `attest` (live)**
1. Build the `attest` invocation with `toContractArgs(b)`.
2. Simulate -> assemble -> sign with issuer keypair -> submit via Soroban RPC.
3. Poll for result; decode returned `Attestation`.
4. Surface contract errors (NotSolvent, PeriodAlreadyAttested) as typed errors
   the UI can show clearly.
Pitfall: pin the stellar-sdk / soroban-client version; testnet RPC URL in env.
`makeMockClient` returns deterministic success/failure so the demo survives RPC
outages (mock-first principle from hackathon-strategy skill).

---

### 3.3 `client/src/ui/`

**R - Role**
Minimal, legible issuer UI: enter balances -> generate proof (local) -> submit
-> see on-chain "Solvent as of ledger N" attestation. Plus the insolvent demo.

**P - Public API (components)**
- `ReserveForm` — n balance inputs + liabilities + period; "Generate Proof".
- `ProofStatus` — shows proving progress, commitment C, solvent flag (local).
- `AttestationCard` — reads back the on-chain attestation; green/red state.
- `DemoToggle` — switch live/mock client for reliable demo.

**D - Detailed Flow**
1. On submit: call `generateProof` (show "proving locally, secrets never leave
   this device" — a judge-facing trust message).
2. Call `client.attest`; on success render `AttestationCard` from the on-chain
   read (not the local result — proves it's really on-chain).
3. Insolvent path: if `solvent=0`, attempt attest, show the contract REJECT with
   `NotSolvent` — the key 15-second differentiator on camera.
Design: pure, uncluttered; the UI is NOT the product, the on-chain proof is.

---

### 3.4 `client/scripts/e2e.sh`

**R - Role**
One command that runs the full path: build circuit -> setup -> deploy contract
-> generate proof -> attest on testnet -> read back. The reusable smoke test.

**P - Public API (script)**
- `./e2e.sh testnet` — full live run; prints the attestation + explorer link.
- `./e2e.sh local` — uses mock client; no network.

**D - Detailed Flow**
1. Build circuit + run ceremony (cached if present).
2. `stellar contract deploy` the stellaris; capture contract id.
3. `init` with admin + vk.
4. Generate solvent proof; `attest`; assert stored attestation solvent=true.
5. Generate insolvent proof; `attest`; assert it FAILS with NotSolvent.
6. Re-attest same period; assert PeriodAlreadyAttested.
7. Print PASS/FAIL summary with full raw output (pure ASCII, no Unicode glyphs;
   `[OK]` / `[FAIL]` markers; `sleep` between steps for legibility).
Per user prefs: expose ALL raw output; `|| true` after greps under `set -e`.

---

## Demo-day assets (P6, in README + video)
- `DEMO-SCRIPT.md` — exact click flow + spoken lines + fallback to mock.
- README: states the ZK integration (load-bearing), the honest PoR limitation,
  and "research prototype, not audited." Architecture diagram (ASCII).
- 2-3 min video: enter balances -> local proof -> on-chain solvent attestation
  -> show insolvent rejection -> show replay rejection.

## Cross-file invariants (do not drift)
1. Public-signal order comes from generated `circuits/PUBLIC_SIGNALS.md` and is
   identical in por.circom, types.rs, constants.ts, and prove.ts.
2. Proof byte encoding identical in export-vk.sh and toContractArgs.
3. n=16, nBits=64 consistent across circuit, prove.ts validation, tests.
4. soroban-sdk + stellar-sdk versions pinned, taken from the official verifier
   example (confirmed in P0), never "latest".
