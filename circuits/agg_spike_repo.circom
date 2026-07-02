pragma circom 2.0.0;

// Depth-4 aggregation spike (repo-scale twin of agg_spike.circom).
//
// Same role as agg_spike.circom but at the in-repo ceremony depth (depth=4, 16
// leaves) so it pairs with inclusion_repo.circom (MerkleSumInclusion(4,64)) and
// the depth-4 ceremony artifacts in build/v2/. Compiled with -p bls12381, its
// Poseidon is the BLS12-381 in-circuit hash — the ground-truth source for the
// inclusion witness (circomlibjs is BN254-only and cannot reproduce it).
//
// Exposes leafHashOut[] so level-0 sibling hashes survive circom's signal
// elimination, exactly like the depth-8 agg_spike.

include "circomlib/circuits/poseidon.circom";
include "components/merkle_sum_root.circom";

template AggSpikeRepo(depth, balBits) {
    var N = 1 << depth;
    signal input userId[N];
    signal input balance[N];
    signal input salt[N];
    signal output rootHash;
    signal output total;
    signal output leafHashOut[N];   // exposed so level-0 sibling hashes survive

    component root = MerkleSumRoot(depth, balBits);
    component lh[N];
    for (var i = 0; i < N; i++) {
        root.userId[i]  <== userId[i];
        root.balance[i] <== balance[i];
        root.salt[i]    <== salt[i];

        lh[i] = Poseidon(3);
        lh[i].inputs[0] <== userId[i];
        lh[i].inputs[1] <== balance[i];
        lh[i].inputs[2] <== salt[i];
        leafHashOut[i] <== lh[i].out;
    }
    rootHash <== root.rootHash;
    total    <== root.total;
}

component main = AggSpikeRepo(4, 64);
