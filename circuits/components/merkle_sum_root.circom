pragma circom 2.0.0;

// MerkleSumRoot: fold 2^depth leaves into a single (rootHash, total).
//
// Each leaf:
//   leaf_hash_i = Poseidon(userId_i, balance_i, salt_i)
//   leaf_sum_i  = balance_i        (range-checked to balBits — defends T2)
//
// Then fold level by level with MerkleSumNode, widening the sum budget by one
// bit per level (level-k node uses balBits+k+1). The output (rootHash, total)
// is a constrained computation, not a trusted input: `total` is the value the
// top-level solvency statement compares against.
//
// Leaf ordering is assumed canonical (sorted by userId) and is enforced by the
// SDK tree builder; the circuit consumes leaves in witness order. The TS<->
// circuit root cross-check test is the gate that the two agree.

include "circomlib/circuits/poseidon.circom";
include "./range_check.circom";
include "./merkle_sum_node.circom";

template MerkleSumRoot(depth, balBits) {
    var N = 1 << depth;           // number of leaves (2^depth)

    signal input userId[N];
    signal input balance[N];
    signal input salt[N];

    signal output rootHash;
    signal output total;

    // --- Leaf layer: range-check balances + hash leaves -------------------
    component leafRange[N];
    component leafHash[N];
    // Flattened node storage across all levels.
    // Level 0 has N nodes, level 1 has N/2, ... level `depth` has 1.
    // Total nodes = 2N - 1. We index per level with separate arrays.

    // Level 0 (leaves)
    signal levelHash0[N];
    signal levelSum0[N];
    for (var i = 0; i < N; i++) {
        leafRange[i] = RangeCheck(balBits);     // T2: balance in [0, 2^balBits)
        leafRange[i].in <== balance[i];

        leafHash[i] = Poseidon(3);
        leafHash[i].inputs[0] <== userId[i];
        leafHash[i].inputs[1] <== balance[i];
        leafHash[i].inputs[2] <== salt[i];

        levelHash0[i] <== leafHash[i].out;
        levelSum0[i]  <== balance[i];
    }

    // --- Fold layers -------------------------------------------------------
    // We materialize each level's (hash,sum) into fresh signal arrays and chain
    // MerkleSumNode instances. circom requires statically-sized declarations, so
    // we unroll with a per-level component array sized to the largest level.
    //
    // nodes[level] count = N >> level. We use a single flat component pool.
    component node[N];            // at most N-1 internal nodes; N is a safe cap
    var nodeIdx = 0;

    // Running "previous level" buffers. Since circom can't resize signal arrays
    // at runtime, we declare max-width buffers and only use the live prefix.
    signal curHash[2 * N];
    signal curSum[2 * N];
    // seed level 0 into the buffer
    for (var i = 0; i < N; i++) {
        curHash[i] <== levelHash0[i];
        curSum[i]  <== levelSum0[i];
    }

    // base offset of the current level inside the flat buffer
    var levelBase = 0;
    var levelCount = N;
    var nextBase = N;
    for (var lvl = 0; lvl < depth; lvl++) {
        var half = levelCount >> 1;
        for (var j = 0; j < half; j++) {
            node[nodeIdx] = MerkleSumNode(balBits + lvl + 1);
            node[nodeIdx].hashL <== curHash[levelBase + 2 * j];
            node[nodeIdx].sumL  <== curSum[levelBase + 2 * j];
            node[nodeIdx].hashR <== curHash[levelBase + 2 * j + 1];
            node[nodeIdx].sumR  <== curSum[levelBase + 2 * j + 1];

            curHash[nextBase + j] <== node[nodeIdx].hash;
            curSum[nextBase + j]  <== node[nodeIdx].sum;
            nodeIdx++;
        }
        levelBase = nextBase;
        nextBase = nextBase + half;
        levelCount = half;
    }

    rootHash <== curHash[levelBase];
    total    <== curSum[levelBase];
}
