pragma circom 2.0.0;

// por_v3.circom — Milestone C1: multi-asset solvency with oracle-priced aggregate.
//
// v1/v2 proved solvency over a SINGLE aggregate reserve bucket. v3 generalizes
// to per-asset reserve buckets and proves BOTH:
//   (a) per-asset solvency: for each asset, sum(reserve[asset]) >= liab[asset]
//   (b) aggregate priced solvency: sum_a price[a]*reserveSum[a] >=
//                                  sum_a price[a]*liab[a]
// i.e. "solvent in a common unit at THESE prices".
//
// Public signals (declaration order = snarkjs public.json order):
//   [ aggregateSolvent, reserveCommitment, priceCommitment,
//     assetSolvent[0], assetSolvent[1], assetSolvent[2], assetSolvent[3],
//     period ]
//   [        0        ,        1        ,        2       ,
//        3       ,       4       ,       5       ,       6       ,
//      7    ]
//
// TRUST BOUNDARY (honest scope): the circuit proves the aggregate was computed
// with the COMMITTED price vector (priceCommitment binds it). It does NOT assert
// the prices are the "real" market prices — closing that gap is Milestone C3
// (a signed price-feed verified inside the circuit). priceCommitment is the seam
// C3 plugs into.
//
// PRIVACY: per-asset liabilities and reserve/price magnitudes stay PRIVATE; only
// the solvency flags + binding commitments + period are public. The flags ARE
// the attestation; an auditor with the commitment openings can re-derive them.
//
// Parameters:
//   nAssets   = number of assets (4)
//   nPerAsset = reserve accounts per asset (4); nAssets*nPerAsset <= 16 so the
//               flattened reserve vector fits ReserveCommit's Poseidon(<=16).
//   balBits   = bits per reserve balance / per-asset liability (64)
//   priceBits = bits per oracle price in common unit (32, fixed-point)

include "circomlib/circuits/comparators.circom";
include "components/range_check.circom";
include "components/commit.circom";
include "components/price_commit.circom";

template ProofOfReservesMultiAsset(nAssets, nPerAsset, balBits, priceBits) {
    // --- Private inputs ---
    signal input reserve[nAssets][nPerAsset]; // per-asset reserve balances
    signal input reserveSalt;                 // reserve-commitment blinding
    signal input price[nAssets];              // oracle price per asset (common unit)
    signal input priceSalt;                   // price-commitment blinding
    signal input liabilities[nAssets];        // per-asset declared liabilities
    signal input period_in;                   // reporting period (anti-replay)

    // --- Public outputs (declaration order = public.json order) ---
    signal output aggregateSolvent;           // 1 if priced reserves >= priced liabs
    signal output reserveCommitment;          // Poseidon commit to reserve matrix
    signal output priceCommitment;            // Poseidon commit to price vector
    signal output assetSolvent[nAssets];      // per-asset solvency flags
    signal output period;

    period <== period_in;

    var N = nAssets * nPerAsset; // total reserve cells (<= 16)

    // --- 1. Reserve commitment over the flattened reserve matrix ---
    component rc = ReserveCommit(N);
    var idx = 0;
    for (var a = 0; a < nAssets; a++) {
        for (var i = 0; i < nPerAsset; i++) {
            rc.r[idx] <== reserve[a][i];
            idx++;
        }
    }
    rc.salt <== reserveSalt;
    reserveCommitment <== rc.C;

    // --- 2. Price commitment over the price vector ---
    component pc = PriceCommit(nAssets);
    for (var a = 0; a < nAssets; a++) {
        pc.price[a] <== price[a];
    }
    pc.salt <== priceSalt;
    priceCommitment <== pc.C;

    // --- 3. Per-asset: range-check balances + liab, sum, per-asset solvency ---
    component resRange[nAssets][nPerAsset];
    signal assetReserveSum[nAssets];
    component liabRange[nAssets];
    component assetGte[nAssets];
    // per-asset comparison budget: balBits + ceil(log2(nPerAsset)) + headroom.
    var assetCmpBits = balBits + 5;

    for (var a = 0; a < nAssets; a++) {
        var accA = 0;
        for (var i = 0; i < nPerAsset; i++) {
            resRange[a][i] = RangeCheck(balBits);  // T: no negative/oversized balance
            resRange[a][i].in <== reserve[a][i];
            accA += reserve[a][i];
        }
        assetReserveSum[a] <== accA;

        liabRange[a] = RangeCheck(balBits);        // liabilities also bounded
        liabRange[a].in <== liabilities[a];

        assetGte[a] = GreaterEqThan(assetCmpBits);
        assetGte[a].in[0] <== assetReserveSum[a];
        assetGte[a].in[1] <== liabilities[a];
        assetSolvent[a] <== assetGte[a].out;
    }

    // --- 4. Price range checks (bound each price to priceBits) ---
    component priceRange[nAssets];
    for (var a = 0; a < nAssets; a++) {
        priceRange[a] = RangeCheck(priceBits);
        priceRange[a].in <== price[a];
    }

    // --- 5. Priced aggregate solvency ---
    // SOUNDNESS (in-series price binding, NOT decorative): the SAME `price[a]`
    // signal feeds both the commitment (section 2, pc.price[a] <== price[a]) and
    // the valuation below. A circom signal is one immutable wire, so the price
    // committed in `priceCommitment` IS the price that drives solvency — there is
    // no witness in which the committed price differs from the valuation price.
    // This closes the "commitment computed in parallel to, not in series with, the
    // comparison" trap.
    // pricedReserve[a] = price[a] * assetReserveSum[a]  (quadratic: signal*signal)
    // pricedLiab[a]    = price[a] * liabilities[a]
    signal pricedReserve[nAssets];
    signal pricedLiab[nAssets];
    var accPR = 0;
    var accPL = 0;
    for (var a = 0; a < nAssets; a++) {
        pricedReserve[a] <== price[a] * assetReserveSum[a];
        pricedLiab[a] <== price[a] * liabilities[a];
        accPR += pricedReserve[a];
        accPL += pricedLiab[a];
    }
    signal totalPricedReserve;
    signal totalPricedLiab;
    totalPricedReserve <== accPR;
    totalPricedLiab <== accPL;

    // Aggregate comparison budget: priceBits + balBits + headroom for the
    // per-asset products and the sum over nAssets.
    var aggBits = priceBits + balBits + 5;
    component prCheck = RangeCheck(aggBits);
    prCheck.in <== totalPricedReserve;
    component plCheck = RangeCheck(aggBits);
    plCheck.in <== totalPricedLiab;

    component aggGte = GreaterEqThan(aggBits);
    aggGte.in[0] <== totalPricedReserve;
    aggGte.in[1] <== totalPricedLiab;
    aggregateSolvent <== aggGte.out;
}

// Repo-scale main: 4 assets x 4 reserves = 16 cells (fits ReserveCommit's
// Poseidon<=16). 64-bit balances, 32-bit fixed-point prices.
component main = ProofOfReservesMultiAsset(4, 4, 64, 32);
