pragma circom 2.0.0;

// ProofOfReserves: Top-level ZK circuit for issuer solvency attestation.
//
// Proves (without revealing r[i] or salt):
//   1. Each of the 16 reserve balances is a 64-bit unsigned integer.
//   2. Sum of all reserves >= declared liabilities (solvent = 1).
//   3. C = Poseidon(r[0..15], salt) binds proof to exact reserve vector.
//   4. Period_id is bound into the proof (anti-replay).
//
// All four values (solvent, C, L, period_id) are public outputs of the
// main component, so snarkjs emits them in declaration order.
//
// n = 16 accounts, nBits = 64 per balance.
// Curve: BLS12-381 (compile with --curve bls12381).
//
// For insolvent input (sum < L): the circuit produces a VALID proof
// with solvent=0. The contract rejects attest() when solvent != 1.

include "./components/range_check.circom";
include "./components/sum_gte.circom";
include "./components/commit.circom";

template ProofOfReserves(n, nBits) {
    // --- Private inputs ---
    signal input r[n];          // Reserve balances (secrets)
    signal input salt;          // Commitment blinding factor

    // --- Private passthrough (bound as witnesses) ---
    signal input liabilities_in;
    signal input period_in;

    // --- Public outputs (declaration order = snarkjs public.json order) ---
    signal output solvent;      // 1 if solvent, 0 if insolvent
    signal output commitment;   // Poseidon(r[0..n-1], salt)
    signal output liabilities;  // Declared total liabilities
    signal output period;       // Reporting period identifier

    // Passthrough: bind inputs to outputs
    liabilities <== liabilities_in;
    period <== period_in;

    // 1. Solvency check: sum(r) >= liabilities, output solvent flag
    component sumGte = SumGte(n, nBits);
    for (var i = 0; i < n; i++) {
        sumGte.r[i] <== r[i];
    }
    sumGte.L <== liabilities_in;
    solvent <== sumGte.solvent;

    // 2. Commitment: bind proof to exact reserve vector
    component comm = ReserveCommit(n);
    for (var i = 0; i < n; i++) {
        comm.r[i] <== r[i];
    }
    comm.salt <== salt;
    commitment <== comm.C;
}

// n = 16 accounts, nBits = 64 bits per balance
// No public inputs declared — all four values are outputs (thus public).
component main = ProofOfReserves(16, 64);
