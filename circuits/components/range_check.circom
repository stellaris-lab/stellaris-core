pragma circom 2.0.0;

// RangeCheck: constrains `in` to be a non-negative integer < 2^nBits.
// Uses Num2Bits from circomlib to decompose and implicitly bound.
// nBits = 64 for balances up to ~1.8e19 (sufficient for demo).
//
// Failure to decompose = unsatisfiable witness = no valid proof.

include "circomlib/circuits/bitify.circom";

template RangeCheck(nBits) {
    signal input in;

    // Num2Bits constrains: in == sum(bits[i] * 2^i) with bits[i] in {0,1}
    // This implicitly bounds in < 2^nBits.
    component n2b = Num2Bits(nBits);
    n2b.in <== in;

    // No output needed; the constraint itself is the guarantee.
}
