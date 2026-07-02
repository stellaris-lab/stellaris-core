pragma circom 2.0.0;

// MerkleSumInclusion: prove one leaf is included in a published Merkle-sum root
// (rootHash, total) WITHOUT revealing any sibling balance.
//
// This is the per-user, user-facing proof — separate from the issuer's
// aggregation proof (merkle_sum_root.circom). A user proves:
//   "my (userId, claimedBalance) is a leaf whose path folds up to the published
//    (rootHash, total)"
// while the sibling hashes/sums along the path stay private.
//
// Defends:
//   - T4 (inclusion forgery/omission): the recomputed path must equal rootHash.
//   - T2 (negative balance at the leaf): claimedBalance range-checked to balBits.
//
// Node rule MUST match merkle_sum_node.circom exactly:
//   node_sum  = sumL + sumR        (range-checked to the level's sum width)
//   node_hash = Poseidon(hashL, sumL, hashR, sumR)
//
// Path encoding (bottom-up, one entry per level):
//   sibHash[k], sibSum[k] = the sibling node at level k
//   pathDir[k]            = 0 if current node is the LEFT child at level k,
//                           1 if current node is the RIGHT child.
//
// Sum width at level k (leaves at level 0) is (balBits + k + 1), identical to the
// aggregation circuit, so a proof that verifies here is consistent with a root
// produced there.

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/switcher.circom";
include "../components/range_check.circom";

template MerkleSumInclusion(depth, balBits) {
    // --- Public inputs (the user's claim + the published root) ---
    signal input userId;          // the user's identifier (field element)
    signal input claimedBalance;  // the balance the user claims is included
    signal input rootHash;        // published Merkle-sum root hash
    signal input total;           // published total liabilities (root sum)

    // --- Private witness (the inclusion path) ---
    signal input salt;            // leaf blinding salt
    signal input sibHash[depth];  // sibling hash at each level
    signal input sibSum[depth];   // sibling sum at each level
    signal input pathDir[depth];  // 0 = current is left child, 1 = right child

    // 1. Leaf: range-check the claimed balance (T2) and hash the leaf.
    //    leafHash = Poseidon(userId, claimedBalance, salt); leafSum = balance.
    component balCheck = RangeCheck(balBits);
    balCheck.in <== claimedBalance;

    component leaf = Poseidon(3);
    leaf.inputs[0] <== userId;
    leaf.inputs[1] <== claimedBalance;
    leaf.inputs[2] <== salt;

    // curHash/curSum track the node we have folded up to so far.
    signal curHash[depth + 1];
    signal curSum[depth + 1];
    curHash[0] <== leaf.out;
    curSum[0] <== claimedBalance;

    // Per-level components (declared at template scope, indexed in the loop).
    component dirBit[depth];       // boolean-constrain pathDir
    component swH[depth];          // route (cur, sibling) hashes by direction
    component swS[depth];          // route (cur, sibling) sums by direction
    component node[depth];         // Poseidon(4) parent hash
    component sumCheck[depth];     // range-check the parent sum

    for (var k = 0; k < depth; k++) {
        // pathDir[k] MUST be boolean, else a malicious witness mis-routes the path.
        dirBit[k] = Num2Bits(1);
        dirBit[k].in <== pathDir[k];

        // Route hashes: if dir==0 current is LEFT (L=cur, R=sib);
        // if dir==1 current is RIGHT (L=sib, R=cur). Switcher swaps on sel==1.
        swH[k] = Switcher();
        swH[k].sel <== pathDir[k];
        swH[k].L <== curHash[k];
        swH[k].R <== sibHash[k];

        swS[k] = Switcher();
        swS[k].sel <== pathDir[k];
        swS[k].L <== curSum[k];
        swS[k].R <== sibSum[k];

        // Parent sum = L + R, range-checked to this level's widened budget (T3).
        sumCheck[k] = RangeCheck(balBits + k + 1);
        sumCheck[k].in <== swS[k].outL + swS[k].outR;

        // Parent hash = Poseidon(hashL, sumL, hashR, sumR) — matches node rule.
        node[k] = Poseidon(4);
        node[k].inputs[0] <== swH[k].outL;
        node[k].inputs[1] <== swS[k].outL;
        node[k].inputs[2] <== swH[k].outR;
        node[k].inputs[3] <== swS[k].outR;

        curHash[k + 1] <== node[k].out;
        curSum[k + 1] <== swS[k].outL + swS[k].outR;
    }

    // 2. The folded path MUST equal the published root (hash AND sum). (T4)
    rootHash === curHash[depth];
    total === curSum[depth];
}
