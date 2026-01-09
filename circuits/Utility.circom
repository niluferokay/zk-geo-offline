pragma circom 2.2.2;

include "comparators.circom";
include "compconstant.circom";
include "bitify.circom";

// ============================================
// MultiplierN: multiply N inputs together
// ============================================
template MultiplierN(N) {
    signal input in[N];
    signal output out;

    component mults[N-1];

    // First multiplication
    mults[0] = Multiplier2();
    mults[0].in1 <== in[0];
    mults[0].in2 <== in[1];

    // Chain remaining multiplications
    for (var i = 1; i < N - 1; i++) {
        mults[i] = Multiplier2();
        mults[i].in1 <== mults[i - 1].out;
        mults[i].in2 <== in[i + 1];
    }

    out <== mults[N - 2].out;
}

// ============================================
// Multiplier2: multiply two numbers
// ============================================
template Multiplier2() {
    signal input in1;
    signal input in2;
    signal output out;

    out <== in1 * in2;
}

// ============================================
// Comp: compare signal with constant (using Num2Bits + CompConstant)
// ============================================
template Comp(ct) {
    signal input in;
    signal output out;

    // Use 254 bits for field decomposition (BN254)
    component num2bits = Num2Bits(254);
    num2bits.in <== in;

    component cmp = CompConstant(ct);
    for (var i = 0; i < 254; i++) {
        cmp.in[i] <== num2bits.out[i];
    }

    out <== cmp.out;
}

// ============================================
// Order: return two values in ascending order
// ============================================
template Order(grid_bits) {
    signal input in[2];
    signal output out[2];

    component gt = GreaterThan(grid_bits);
    gt.in[0] <== in[0];
    gt.in[1] <== in[1];

    // If in[0] > in[1], swap them
    out[0] <== (in[1] - in[0]) * gt.out + in[0];
    out[1] <== (in[0] - in[1]) * gt.out + in[1];
}
