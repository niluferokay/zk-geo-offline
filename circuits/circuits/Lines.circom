pragma circom 2.2.2;

include "comparators.circom";
include "sign.circom";
include "Utility.circom";

/*
Implements algorithms for working with geometric lines.
Designed to work over a subset of points of the field ≤ sqrt(p) that doesn't wrap around.
We assume that the caller implements its own range checks.
*/

/*
Returns 1 if two line segments intersect, 0 otherwise.
*/
template Intersects(grid_bits) {
    input signal line1[2][2];
    input signal line2[2][2];
    output signal out;

    /*
    Make sure neither of the lines are degenerate single points
    */
    component eq[4];
    for (var i = 0; i < 2; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== line1[0][i];
        eq[i].in[1] <== line1[1][i];

        eq[i+2] = IsEqual();
        eq[i+2].in[0] <== line2[0][i];
        eq[i+2].in[1] <== line2[1][i];
    }
    // Ensure product constraints: if both coordinates equal then product = 1 → degenerate → disallowed
    eq[0].out * eq[1].out === 0;
    eq[2].out * eq[3].out === 0;

    /*
    Setup orientation circuits:
        Orientation[0] takes inputs line1 and line2[0]
        Orientation[1] takes inputs line1 and line2[1]
        Orientation[2] takes inputs line2 and line1[0]
        Orientation[3] takes inputs line2 and line1[1]
    Similarly for InRect circuits
    */
    component orientation[4];
    component inRect[4];
    for (var i = 0; i < 2; i++) {
        // Orientation wrt line1
        orientation[i] = Orientation(grid_bits);
        orientation[i].points[0][0] <== line1[0][0];
        orientation[i].points[0][1] <== line1[0][1];
        orientation[i].points[1][0] <== line1[1][0];
        orientation[i].points[1][1] <== line1[1][1];
        orientation[i].points[2][0] <== line2[i][0];
        orientation[i].points[2][1] <== line2[i][1];

        inRect[i] = InRect(grid_bits);
        inRect[i].line[0][0] <== line1[0][0];
        inRect[i].line[0][1] <== line1[0][1];
        inRect[i].line[1][0] <== line1[1][0];
        inRect[i].line[1][1] <== line1[1][1];
        inRect[i].point[0]   <== line2[i][0];
        inRect[i].point[1]   <== line2[i][1];

        // Orientation wrt line2
        orientation[i+2] = Orientation(grid_bits);
        orientation[i+2].points[0][0] <== line2[0][0];
        orientation[i+2].points[0][1] <== line2[0][1];
        orientation[i+2].points[1][0] <== line2[1][0];
        orientation[i+2].points[1][1] <== line2[1][1];
        orientation[i+2].points[2][0] <== line1[i][0];
        orientation[i+2].points[2][1] <== line1[i][1];

        inRect[i+2] = InRect(grid_bits);
        inRect[i+2].line[0][0] <== line2[0][0];
        inRect[i+2].line[0][1] <== line2[0][1];
        inRect[i+2].line[1][0] <== line2[1][0];
        inRect[i+2].line[1][1] <== line2[1][1];
        inRect[i+2].point[0]   <== line1[i][0];
        inRect[i+2].point[1]   <== line1[i][1];
    }

    // If both points of each line segment are on different sides (i.e., have different orientations wrt) the other line
    signal general_intersection <== (orientation[0].out - orientation[1].out) * (orientation[2].out - orientation[3].out);

    // Handle special case: if a point is collinear with the other line, and it lies on that line segment
    signal not_special_case[4];
    for (var i = 0; i < 4; i++) {
        not_special_case[i] <== orientation[i].out + 1 - inRect[i].out; // 0 if collinear & within range
    }
    signal sc1 <== not_special_case[0] * not_special_case[1];
    signal sc2 <== not_special_case[2] * not_special_case[3];
    signal no_special_case <== sc1 * sc2;

    component not_general_intersection = IsZero();
    not_general_intersection.in <== general_intersection;
    signal not_out <== not_general_intersection.out * no_special_case;

    component negate = IsZero();
    negate.in <== not_out;
    out <== negate.out;
}

/*
Returns 1 if the 3 points are arranged in a clockwise order,
0 if they are in a line, and 2 if they are in a counter-clockwise order.
*/
template Orientation(grid_bits) {
    input signal points[3][2];
    output signal out;

    assert(grid_bits <= 126);

    signal part <== (points[1][1] - points[0][1]) * (points[2][0] - points[1][0]);
    signal f    <== part - (points[2][1] - points[1][1]) * (points[1][0] - points[0][0]);

    component num2Bits = Num2Bits(254);
    num2Bits.in <== f;

    component isNegative = Sign();
    for (var i = 0; i < 254; i++) {
        isNegative.in[i] <== num2Bits.out[i];
    }

    component isZero = IsZero();
    isZero.in <== f;
    signal nonZero <== 1 - isZero.out;

    // nonZero | isNegative.sign+1 logic
    out <== nonZero * (isNegative.sign + 1);

    // ensure out is in {0,1,2}
    signal x <== out * (out - 1);
    x * (out - 2) === 0;
}

/*
Returns 1 if the point lies in a rectangle specified by its two corners, 0 otherwise
*/
template InRect(grid_bits) {
    input signal line[2][2];
    input signal point[2];
    output signal out;

    component ordered_x = Order(grid_bits);
    ordered_x.in[0] <== line[0][0];
    ordered_x.in[1] <== line[1][0];

    component ordered_y = Order(grid_bits);
    ordered_y.in[0] <== line[0][1];
    ordered_y.in[1] <== line[1][1];

    component aboveMinX = LessEqThan(grid_bits);
    aboveMinX.in[0] <== ordered_x.out[0];
    aboveMinX.in[1] <== point[0];

    component belowMaxX = LessEqThan(grid_bits);
    belowMaxX.in[0] <== point[0];
    belowMaxX.in[1] <== ordered_x.out[1];

    signal on_x_projection <== aboveMinX.out * belowMaxX.out;

    component aboveMinY = LessEqThan(grid_bits);
    aboveMinY.in[0] <== ordered_y.out[0];
    aboveMinY.in[1] <== point[1];

    component belowMaxY = LessEqThan(grid_bits);
    belowMaxY.in[0] <== point[1];
    belowMaxY.in[1] <== ordered_y.out[1];

    signal on_y_projection <== aboveMinY.out * belowMaxY.out;

    out <== on_x_projection * on_y_projection;

    out * (out - 1) === 0;
}

/*
Returns 1 if a point is on a line segment, 0 otherwise
A point is on a line segment if it is collinear (i.e., orientation 0) and within the segment’s bounding rectangle
*/
template OnSegment(grid_bits) {
    input signal line[2][2];
    input signal point[2];
    output signal out;

    component inRectC = InRect(grid_bits);
    inRectC.line[0][0] <== line[0][0];
    inRectC.line[0][1] <== line[0][1];
    inRectC.line[1][0] <== line[1][0];
    inRectC.line[1][1] <== line[1][1];
    inRectC.point[0]   <== point[0];
    inRectC.point[1]   <== point[1];

    component orientationC = Orientation(grid_bits);
    orientationC.points[0][0] <== line[0][0];
    orientationC.points[0][1] <== line[0][1];
    orientationC.points[1][0] <== line[1][0];
    orientationC.points[1][1] <== line[1][1];
    orientationC.points[2][0] <== point[0];
    orientationC.points[2][1] <== point[1];

    component collinear = IsZero();
    collinear.in <== orientationC.out;

    out <== collinear.out * inRectC.out;
}
