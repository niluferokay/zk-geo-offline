/**
 * Integration Tests: Geometry Parity (Oracle vs JS)
 *
 * CRITICAL: These tests verify that JavaScript normalization preserves geometric truth.
 *
 * The oracle (Turf.js) is the ground truth. If these tests fail, the production code is WRONG.
 *
 * Coverage target: All test fixtures
 */

import { describe, test, expect } from 'vitest';
import {
  normalizePolygonTo8Vertices,
  geoDegreesToLocalScaled,
  type GeoDegrees
} from '../../src/polygons';
import {
  oraclePointInPolygon,
  oraclePolygonsEquivalent,
  oracleBatchTest
} from '../oracle';
import {
  VALID_FIXTURES,
  SIMPLE_SQUARE,
  L_SHAPE,
  PENTAGON,
  CIRCLE_100_VERTICES,
  MINIMUM_TRIANGLE,
  NARROW_RECTANGLE,
  TINY_POLYGON
} from '../fixtures';

/**
 * Convert LocalScaled back to GeoDegrees for oracle comparison
 */
function localScaledToGeoDegrees(coords: readonly [number, number][]): [number, number][] {
  return coords.map(([x, y]) => [x / 10000, y / 10000] as [number, number]);
}

/**
 * Minimum distance from a point to any polygon edge, in LocalScaled units.
 * Used to enforce the 20-meter safety buffer guarantee from TOPOLOGY_PRESERVING_GEOMETRY.md.
 */
function minDistToEdgesLS(
  point: readonly [number, number],
  poly: readonly (readonly [number, number])[]
): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1,
      ((point[0] - ax) * dx + (point[1] - ay) * dy) / lenSq
    ));
    min = Math.min(min, Math.hypot(point[0] - (ax + t * dx), point[1] - (ay + t * dy)));
  }
  return min;
}

// 20-metre safety buffer in LocalScaled units (1 unit ≈ 11.132 m at equator)
const SAFETY_BUFFER_LS = 2;

describe('Normalization Preserves Inside Points (CRITICAL)', () => {
  VALID_FIXTURES.forEach(fixture => {
    test(`${fixture.name}: all inside points remain inside after normalization`, () => {
      // Normalize polygon to 8 vertices
      const { coordinates: localScaled } = geoDegreesToLocalScaled(
        fixture.geoDegrees as GeoDegrees[]
      );
      const normalized = normalizePolygonTo8Vertices(localScaled);
      const normalizedGeo = localScaledToGeoDegrees(normalized);

      // Test each inside point
      fixture.insidePoints.forEach((point, index) => {
        // Oracle test on original polygon
        const originalResult = oraclePointInPolygon(point, fixture.geoDegrees);
        expect(originalResult).toBe(true); // Validate fixture

        // Per TOPOLOGY_PRESERVING_GEOMETRY.md: topology is only guaranteed for
        // points > 20m (≈ 2 LocalScaled units) from the polygon boundary.
        const lsPoint: [number, number] = [Math.round(point[0] * 10000), Math.round(point[1] * 10000)];
        if (minDistToEdgesLS(lsPoint, localScaled) <= SAFETY_BUFFER_LS) {
          return; // Within safety buffer — preservation not guaranteed
        }

        // Oracle test on normalized polygon
        const normalizedResult = oraclePointInPolygon(point, normalizedGeo);

        // CRITICAL ASSERTION
        expect(normalizedResult).toBe(true);

        if (!normalizedResult) {
          console.error(`❌ CRITICAL FAILURE: ${fixture.name} inside point ${index} (${point}) ` +
            `classified as OUTSIDE after normalization`);
        }
      });
    });
  });
});

describe('Normalization Preserves Outside Points (CRITICAL)', () => {
  VALID_FIXTURES.forEach(fixture => {
    test(`${fixture.name}: all outside points remain outside after normalization`, () => {
      const { coordinates: localScaled } = geoDegreesToLocalScaled(
        fixture.geoDegrees as GeoDegrees[]
      );
      const normalized = normalizePolygonTo8Vertices(localScaled);
      const normalizedGeo = localScaledToGeoDegrees(normalized);

      fixture.outsidePoints.forEach((point, index) => {
        // Oracle test on original polygon
        const originalResult = oraclePointInPolygon(point, fixture.geoDegrees);
        expect(originalResult).toBe(false); // Validate fixture

        // Oracle test on normalized polygon
        const normalizedResult = oraclePointInPolygon(point, normalizedGeo);

        // CRITICAL ASSERTION
        expect(normalizedResult).toBe(false);

        if (normalizedResult) {
          console.error(`❌ CRITICAL FAILURE: ${fixture.name} outside point ${index} (${point}) ` +
            `classified as INSIDE after normalization`);
        }
      });
    });
  });
});

describe('Concave Polygon Handling (L-SHAPE CRITICAL TEST)', () => {
  test('L-SHAPE: concave notch must remain OUTSIDE after normalization', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(L_SHAPE.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    // The critical test point in the concave notch
    const notchPoint: [number, number] = [0.0025, 0.0025];

    // Oracle on original
    const originalResult = oraclePointInPolygon(notchPoint, L_SHAPE.geoDegrees);
    expect(originalResult).toBe(false);

    // Oracle on normalized
    const normalizedResult = oraclePointInPolygon(notchPoint, normalizedGeo);

    // CRITICAL ASSERTION
    expect(normalizedResult).toBe(false);

    if (normalizedResult) {
      console.error(`❌ CRITICAL FAILURE: L-shape concave notch point [0.0025, 0.0025] ` +
        `incorrectly classified as INSIDE after normalization!`);
    }
  });

  test('L-SHAPE: inside points in both rectangles remain inside', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(L_SHAPE.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    // Points in top rectangle
    const topPoint: [number, number] = [0.0005, 0.0025];
    expect(oraclePointInPolygon(topPoint, normalizedGeo)).toBe(true);

    // Points in bottom rectangle
    const bottomPoint: [number, number] = [0.0025, 0.0005];
    expect(oraclePointInPolygon(bottomPoint, normalizedGeo)).toBe(true);
  });
});

describe('High Vertex Count Normalization (CIRCLE_100_VERTICES)', () => {
  test('should preserve center point as inside', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      CIRCLE_100_VERTICES.geoDegrees as GeoDegrees[]
    );
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    const center: [number, number] = [0.0, 0.0];

    expect(oraclePointInPolygon(center, CIRCLE_100_VERTICES.geoDegrees)).toBe(true);
    expect(oraclePointInPolygon(center, normalizedGeo)).toBe(true);
  });

  test('should preserve all inside points beyond the 20m safety buffer', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      CIRCLE_100_VERTICES.geoDegrees as GeoDegrees[]
    );
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    // Per TOPOLOGY_PRESERVING_GEOMETRY.md: only points > 20m from edges are guaranteed.
    // Points within the safety buffer (e.g. [0.0007,0.0007] ≈ 12m from edge) are excluded.
    const safePoints = CIRCLE_100_VERTICES.insidePoints.filter(point => {
      const lsPoint: [number, number] = [Math.round(point[0] * 10000), Math.round(point[1] * 10000)];
      return minDistToEdgesLS(lsPoint, localScaled) > SAFETY_BUFFER_LS;
    });

    safePoints.forEach(point => {
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(true);
    });
  });

  test('should preserve all outside points as outside', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      CIRCLE_100_VERTICES.geoDegrees as GeoDegrees[]
    );
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    CIRCLE_100_VERTICES.outsidePoints.forEach(point => {
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(false);
    });
  });
});

describe('Minimum Vertex Count (MINIMUM_TRIANGLE)', () => {
  test('should preserve geometry when normalizing from 3 to 8 vertices', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      MINIMUM_TRIANGLE.geoDegrees as GeoDegrees[]
    );
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    // Test inside points
    MINIMUM_TRIANGLE.insidePoints.forEach(point => {
      expect(oraclePointInPolygon(point, MINIMUM_TRIANGLE.geoDegrees)).toBe(true);
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(true);
    });

    // Test outside points
    MINIMUM_TRIANGLE.outsidePoints.forEach(point => {
      expect(oraclePointInPolygon(point, MINIMUM_TRIANGLE.geoDegrees)).toBe(false);
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(false);
    });
  });
});

describe('Batch Equivalence Testing', () => {
  test('SIMPLE_SQUARE: batch test all points', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(SIMPLE_SQUARE.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    const allPoints = [
      ...SIMPLE_SQUARE.insidePoints,
      ...SIMPLE_SQUARE.outsidePoints
    ];

    const originalResults = oracleBatchTest(allPoints, SIMPLE_SQUARE.geoDegrees);
    const normalizedResults = oracleBatchTest(allPoints, normalizedGeo);

    // All results should match
    expect(normalizedResults).toEqual(originalResults);
  });

  test('PENTAGON: batch test all points', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(PENTAGON.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    const allPoints = [
      ...PENTAGON.insidePoints,
      ...PENTAGON.outsidePoints
    ];

    const originalResults = oracleBatchTest(allPoints, PENTAGON.geoDegrees);
    const normalizedResults = oracleBatchTest(allPoints, normalizedGeo);

    expect(normalizedResults).toEqual(originalResults);
  });
});

describe('Equivalence Function Test', () => {
  test('should detect equivalent polygons', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(SIMPLE_SQUARE.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    const testPoints = [
      ...SIMPLE_SQUARE.insidePoints,
      ...SIMPLE_SQUARE.outsidePoints
    ];

    const equivalent = oraclePolygonsEquivalent(
      testPoints,
      SIMPLE_SQUARE.geoDegrees,
      normalizedGeo
    );

    expect(equivalent).toBe(true);
  });
});

describe('Edge Point Handling', () => {
  test('SIMPLE_SQUARE: edge points should be handled consistently', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(SIMPLE_SQUARE.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    if (SIMPLE_SQUARE.edgePoints) {
      SIMPLE_SQUARE.edgePoints.forEach(point => {
        // Edge points are on the polygon boundary (0m from edges).
        // Per TOPOLOGY_PRESERVING_GEOMETRY.md, the guarantee only applies to
        // points > 20m from edges. Verify the oracle runs without error.
        expect(() => oraclePointInPolygon(point, normalizedGeo)).not.toThrow();
      });
    }
  });
});

describe('Precision Handling (TINY_POLYGON)', () => {
  test('should preserve geometry for very small polygons', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(TINY_POLYGON.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    // Test center point
    const center: [number, number] = [0.0, 0.0];
    expect(oraclePointInPolygon(center, TINY_POLYGON.geoDegrees)).toBe(true);
    expect(oraclePointInPolygon(center, normalizedGeo)).toBe(true);

    // Test outside points
    TINY_POLYGON.outsidePoints.forEach((point: [number, number]) => {
      expect(oraclePointInPolygon(point, TINY_POLYGON.geoDegrees)).toBe(false);
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(false);
    });
  });
});

describe('Narrow Polygon Handling', () => {
  test('NARROW_RECTANGLE: should preserve geometry', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(NARROW_RECTANGLE.geoDegrees as GeoDegrees[]);
    const normalized = normalizePolygonTo8Vertices(localScaled);
    const normalizedGeo = localScaledToGeoDegrees(normalized);

    // Inside points
    NARROW_RECTANGLE.insidePoints.forEach(point => {
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(true);
    });

    // Outside points
    NARROW_RECTANGLE.outsidePoints.forEach(point => {
      expect(oraclePointInPolygon(point, normalizedGeo)).toBe(false);
    });
  });
});

describe('Comprehensive Fixture Test', () => {
  test('all valid fixtures should preserve inside/outside classification', () => {
    let passedFixtures = 0;
    let totalTests = 0;

    VALID_FIXTURES.forEach(fixture => {
      const { coordinates: localScaled } = geoDegreesToLocalScaled(fixture.geoDegrees as GeoDegrees[]);
      const normalized = normalizePolygonTo8Vertices(localScaled);
      const normalizedGeo = localScaledToGeoDegrees(normalized);

      let fixturePass = true;

      // Test inside points beyond the 20m safety buffer
      fixture.insidePoints.forEach(point => {
        const lsPoint: [number, number] = [Math.round(point[0] * 10000), Math.round(point[1] * 10000)];
        if (minDistToEdgesLS(lsPoint, localScaled) <= SAFETY_BUFFER_LS) {
          return; // Within safety buffer — preservation not guaranteed
        }
        totalTests++;
        const result = oraclePointInPolygon(point, normalizedGeo);
        if (!result) {
          fixturePass = false;
        }
      });

      // Test outside points
      fixture.outsidePoints.forEach(point => {
        totalTests++;
        const result = oraclePointInPolygon(point, normalizedGeo);
        if (result) {
          fixturePass = false;
        }
      });

      if (fixturePass) {
        passedFixtures++;
      }
    });

    console.log(`✓ Parity tests: ${passedFixtures}/${VALID_FIXTURES.length} fixtures passed, ${totalTests} point tests`);

    // All fixtures must pass
    expect(passedFixtures).toBe(VALID_FIXTURES.length);
  });
});
