pragma circom 2.0.0;

// por_v2.circom — Milestone B solvency-with-proven-liabilities.
//
// The v1 statement compared sum(reserves) against a TRUSTED scalar liabilities_in.
// v2 replaces that scalar with liabTotal, the SNARK-bound total of a Merkle-sum
// (Maxwell) tree of per-user liabilities. The comparison now consumes a value
// PROVEN to be the exact sum of per-user balances — not an issuer assertion.
//
// Public signals (NEW v2 ABI — regenerate PUBLIC_SIGNALS.md, invariant #2):
//   [ solvent, reserveCommitment, liabRoot, liabTotal, period ]
//   [    0    ,         1         ,    2    ,     3    ,    4   ]
//
// Parameters:
//   nReserves  = number of reserve accounts (v1 used 16)
//   resBits    = bits per reserve balance (64)
//   depth      = Merkle-sum tree depth (v1 target 8 -> 256 users)
//
// Crux (line ~70): liabTotal <== liab.total; gte.in[1] <== liabTotal;
// The same signal that is the tree root sum IS the value compared. There is no
// path to feed an unproven liability number into the comparison.

include "circomlib/circuits/comparators.circom";
include "components/range_check.circom";
include "components/commit.circom";
include "components/merkle_sum_root.circom";

template ProofOfReservesV2(nReserves, resBits, depth) {
    // --- Reserve side (private) ---
    signal input reserve[nReserves];   // reserve balances (secret)
    signal input reserveSalt;          // commitment blinding factor

    // --- Liability side (private): the full Merkle-sum tree leaves ---
    signal input userId[1 << depth];
    signal input balance[1 << depth];
    signal input liabSalt[1 << depth];

    // --- Period binding (anti-replay, public passthrough) ---
    signal input period_in;

    // --- Public outputs (declaration order = snarkjs public.json order) ---
    signal output solvent;             // 1 if sum(reserves) >= liabTotal
    signal output reserveCommitment;   // Poseidon commitment to reserve vector
    signal output liabRoot;            // Merkle-sum root hash (proven)
    signal output liabTotal;           // total liabilities (proven, NOT trusted)
    signal output period;              // reporting period id

    period <== period_in;

    // --- 1. Reserve commitment (reuse v1 ReserveCommit) ---
    component rc = ReserveCommit(nReserves);
    for (var i = 0; i < nReserves; i++) {
        rc.r[i] <== reserve[i];
    }
    rc.salt <== reserveSalt;
    reserveCommitment <== rc.C;

    // --- 2. Reserve sum (range-checked) ---
    component resRange[nReserves];
    var acc = 0;
    for (var i = 0; i < nReserves; i++) {
        resRange[i] = RangeCheck(resBits);
        resRange[i].in <== reserve[i];
        acc += reserve[i];
    }
    signal reserveSum;
    reserveSum <== acc;

    // --- 3. Liability Merkle-sum root (PROVEN total) ---
    component liab = MerkleSumRoot(depth, resBits);
    for (var i = 0; i < (1 << depth); i++) {
        liab.userId[i]  <== userId[i];
        liab.balance[i] <== balance[i];
        liab.salt[i]    <== liabSalt[i];
    }
    liabRoot  <== liab.rootHash;
    liabTotal <== liab.total;   // <-- the crux: total is a constrained output

    // --- 4. Solvency comparison: reserveSum >= liabTotal ---
    // reserveSum width <= resBits + ceil(log2(nReserves)); liabTotal width <=
    // resBits + depth. Use a comparison budget wide enough for both, +1 headroom.
    var resSumBits = resBits + 5;          // 64 + 5 = 69 covers nReserves<=32
    var liabBits   = resBits + depth;      // 64 + depth
    var cmpBits = resSumBits > liabBits ? resSumBits : liabBits;
    cmpBits = cmpBits + 1;                 // headroom so neither side saturates

    component resSumCheck = RangeCheck(cmpBits);
    resSumCheck.in <== reserveSum;
    component liabCheck = RangeCheck(cmpBits);
    liabCheck.in <== liabTotal;

    component gte = GreaterEqThan(cmpBits);
    gte.in[0] <== reserveSum;
    gte.in[1] <== liabTotal;
    solvent <== gte.out;
}

// v1 target: 16 reserves, 64-bit balances, depth-8 liability tree (256 users).
component main = ProofOfReservesV2(16, 64, 8);
