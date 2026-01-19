pragma circom 2.2.2;

include "comparators.circom";
include "compconstant.circom";
include "bitify.circom";

// Multiplies two signals
template Multiplier2() {
    signal input in1;
    signal input in2;
    signal output out;

    out <== in1 * in2;
}

// Multiplies N signals
template MultiplierN(N) {
    signal input in[N];
    signal output out;

    component mults[N-1];

    mults[0] = Multiplier2();
    mults[0].in1 <== in[0];
    mults[0].in2 <== in[1];

    for (var i = 1; i < N - 1; i++) {
        mults[i] = Multiplier2();
        mults[i].in1 <== mults[i - 1].out;
        mults[i].in2 <== in[i + 1];
    }

    out <== mults[N - 2].out;
}

/*
Compares input against a fixed constant ct
Assumes input fits in 254 bits
*/

template Comp(ct) {
    signal input in;
    signal output out;

    component num2bits = Num2Bits(254);
    num2bits.in <== in;

    component cmp = CompConstant(ct);
    for (var i = 0; i < 254; i++) {
        cmp.in[i] <== num2bits.out[i];
    }

    out <== cmp.out;
}

// Orders two values in ascending order
template Order(grid_bits) {
    signal input in[2];
    signal output out[2];

    component gt = GreaterThan(grid_bits);
    gt.in[0] <== in[0];
    gt.in[1] <== in[1];

    out[0] <== (in[1] - in[0]) * gt.out + in[0];
    out[1] <== (in[0] - in[1]) * gt.out + in[1];
}
