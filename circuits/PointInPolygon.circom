pragma circom 2.2.2;

include "Utility.circom";
include "Lines.circom";

/*
Returns 1 if a given point is in an n-sided polygon, 0 otherwise.
Implements ray tracing algorithm for simple polygons on a discrete 2^grid_bits length plane.
Note: Polygon simplicity must be verified separately.
*/

template RayTracing(n, grid_bits) {
    signal input point[2];
    signal input polygon[n][2];
    signal output out;

    // Ensure all polygon vertices are in range [0, 2^grid_bits)
    component x_comp[n];
    component y_comp[n];
    component x_zero[n];

    for (var i = 0; i < n; i++) {
        x_comp[i] = Comp(2 ** grid_bits - 1);
        x_comp[i].in <== polygon[i][0];
        x_comp[i].out === 0;

        x_zero[i] = IsZero();
        x_zero[i].in <== polygon[i][0];
        x_zero[i].out === 0;

        y_comp[i] = Comp(2 ** grid_bits - 1);
        y_comp[i].in <== polygon[i][1];
        y_comp[i].out === 0;
    }

    // Ensure the point is in range (0, 2^grid_bits)
    component comp[2];
    for (var i = 0; i < 2; i++) {
        comp[i] = Comp(2 ** grid_bits - 1);
        comp[i].in <== point[i];
        comp[i].out === 0;
    }

    // Exclude points sharing a y-coordinate with a polygon vertex
    component mult = MultiplierN(n);
    for (var i = 0; i < n; i++) {
        mult.in[i] <== polygon[i][1] - point[1];
    }

    component isZero = IsZero();
    isZero.in <== mult.out;
    signal not_on_vertex_line <== 1 - isZero.out;

    // Count the number of intersections
    component intersections[n];
    var intersection_sum = 0; // <-- fixed: var, not signal

    for (var i = 0; i < n; i++) {
        intersections[i] = Intersects(grid_bits);

        // line1: ray from (0, y) to (x, y)
        intersections[i].line1[0][0] <== 0;
        intersections[i].line1[0][1] <== point[1];
        intersections[i].line1[1][0] <== point[0];
        intersections[i].line1[1][1] <== point[1];

        // line2: polygon edge from vertex i to i+1 (with wraparound)
        intersections[i].line2[0][0] <== polygon[i][0];
        intersections[i].line2[0][1] <== polygon[i][1];
        intersections[i].line2[1][0] <== polygon[(i + 1) % n][0];
        intersections[i].line2[1][1] <== polygon[(i + 1) % n][1];

        // Ensure output is binary
        intersections[i].out * (intersections[i].out - 1) === 0;

        intersection_sum += intersections[i].out;
    }

    signal intersection_count;
    intersection_count <== intersection_sum;

    // n+1 bits sufficient for holding up to n
    component num2Bits = Num2Bits(n + 1);
    num2Bits.in <== intersection_count;

    signal odd_intersections <== num2Bits.out[0];
    out <== odd_intersections * not_on_vertex_line;
}

/*
Returns 1 if a polygon is simple (non-degenerate, non-self-intersecting), 0 otherwise.
Brute-force algorithm.
*/

template SimplePolygon(n, grid_bits) {
    signal input polygon[n][2];
    signal output out;

    var c = (n - 2) * (n - 1) / 2 - 1; // Number of intersections to check

    component intersects[c];
    component hasNoIntersection = MultiplierN(c);
    signal notIntersects[c];
    var index = 0;

    for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
            if (
                j != i &&
                (j + 1) % n != i &&
                (i + 1) % n != j &&
                i < j
            ) {
                intersects[index] = Intersects(grid_bits);

                intersects[index].line1[0][0] <== polygon[i][0];
                intersects[index].line1[0][1] <== polygon[i][1];
                intersects[index].line1[1][0] <== polygon[(i + 1) % n][0];
                intersects[index].line1[1][1] <== polygon[(i + 1) % n][1];

                intersects[index].line2[0][0] <== polygon[j][0];
                intersects[index].line2[0][1] <== polygon[j][1];
                intersects[index].line2[1][0] <== polygon[(j + 1) % n][0];
                intersects[index].line2[1][1] <== polygon[(j + 1) % n][1];

                notIntersects[index] <== 1 - intersects[index].out;
                hasNoIntersection.in[index] <== notIntersects[index];
                index++;
            }
        }
    }

    // Ensure no vertex lies on a non-adjacent segment
    component onSegment[n * 2];
    signal notOnSegment[n * 2];
    component notOnAnySegment = MultiplierN(n * 2);

    for (var i = 0; i < n; i++) {
        onSegment[2 * i] = OnSegment(grid_bits);
        onSegment[2 * i].line[0][0] <== polygon[i][0];
        onSegment[2 * i].line[0][1] <== polygon[i][1];
        onSegment[2 * i].line[1][0] <== polygon[(i + 1) % n][0];
        onSegment[2 * i].line[1][1] <== polygon[(i + 1) % n][1];
        onSegment[2 * i].point[0] <== polygon[(i + 2) % n][0];
        onSegment[2 * i].point[1] <== polygon[(i + 2) % n][1];
        notOnSegment[2 * i] <== 1 - onSegment[2 * i].out;
        notOnAnySegment.in[2 * i] <== notOnSegment[2 * i];

        onSegment[2 * i + 1] = OnSegment(grid_bits);
        onSegment[2 * i + 1].line[0][0] <== polygon[(i + 1) % n][0];
        onSegment[2 * i + 1].line[0][1] <== polygon[(i + 1) % n][1];
        onSegment[2 * i + 1].line[1][0] <== polygon[(i + 2) % n][0];
        onSegment[2 * i + 1].line[1][1] <== polygon[(i + 2) % n][1];
        onSegment[2 * i + 1].point[0] <== polygon[i][0];
        onSegment[2 * i + 1].point[1] <== polygon[i][1];
        notOnSegment[2 * i + 1] <== 1 - onSegment[2 * i + 1].out;
        notOnAnySegment.in[2 * i + 1] <== notOnSegment[2 * i + 1];
    }

    out <== notOnAnySegment.out * hasNoIntersection.out;
}
