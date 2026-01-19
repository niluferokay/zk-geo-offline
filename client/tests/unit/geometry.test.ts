/**
 * Unit Tests: Geometry Operations
 *
 * Tests coordinate transformations, signed area calculation,
 * and other low-level geometry functions.
 *
 * Coverage target: 100% of coordinate transformation code
 */

import { describe, test, expect } from 'vitest';
import {
  geoDegreesToLocalScaled,
  localScaledToCircuitGrid,
  signedArea,
  ensureCCW,
  sanitizePolygon,
  removeClosingDuplicate,
  type GeoDegrees,
  type LocalScaled,
  type CircuitGrid
} from '../../src/polygons';
import { SIMPLE_SQUARE, L_SHAPE, TINY_POLYGON } from '../fixtures';

describe('Coordinate Transformations', () => {
  describe('geoDegreesToLocalScaled', () => {
    test('should convert decimal degrees to scaled integers', () => {
      const input: GeoDegrees[] = [
        [0.0010, 0.0010],
        [0.0020, 0.0020],
        [-0.0010, -0.0010]
      ];

      const result = geoDegreesToLocalScaled(input);

      expect(result.coordinates).toEqual([
        [10, 10],
        [20, 20],
        [-10, -10]
      ]);
    });

    test('should round to nearest integer', () => {
      const input: GeoDegrees[] = [
        [0.00015, 0.00015],  // 0.00015 * 10000 = 1.4999... → rounds to 1
        [0.00014, 0.00014],  // 0.00014 * 10000 = 1.4 → rounds to 1
        [0.00016, 0.00016]   // 0.00016 * 10000 = 1.6 → rounds to 2
      ];

      const result = geoDegreesToLocalScaled(input);

      expect(result.coordinates).toEqual([
        [1, 1],  // Fixed: 0.00015 * 10000 has floating point precision issues
        [1, 1],
        [2, 2]
      ]);
    });

    test('should handle zero coordinates', () => {
      const input: GeoDegrees[] = [
        [0.0000, 0.0000]
      ];

      const result = geoDegreesToLocalScaled(input);

      expect(result.coordinates).toEqual([[0, 0]]);
    });

    test('should handle large coordinates', () => {
      const input: GeoDegrees[] = [
        [1.0, 1.0],
        [-1.0, -1.0]
      ];

      const result = geoDegreesToLocalScaled(input);

      expect(result.coordinates).toEqual([
        [10000, 10000],
        [-10000, -10000]
      ]);
    });

    test('should be deterministic (same input = same output)', () => {
      const input: GeoDegrees[] = SIMPLE_SQUARE.geoDegrees as GeoDegrees[];

      const result1 = geoDegreesToLocalScaled(input);
      const result2 = geoDegreesToLocalScaled(input);
      const result3 = geoDegreesToLocalScaled(input);

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe('localScaledToCircuitGrid', () => {
    test('should transform to uint32 grid space centered at 2^31', () => {
      const userPoint: LocalScaled = [0, 0];
      const polygon: LocalScaled[] = [
        [-10, 10],
        [10, 10],
        [10, -10],
        [-10, -10]
      ];

      const result = localScaledToCircuitGrid(userPoint, polygon);

      // Center should be at origin (0, 0)
      // Grid center is 2^31 = 2147483648
      // So point at origin should map to 2^31
      expect(result.point[0]).toBe(2147483648);
      expect(result.point[1]).toBe(2147483648);

      // Polygon vertices should be offset correctly
      expect(result.polygon).toHaveLength(4);
      result.polygon.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(2 ** 32);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(2 ** 32);
      });
    });

    test('should be deterministic (CRITICAL)', () => {
      const userPoint: LocalScaled = [5, 5];
      const { coordinates: polygon } = geoDegreesToLocalScaled(
        SIMPLE_SQUARE.geoDegrees as GeoDegrees[]
      );

      // Run transformation 100 times
      const results = Array.from({ length: 100 }, () =>
        localScaledToCircuitGrid(userPoint, polygon)
      );

      // All results must be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].point).toEqual(results[0].point);
        expect(results[i].polygon).toEqual(results[0].polygon);
      }
    });

    test('should handle user point outside polygon', () => {
      const userPoint: LocalScaled = [1000, 1000];
      const polygon: LocalScaled[] = [
        [-10, 10],
        [10, 10],
        [10, -10],
        [-10, -10]
      ];

      const result = localScaledToCircuitGrid(userPoint, polygon);

      // Should still produce valid uint32 coordinates
      expect(result.point[0]).toBeGreaterThanOrEqual(0);
      expect(result.point[0]).toBeLessThan(2 ** 32);
      expect(result.point[1]).toBeGreaterThanOrEqual(0);
      expect(result.point[1]).toBeLessThan(2 ** 32);
    });

    test('should handle large coordinate ranges', () => {
      const userPoint: LocalScaled = [0, 0];
      const polygon: LocalScaled[] = [
        [-10000, 10000],
        [10000, 10000],
        [10000, -10000],
        [-10000, -10000]
      ];

      const result = localScaledToCircuitGrid(userPoint, polygon);

      // Should fit in uint32 range
      result.polygon.forEach(([x, y]) => {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(2 ** 32);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(2 ** 32);
      });
    });
  });
});

describe('Signed Area Calculation', () => {
  test('should calculate positive area for CCW polygons', () => {
    const ccwSquare: LocalScaled[] = [
      [-10, -10],  // Bottom-left
      [10, -10],   // Bottom-right
      [10, 10],    // Top-right
      [-10, 10]    // Top-left
    ];

    const area = signedArea(ccwSquare);

    expect(area).toBeGreaterThan(0);
    expect(area).toBe(400); // 20 × 20 = 400
  });

  test('should calculate negative area for CW polygons', () => {
    const cwSquare: LocalScaled[] = [
      [-10, 10],   // Top-left
      [10, 10],    // Top-right
      [10, -10],   // Bottom-right
      [-10, -10]   // Bottom-left
    ];

    const area = signedArea(cwSquare);

    expect(area).toBeLessThan(0);
    expect(area).toBe(-400);
  });

  test('should calculate zero area for degenerate polygons', () => {
    const line: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [20, 0]
    ];

    const area = signedArea(line);

    expect(area).toBe(0);
  });

  test('should use shoelace formula correctly', () => {
    // Triangle with known area
    const triangle: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [5, 10]
    ];

    const area = signedArea(triangle);

    // Area of triangle = base × height / 2 = 10 × 10 / 2 = 50
    expect(Math.abs(area)).toBe(50);
  });
});

describe('CCW Enforcement', () => {
  test('should not modify CCW polygons', () => {
    const ccwSquare: LocalScaled[] = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10]
    ];

    const result = ensureCCW(ccwSquare);

    expect(result).toEqual(ccwSquare);
  });

  test('should reverse CW polygons', () => {
    const cwSquare: LocalScaled[] = [
      [-10, 10],
      [10, 10],
      [10, -10],
      [-10, -10]
    ];

    const result = ensureCCW(cwSquare);

    // Should be reversed
    expect(result).toEqual([
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10]
    ]);
  });

  test('should maintain CCW after multiple calls', () => {
    const cwSquare: LocalScaled[] = [
      [-10, 10],
      [10, 10],
      [10, -10],
      [-10, -10]
    ];

    const result1 = ensureCCW(cwSquare);
    const result2 = ensureCCW(result1);
    const result3 = ensureCCW(result2);

    // All should be identical (idempotent)
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);

    // Should have positive area (CCW)
    expect(signedArea(result1)).toBeGreaterThan(0);
  });
});

describe('Polygon Sanitization', () => {
  test('should remove consecutive duplicate vertices', () => {
    const withDuplicates: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 0],  // Duplicate
      [10, 10],
      [10, 10], // Duplicate
      [0, 10]
    ];

    const result = sanitizePolygon(withDuplicates);

    expect(result).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ]);
  });

  test('should handle polygon with no duplicates', () => {
    const noDuplicates: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ];

    const result = sanitizePolygon(noDuplicates);

    expect(result).toEqual(noDuplicates);
  });

  test('should handle all-duplicate vertices', () => {
    const allDuplicates: LocalScaled[] = [
      [5, 5],
      [5, 5],
      [5, 5]
    ];

    const result = sanitizePolygon(allDuplicates);

    expect(result).toEqual([[5, 5]]);
  });
});

describe('Closing Duplicate Removal', () => {
  test('should remove closing duplicate vertex', () => {
    const closed: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0]  // Closing duplicate
    ];

    const result = removeClosingDuplicate(closed);

    expect(result).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ]);
  });

  test('should not modify open polygons', () => {
    const open: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ];

    const result = removeClosingDuplicate(open);

    expect(result).toEqual(open);
  });

  test('should handle approximate closing duplicates', () => {
    // Note: Current implementation only checks exact equality
    // If floating-point tolerance is added later, update this test
    const approxClosed: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0]  // Exact duplicate
    ];

    const result = removeClosingDuplicate(approxClosed);

    expect(result).toHaveLength(4);
  });
});

describe('Integration: Full Coordinate Pipeline', () => {
  test('should transform SIMPLE_SQUARE through full pipeline', () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      SIMPLE_SQUARE.geoDegrees as GeoDegrees[]
    );
    const { coordinates: userPoints } = geoDegreesToLocalScaled(
      [SIMPLE_SQUARE.insidePoints[0]] as GeoDegrees[]
    );
    const userPoint = userPoints[0];

    const circuitInput = localScaledToCircuitGrid(userPoint, localScaled);

    // Verify valid uint32 coordinates
    expect(circuitInput.point[0]).toBeGreaterThanOrEqual(0);
    expect(circuitInput.point[0]).toBeLessThan(2 ** 32);
    expect(circuitInput.polygon).toHaveLength(4);
  });

  test('should be deterministic for entire pipeline', () => {
    const runPipeline = () => {
      const { coordinates: localScaled } = geoDegreesToLocalScaled(
        L_SHAPE.geoDegrees as GeoDegrees[]
      );
      const { coordinates: userPoints } = geoDegreesToLocalScaled(
        [L_SHAPE.insidePoints[0]] as GeoDegrees[]
      );
      const userPoint = userPoints[0];
      return localScaledToCircuitGrid(userPoint, localScaled);
    };

    const results = Array.from({ length: 50 }, runPipeline);

    // All results must be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });
});

describe('Edge Cases', () => {
  test('should handle empty polygon array', () => {
    const empty: GeoDegrees[] = [];
    const result = geoDegreesToLocalScaled(empty);
    expect(result.coordinates).toEqual([]);
  });

  test('should handle single point', () => {
    const singlePoint: GeoDegrees[] = [[0.0005, 0.0005]];
    const result = geoDegreesToLocalScaled(singlePoint);
    expect(result.coordinates).toEqual([[5, 5]]);
  });

  test('should handle very small differences', () => {
    const tinyDiff: GeoDegrees[] = [
      [0.00001, 0.00001],
      [0.00002, 0.00002]
    ];
    const result = geoDegreesToLocalScaled(tinyDiff);
    expect(result.coordinates).toEqual([
      [0, 0],  // Rounds to 0
      [0, 0]   // Rounds to 0
    ]);
  });
});
