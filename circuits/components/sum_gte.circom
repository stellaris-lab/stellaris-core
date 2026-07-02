pragma circom 2.0.0;

// SumGte: proves sum(r[i]) >= L and outputs the boolean `solvent`.
//
// Strategy:
//   1. Range-check every r[i] to prevent forged negatives.
//   2. Sum r[i] with explicit intermediate signals.
//   3. Use GreaterEqThan comparator to derive solvent.
//
// Bit-widths:
//   - Each r[i]: 64 bits (from RangeCheck)
//   - Total: at most 64 + ceil(log2(16)) = 68 bits
//   - L: also 64 bits for compatibility

include "circomlib/circuits/comparators.circom";
include "../components/range_check.circom";

template SumGte(n, nBits) {
    // Private: reserve balances
    signal input r[n];

    // Public (via main component passthrough): declared liabilities
    signal input L;

    // Output: 1 if sum >= L, 0 otherwise
    signal output solvent;

    // 1. Range-check every balance
    component rangeChecks[n];
    for (var i = 0; i < n; i++) {
        rangeChecks[i] = RangeCheck(nBits);
        rangeChecks[i].in <== r[i];
    }

    // 2. Compute total = sum(r[i]) with adder chain
    //    Using intermediate signals to keep each step constrained.
    signal total;
    var acc = 0;
    for (var i = 0; i < n; i++) {
        acc += r[i];
    }
    total <== acc;

    // 3. Compare total >= L
    //    Bit-width for comparison: log2(n) extra bits beyond nBits.
    //    n=16 => 4 extra bits, total 68 bits.
    var cmpBits = nBits + 4; // 64 + 4 = 68 for n=16

    // Range-check total to cmpBits to ensure comparison is valid
    component totalCheck = RangeCheck(cmpBits);
    totalCheck.in <== total;

    // Range-check L to cmpBits as well
    component lCheck = RangeCheck(cmpBits);
    lCheck.in <== L;

    // GreaterEqThan: outputs 1 if in[0] >= in[1] (as cmpBits-bit integers)
    component gte = GreaterEqThan(cmpBits);
    gte.in[0] <== total;
    gte.in[1] <== L;
    solvent <== gte.out;
}
