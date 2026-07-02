# Demo Script — Stellaris (2-3 min video)

Per submission requirement: 2-3 min walkthrough that EXPLICITLY explains the ZK
integration. On-camera optional. Pure-ASCII slate cards; expose real on-chain
output.

## Target length: 2:45. Structure: hook -> proof -> rejection -> trust -> close.

### [0:00-0:20] Hook — the real problem
Spoken: "Stablecoin and RWA issuers on Stellar have to convince holders their
reserves cover their liabilities. Today that's a trust-me PDF, or they leak
every account balance. Stellaris proves solvency on-chain — revealing nothing."

Screen: title card `ATTESTOR — ZK Proof-of-Reserves on Stellar`.

### [0:20-0:50] The setup (what's private vs public)
Spoken: "The issuer enters their reserve balances and their liabilities. The
balances are private — they never leave the browser. Watch."
Screen: issuer UI; type a few balances + liabilities + period. Point at the
"secrets stay local" message.

### [0:50-1:30] Generate proof + on-chain solvent attestation (THE core)
Spoken: "A Groth16 proof is generated client-side proving sum-of-reserves is at
least liabilities — without revealing any balance. It's verified inside a Soroban
smart contract using Stellar's BLS12-381 pairing host functions. Here's the on-chain result."
Screen: proving spinner -> commitment C shown -> submit -> AttestationCard reads
BACK from chain: `Solvent as of ledger N`. Show the testnet explorer link.

### [1:30-2:00] The differentiator — reject an insolvent state
Spoken: "Now the important part. If reserves DON'T cover liabilities, the proof
still generates — but the contract refuses to attest." 
Screen: lower a balance; submit; contract returns `NotSolvent`; red card. This is
the 15 seconds that proves the ZK is real and load-bearing.

### [2:00-2:20] Anti-replay
Spoken: "Each reporting period is single-use — an issuer can't replay an old
solvent proof for a new period." Screen: re-submit same period -> 
`PeriodAlreadyAttested`.

### [2:20-2:45] Honest close
Spoken: "The proof binds the math and non-negativity, not the truth of the raw
balances — production needs a custodian oracle, and this is an unaudited
prototype. But the ZK is the product: delete it and you're back to trust-me.
Code and README are open-source. Thanks."
Screen: repo URL + architecture ASCII diagram.

## Fallback path (if testnet is down at record time)
- Flip `DemoToggle` to mock client; narrate "using the deterministic mock client
  for reliability; the live testnet path is in scripts/e2e.sh and the README."
- Show `snarkjs groth16 verify` returning OK locally to prove the proof is valid
  independent of the chain.

## Recording checklist
- [ ] Pre-fund testnet issuer account (friendbot) before recording.
- [ ] Pre-deploy contract; have contract id + explorer tab open.
- [ ] Pre-warm the prover (first proof is slow due to wasm load).
- [ ] One full dry-run; then record.
- [ ] Keep under 3:00 hard cap.
