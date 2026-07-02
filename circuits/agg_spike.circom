pragma circom 2.0.0;

// B-P1 aggregation spike: a depth-8 Merkle-sum root circuit whose witness is the
// ground-truth source for inclusion testing. Because this is compiled with
// -p bls12381, its Poseidon matches inclusion.circom exactly (same field, same
// constants) -- which circomlibjs (BN254-only) cannot reproduce off-chain.
//
// We read the full witness, extract the root (hash,total) and the sibling path
// for a target leaf, and feed those into inclusion.circom. Same Poseidon by
// construction -- this is the offline-correct way to test inclusion soundness.
//
// The wrapper ALSO exposes leaf hashes as outputs (outputs survive circom's
// signal elimination, unlike the internal curHash[] level-0 buffer entries).
// These leaf-hash outputs equal MerkleSumRoot's internal leaf hashes by
// construction (identical inputs + identical BLS12-381 Poseidon), giving the
// extractor the level-0 sibling hash it needs.

include "circomlib/circuits/poseidon.circom";
include "components/merkle_sum_root.circom";

template AggSpike(depth, balBits) {
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

component main = AggSpike(8, 64);
