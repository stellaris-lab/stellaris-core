pragma circom 2.0.0;

// PriceCommit: binding commitment to the oracle price vector.
//
// C1 (multi-asset) oracle binding. The circuit proves solvency "given THESE
// prices"; this commitment binds the proof to the exact price vector so an
// auditor (or a future C3 signed price-feed check) can confirm the prices used
// were the published ones. Trust boundary: the circuit does NOT assert the
// prices are "real" — only that the aggregate was computed with the committed
// prices. Closing the are-these-the-real-prices gap is C3 (signed feed).
//
// priceCommitment = Poseidon(price[0..k-1], salt). k <= 15 (Poseidon(<=16)).

include "circomlib/circuits/poseidon.circom";

template PriceCommit(k) {
    signal input price[k];
    signal input salt;

    signal output C;

    component h = Poseidon(k + 1);
    for (var i = 0; i < k; i++) {
        h.inputs[i] <== price[i];
    }
    h.inputs[k] <== salt;

    C <== h.out;
}
