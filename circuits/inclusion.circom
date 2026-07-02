pragma circom 2.0.0;

// inclusion.circom — top-level per-user Merkle-sum inclusion proof.
//
// Public signals (declaration order = snarkjs public.json order):
//   [ userId, claimedBalance, rootHash, total ]
//   [   0    ,       1       ,    2     ,   3   ]
//
// A user proves their (userId, claimedBalance) leaf folds up to the published
// (rootHash, total) without revealing any sibling balance.
//
// depth = 8 matches the v1 liabilities tree (256 users); balBits = 64.
// Compile: circom circuits/inclusion.circom -p bls12381 -l <circomlib> --r1cs --wasm --sym -o build/

include "./components/merkle_sum_inclusion.circom";

component main {public [userId, claimedBalance, rootHash, total]} =
    MerkleSumInclusion(8, 64);
