pragma circom 2.0.0;

// ReserveCommit: computes a binding commitment to the reserve vector.
//
// Uses Poseidon hash over [r[0], ..., r[n-1], salt] to produce a single
// field element C. The salt prevents brute-forcing balances from a known
// commitment.
//
// Poseidon is used because it is ZK-friendly (few constraints) and
// circomlib provides a standard implementation.
//
// IMPORTANT: This commitment binds the proof to a specific reserve vector.
// The contract stores C to prevent reuse of a proof with different balances.

include "circomlib/circuits/poseidon.circom";

template ReserveCommit(n) {
    // Private: reserve balances + salt
    signal input r[n];
    signal input salt;

    // Public output: Poseidon commitment
    signal output C;

    // circomlib's Poseidon accepts at most 16 inputs (N_ROUNDS_P is indexed by
    // t-2 with t = nInputs+1, so nInputs <= 16). For n=16 balances + salt = 17
    // values we exceed that, so use a sound two-level construction:
    //   inner = Poseidon(r[0..n-1])         // n <= 16 balances
    //   C     = Poseidon(inner, salt)       // bind the blinding salt
    // This remains a binding commitment over the full (r, salt) tuple.
    component inner = Poseidon(n);
    for (var i = 0; i < n; i++) {
        inner.inputs[i] <== r[i];
    }

    component outer = Poseidon(2);
    outer.inputs[0] <== inner.out;
    outer.inputs[1] <== salt;

    C <== outer.out;
}
