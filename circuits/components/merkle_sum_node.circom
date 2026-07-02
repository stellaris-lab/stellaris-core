pragma circom 2.0.0;

// MerkleSumNode: one internal node of a Merkle-sum (Maxwell) tree.
//
// Given two children (hashL, sumL) and (hashR, sumR), it:
//   1. constrains node_sum = sumL + sumR exactly (defends T1: forged internal
//      sums cannot be published without breaking this linear constraint),
//   2. range-checks node_sum to `sumBits` so no modular wraparound can hide
//      liability (defends T3: sum overflow),
//   3. binds both child sums into the node hash so any tampering with a child's
//      reported sum changes every ancestor hash up to the root.
//
// node_hash = Poseidon(hashL, sumL, hashR, sumR)
//
// `sumBits` MUST grow by 1 per tree level (a level-k node sums at most
// 2^(64+k) over 64-bit leaves). Passing a too-small width silently re-enables
// the overflow attack, so the caller is forced to pass it explicitly.

include "circomlib/circuits/poseidon.circom";
include "./range_check.circom";

template MerkleSumNode(sumBits) {
    signal input hashL;
    signal input sumL;
    signal input hashR;
    signal input sumR;

    signal output hash;
    signal output sum;

    // 1. Exact sum (linear constraint) — T1.
    sum <== sumL + sumR;

    // 2. Range-check the sum to its widened budget — T3 (no wraparound).
    component rc = RangeCheck(sumBits);
    rc.in <== sum;

    // 3. Tamper-evident hash binding both child sums.
    component h = Poseidon(4);
    h.inputs[0] <== hashL;
    h.inputs[1] <== sumL;
    h.inputs[2] <== hashR;
    h.inputs[3] <== sumR;
    hash <== h.out;
}
