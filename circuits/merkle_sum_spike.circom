pragma circom 2.0.0;

// B-P0 spike: a minimal depth=2 Merkle-sum tree (4 user leaves).
// Purpose: confirm the components compile under -p bls12381 and measure real
// constraint counts via `snarkjs r1cs info`, so the ceremony ptau `k` is sized
// from a measurement, not a guess (see plan §6.1, §7 B-P0).
//
// Public outputs: rootHash, total (both functions of the private leaves).

include "./components/merkle_sum_root.circom";

template MerkleSumSpike() {
    // depth=2 -> 4 leaves; balances 64-bit.
    signal input userId[4];
    signal input balance[4];
    signal input salt[4];

    signal output rootHash;
    signal output total;

    component tree = MerkleSumRoot(2, 64);
    for (var i = 0; i < 4; i++) {
        tree.userId[i]  <== userId[i];
        tree.balance[i] <== balance[i];
        tree.salt[i]    <== salt[i];
    }
    rootHash <== tree.rootHash;
    total    <== tree.total;
}

component main = MerkleSumSpike();
