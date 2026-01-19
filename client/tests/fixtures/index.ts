/**
 * Deterministic Test Fixtures for ZK Geofencing
 *
 * These fixtures are IMMUTABLE and define the ground truth for all tests.
 * NEVER modify these fixtures - always create new ones if needed.
 *
 * Each fixture includes:
 * - name: unique identifier
 * - geoDegrees: polygon vertices in [lon, lat] format
 * - insidePoints: points guaranteed to be inside the polygon
 * - outsidePoints: points guaranteed to be outside the polygon
 * - edgePoints: points on or very near polygon edges (boundary cases)
 */

export interface TestFixture {
  name: string;
  description: string;
  geoDegrees: [number, number][];
  insidePoints: [number, number][];
  outsidePoints: [number, number][];
  edgePoints?: [number, number][];
  expectedBehavior?: string;
}

/**
 * Fixture 1: Simple Square (Convex Polygon)
 *
 * A basic 4-vertex square centered at origin.
 * Tests basic point-in-polygon logic.
 */
export const SIMPLE_SQUARE: TestFixture = {
  name: 'simple_square',
  description: 'Basic convex 4-vertex square',
  geoDegrees: [
    [-0.0010, 0.0010],  // Top-left
    [0.0010, 0.0010],   // Top-right
    [0.0010, -0.0010],  // Bottom-right
    [-0.0010, -0.0010]  // Bottom-left
  ],
  insidePoints: [
    [0.0000, 0.0000],    // Center
    [0.0005, 0.0005],    // NE quadrant
    [-0.0005, -0.0005],  // SW quadrant
    [0.0005, -0.0005],   // SE quadrant
    [-0.0005, 0.0005]    // NW quadrant
  ],
  outsidePoints: [
    [0.0020, 0.0020],    // NE outside
    [-0.0020, -0.0020],  // SW outside
    [0.0000, 0.0020],    // N outside
    [0.0000, -0.0020],   // S outside
    [0.0020, 0.0000],    // E outside
    [-0.0020, 0.0000]    // W outside
  ],
  edgePoints: [
    [0.0000, 0.0010],    // Top edge center
    [0.0010, 0.0000],    // Right edge center
    [0.0000, -0.0010],   // Bottom edge center
    [-0.0010, 0.0000]    // Left edge center
  ]
};

/**
 * Fixture 2: L-Shape (Concave Polygon)
 *
 * A concave 6-vertex L-shaped polygon.
 * Critical test: The concave notch area should be OUTSIDE.
 */
export const L_SHAPE: TestFixture = {
  name: 'l_shape',
  description: 'Concave L-shaped polygon with critical notch test',
  geoDegrees: [
    [0.0000, 0.0030],   // Top-left
    [0.0010, 0.0030],   // Top-right inner corner
    [0.0010, 0.0010],   // Inner corner (concave)
    [0.0030, 0.0010],   // Right outer corner
    [0.0030, 0.0000],   // Bottom-right
    [0.0000, 0.0000]    // Bottom-left
  ],
  insidePoints: [
    [0.0005, 0.0025],   // Top rectangle
    [0.0025, 0.0005],   // Bottom rectangle
    [0.0005, 0.0005],   // Near inner corner (inside)
    [0.0002, 0.0015]    // Left side
  ],
  outsidePoints: [
    [0.0025, 0.0025],   // CRITICAL: Concave notch (outside!)
    [0.0020, 0.0020],   // Also in notch
    [0.0040, 0.0020],   // Right outside
    [0.0015, 0.0040]    // Top outside
  ],
  edgePoints: [
    [0.0010, 0.0020],   // Inner corner edge
    [0.0015, 0.0010]    // Bottom horizontal edge
  ]
};

/**
 * Fixture 3: Tiny Polygon (Precision Test)
 *
 * A very small diamond shape to test floating-point precision.
 * Tests the limits of coordinate scaling (×10000).
 */
export const TINY_POLYGON: TestFixture = {
  name: 'tiny_polygon',
  description: 'Very small polygon to test precision limits',
  geoDegrees: [
    [0.0000, 0.0001],   // Top
    [0.0001, 0.0000],   // Right
    [0.0000, -0.0001],  // Bottom
    [-0.0001, 0.0000]   // Left
  ],
  insidePoints: [
    [0.00003, 0.00003],  // Center (offset to be >20m from boundary)
    [0.00004, 0.00002]   // Near center (offset to be >20m from boundary)
  ],
  outsidePoints: [
    [0.0002, 0.0002],    // Far outside
    [0.00015, 0.00015]   // Just outside
  ],
  edgePoints: [
    [0.00007, 0.00003]   // Near edge
  ]
};

/**
 * Fixture 4: Large Polygon (Scaling Test)
 *
 * A large square to test coordinate transformation at scale.
 * Ensures the circuit's uint32 range is sufficient.
 */
export const LARGE_POLYGON: TestFixture = {
  name: 'large_polygon',
  description: 'Large polygon to test coordinate scaling',
  geoDegrees: [
    [-1.0, 1.0],   // Top-left
    [1.0, 1.0],    // Top-right
    [1.0, -1.0],   // Bottom-right
    [-1.0, -1.0]   // Bottom-left
  ],
  insidePoints: [
    [0.0, 0.0],     // Center
    [0.5, 0.5],     // NE
    [-0.5, -0.5]    // SW
  ],
  outsidePoints: [
    [2.0, 2.0],     // Far outside
    [1.5, 0.0],     // East outside
    [0.0, 1.5]      // North outside
  ],
  edgePoints: [
    [0.0, 1.0],     // Top edge
    [1.0, 0.0]      // Right edge
  ]
};

/**
 * Fixture 5: Minimum Triangle (Boundary Test)
 *
 * A 3-vertex triangle (minimum valid polygon).
 * Tests edge case of smallest possible polygon.
 */
export const MINIMUM_TRIANGLE: TestFixture = {
  name: 'minimum_triangle',
  description: 'Minimum 3-vertex polygon',
  geoDegrees: [
    [0.0000, 0.0010],   // Top vertex
    [0.0010, 0.0000],   // Right vertex
    [-0.0010, 0.0000]   // Left vertex
  ],
  insidePoints: [
    [0.0000, 0.0003],   // Near center
    [0.0000, 0.0005]    // Upper center
  ],
  outsidePoints: [
    [0.0000, 0.0020],   // Above triangle
    [0.0000, -0.0005],  // Below triangle
    [0.0020, 0.0000]    // Right outside
  ],
  edgePoints: [
    [0.0005, 0.0005],   // Near right edge
    [-0.0005, 0.0005]   // Near left edge
  ]
};

/**
 * Fixture 6: Circle (100 vertices) - Normalization Stress Test
 *
 * A high-vertex-count polygon to stress-test the 8-vertex normalization.
 * Critical: After normalization to 8 vertices, inside/outside must be preserved.
 */
export const CIRCLE_100_VERTICES: TestFixture = {
  name: 'circle_100_vertices',
  description: '100-vertex circle to test normalization',
  geoDegrees: Array.from({ length: 100 }, (_, i) => {
    const angle = (i / 100) * 2 * Math.PI;
    return [
      0.0010 * Math.cos(angle),
      0.0010 * Math.sin(angle)
    ] as [number, number];
  }),
  insidePoints: [
    [0.0000, 0.0000],    // Center
    [0.0005, 0.0000],    // Near center
    [0.0000, 0.0005],    // Near center
    [0.0007, 0.0007]     // Diagonal
  ],
  outsidePoints: [
    [0.0020, 0.0000],    // East outside
    [0.0000, 0.0020],    // North outside
    [0.0015, 0.0015]     // Diagonal outside
  ],
  edgePoints: [
    [0.0010, 0.0000],    // East edge
    [0.0000, 0.0010]     // North edge
  ]
};

/**
 * Fixture 7: Pentagon (5 vertices) - Non-power-of-2 normalization
 *
 * Tests normalization when input isn't a power of 2.
 */
export const PENTAGON: TestFixture = {
  name: 'pentagon',
  description: '5-vertex regular pentagon',
  geoDegrees: Array.from({ length: 5 }, (_, i) => {
    const angle = (i / 5) * 2 * Math.PI - Math.PI / 2; // Start at top
    return [
      0.0010 * Math.cos(angle),
      0.0010 * Math.sin(angle)
    ] as [number, number];
  }),
  insidePoints: [
    [0.0000, 0.0000],    // Center
    [0.0000, 0.0005]     // Near top
  ],
  outsidePoints: [
    [0.0000, 0.0020],    // Far outside
    [0.0015, 0.0000]     // East outside
  ],
  edgePoints: [
    [0.0000, 0.0010]     // Near top vertex
  ]
};

/**
 * Fixture 8: Self-Intersecting Bowtie (Invalid Geometry)
 *
 * A self-intersecting polygon (invalid).
 * Expected behavior: Should be rejected or handled consistently.
 * This tests the SimplePolygon circuit validation (currently unused).
 */
export const BOWTIE_SELF_INTERSECTING: TestFixture = {
  name: 'bowtie_self_intersecting',
  description: 'Self-intersecting bowtie polygon (invalid)',
  geoDegrees: [
    [-0.0010, 0.0010],   // Top-left
    [0.0010, -0.0010],   // Bottom-right (crossing diagonal)
    [0.0010, 0.0010],    // Top-right
    [-0.0010, -0.0010]   // Bottom-left (crossing diagonal)
  ],
  insidePoints: [
    [0.0000, 0.0000]     // Ambiguous center point
  ],
  outsidePoints: [
    [0.0020, 0.0020],    // Clear outside
    [-0.0020, -0.0020]   // Clear outside
  ],
  expectedBehavior: 'Should reject or handle consistently (self-intersecting)'
};

/**
 * Fixture 9: Narrow Rectangle (Edge Case)
 *
 * A very narrow rectangle to test edge detection.
 */
export const NARROW_RECTANGLE: TestFixture = {
  name: 'narrow_rectangle',
  description: 'Very narrow rectangle to test edge cases',
  geoDegrees: [
    [-0.0001, 0.0010],   // Top-left
    [0.0001, 0.0010],    // Top-right
    [0.0001, -0.0010],   // Bottom-right
    [-0.0001, -0.0010]   // Bottom-left
  ],
  insidePoints: [
    [0.0000, 0.0000],    // Center
    [0.0000, 0.0005]     // Upper center
  ],
  outsidePoints: [
    [0.0002, 0.0000],    // Just outside right
    [-0.0002, 0.0000],   // Just outside left
    [0.0000, 0.0020]     // Far outside
  ],
  edgePoints: [
    [0.0001, 0.0000],    // Right edge
    [-0.0001, 0.0000]    // Left edge
  ]
};

/**
 * Fixture 10: Already 8 Vertices (No Normalization Needed)
 *
 * An octagon with exactly 8 vertices.
 * Tests that normalization doesn't corrupt already-valid polygons.
 */
export const OCTAGON_8_VERTICES: TestFixture = {
  name: 'octagon_8_vertices',
  description: '8-vertex octagon (no normalization needed)',
  geoDegrees: Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * 2 * Math.PI;
    return [
      0.0010 * Math.cos(angle),
      0.0010 * Math.sin(angle)
    ] as [number, number];
  }),
  insidePoints: [
    [0.0000, 0.0000],    // Center
    [0.0005, 0.0000]     // Near center
  ],
  outsidePoints: [
    [0.0020, 0.0000],    // Far outside
    [0.0015, 0.0015]     // Diagonal outside
  ],
  edgePoints: [
    [0.0010, 0.0000]     // East edge
  ]
};

/**
 * All fixtures exported as array for iteration
 */
export const ALL_FIXTURES: TestFixture[] = [
  SIMPLE_SQUARE,
  L_SHAPE,
  TINY_POLYGON,
  LARGE_POLYGON,
  MINIMUM_TRIANGLE,
  CIRCLE_100_VERTICES,
  PENTAGON,
  BOWTIE_SELF_INTERSECTING,
  NARROW_RECTANGLE,
  OCTAGON_8_VERTICES
];

/**
 * Valid fixtures (exclude invalid geometry)
 */
export const VALID_FIXTURES: TestFixture[] = ALL_FIXTURES.filter(
  f => !f.expectedBehavior?.includes('invalid')
);

/**
 * Fast fixtures for quick CI tests (subset of valid fixtures)
 */
export const FAST_FIXTURES: TestFixture[] = [
  SIMPLE_SQUARE,
  L_SHAPE,
  TINY_POLYGON
];

/**
 * Helper function to get fixture by name
 */
export function getFixture(name: string): TestFixture | undefined {
  return ALL_FIXTURES.find(f => f.name === name);
}

/**
 * Helper function to validate fixture integrity
 */
export function validateFixture(fixture: TestFixture): void {
  if (fixture.geoDegrees.length < 3) {
    throw new Error(`Fixture ${fixture.name}: Must have at least 3 vertices`);
  }

  if (fixture.insidePoints.length === 0) {
    throw new Error(`Fixture ${fixture.name}: Must have at least 1 inside point`);
  }

  if (fixture.outsidePoints.length === 0) {
    throw new Error(`Fixture ${fixture.name}: Must have at least 1 outside point`);
  }

  // Verify coordinates are in valid range
  const allCoords = [
    ...fixture.geoDegrees,
    ...fixture.insidePoints,
    ...fixture.outsidePoints,
    ...(fixture.edgePoints || [])
  ];

  for (const [lon, lat] of allCoords) {
    if (lon < -180 || lon > 180) {
      throw new Error(`Fixture ${fixture.name}: Longitude ${lon} out of range`);
    }
    if (lat < -90 || lat > 90) {
      throw new Error(`Fixture ${fixture.name}: Latitude ${lat} out of range`);
    }
  }
}

// Validate all fixtures on module load
ALL_FIXTURES.forEach(validateFixture);
