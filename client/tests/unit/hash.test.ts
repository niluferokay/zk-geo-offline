/**
 * Unit Tests: Hash Integrity
 *
 * Tests polygon hashing to ensure:
 * 1. Determinism: Same polygon → same hash
 * 2. Uniqueness: Different polygons → different hashes
 * 3. Stability: Hash format is valid SHA-256
 *
 * Coverage target: 100% of hash computation code
 */

import { describe, test, expect } from 'vitest';
import {
  calculatePolygonHash,
  normalizePolygonTo8Vertices,
  geoDegreesToLocalScaled,
  type GeoDegrees,
  type LocalScaled
} from '../../src/polygons';
import {
  SIMPLE_SQUARE,
  L_SHAPE,
  PENTAGON,
  CIRCLE_100_VERTICES,
  MINIMUM_TRIANGLE
} from '../fixtures';

describe('calculatePolygonHash', () => {
  test('should produce valid SHA-256 hex string', async () => {
    const coords: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 15],
      [15, 5],
      [20, 20],
      [5, 5]
    ];

    const hash = await calculatePolygonHash(coords);

    // Should be 64-character hex string (SHA-256 = 256 bits = 32 bytes = 64 hex chars)
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash.length).toBe(64);
  });

  test('should be deterministic (CRITICAL)', async () => {
    const coords: LocalScaled[] = [
      [100, 200],
      [300, 400],
      [500, 600],
      [700, 800],
      [900, 1000],
      [1100, 1200],
      [1300, 1400],
      [1500, 1600]
    ];

    // Generate hash 100 times
    const hashes = await Promise.all(
      Array.from({ length: 100 }, () => calculatePolygonHash(coords))
    );

    // All hashes must be identical
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);

    // Verify first and last are identical
    expect(hashes[0]).toBe(hashes[99]);
  });

  test('should produce different hashes for different polygons', async () => {
    const coords1: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [15, 15],
      [20, 20],
      [25, 25]
    ];

    const coords2: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [15, 15],
      [20, 20],
      [25, 26] // Different last coordinate
    ];

    const hash1 = await calculatePolygonHash(coords1);
    const hash2 = await calculatePolygonHash(coords2);

    expect(hash1).not.toBe(hash2);
  });

  test('should be sensitive to coordinate order', async () => {
    const coords1: LocalScaled[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [15, 15],
      [20, 20],
      [25, 25]
    ];

    // Rotated polygon (same vertices, different order)
    const coords2: LocalScaled[] = [
      [10, 0],
      [10, 10],
      [0, 10],
      [5, 5],
      [15, 15],
      [20, 20],
      [25, 25],
      [0, 0]
    ];

    const hash1 = await calculatePolygonHash(coords1);
    const hash2 = await calculatePolygonHash(coords2);

    // Different order should produce different hash
    expect(hash1).not.toBe(hash2);
  });

  test('should be sensitive to small changes', async () => {
    const coords1: LocalScaled[] = [
      [100, 100],
      [200, 100],
      [200, 200],
      [100, 200],
      [150, 150],
      [250, 250],
      [300, 300],
      [350, 350]
    ];

    const coords2: LocalScaled[] = [
      [100, 100],
      [200, 100],
      [200, 200],
      [100, 200],
      [150, 151], // +1 difference
      [250, 250],
      [300, 300],
      [350, 350]
    ];

    const hash1 = await calculatePolygonHash(coords1);
    const hash2 = await calculatePolygonHash(coords2);

    expect(hash1).not.toBe(hash2);
  });

  test('should handle negative coordinates', async () => {
    const coords: LocalScaled[] = [
      [-100, -100],
      [100, -100],
      [100, 100],
      [-100, 100],
      [-50, -50],
      [50, 50],
      [0, 0],
      [25, -25]
    ];

    const hash = await calculatePolygonHash(coords);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('should handle large coordinates', async () => {
    const coords: LocalScaled[] = [
      [-1000000, 1000000],
      [1000000, 1000000],
      [1000000, -1000000],
      [-1000000, -1000000],
      [0, 0],
      [500000, 500000],
      [-500000, -500000],
      [750000, -750000]
    ];

    const hash = await calculatePolygonHash(coords);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('should handle zero coordinates', async () => {
    const coords: LocalScaled[] = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ];

    const hash = await calculatePolygonHash(coords);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Hash Stability Across Normalization', () => {
  test('should produce stable hash for SIMPLE_SQUARE', async () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      SIMPLE_SQUARE.geoDegrees as GeoDegrees[]
    );
    const normalized = normalizePolygonTo8Vertices(localScaled);

    const hash1 = await calculatePolygonHash(normalized);
    const hash2 = await calculatePolygonHash(normalized);
    const hash3 = await calculatePolygonHash(normalized);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  test('should produce different hashes for different normalized fixtures', async () => {
    const fixtures = [SIMPLE_SQUARE, L_SHAPE, PENTAGON, MINIMUM_TRIANGLE];

    const hashes = await Promise.all(
      fixtures.map(async fixture => {
        const { coordinates: localScaled } = geoDegreesToLocalScaled(
          fixture.geoDegrees as GeoDegrees[]
        );
        const normalized = normalizePolygonTo8Vertices(localScaled);
        return calculatePolygonHash(normalized);
      })
    );

    // All hashes should be unique
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(fixtures.length);
  });

  test('should produce same hash for same fixture normalized multiple times', async () => {
    const { coordinates: localScaled } = geoDegreesToLocalScaled(
      CIRCLE_100_VERTICES.geoDegrees as GeoDegrees[]
    );

    // Normalize 10 times
    const normalized = Array.from({ length: 10 }, () =>
      normalizePolygonTo8Vertices(localScaled)
    );

    // Hash all 10 normalized versions
    const hashes = await Promise.all(normalized.map(calculatePolygonHash));

    // All hashes must be identical
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(1);
  });
});

describe('Hash Collision Resistance', () => {
  test('should produce different hashes for slightly different polygons', async () => {
    const base: LocalScaled[] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [50, 50],
      [150, 150],
      [200, 200],
      [250, 250]
    ];

    // Create 10 variants with small perturbations
    const variants = Array.from({ length: 10 }, (_, i) => [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [50 + i, 50 + i], // Perturb this vertex
      [150, 150],
      [200, 200],
      [250, 250]
    ] as LocalScaled[]);

    const hashes = await Promise.all(variants.map(calculatePolygonHash));

    // All hashes should be unique
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(10);
  });

  test('should avoid collisions for common polygon patterns', async () => {
    // Create several common polygon shapes
    const polygons: LocalScaled[][] = [
      // Square
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [50, 0],
        [100, 50],
        [50, 100],
        [0, 50]
      ],
      // Diamond
      [
        [50, 0],
        [100, 50],
        [50, 100],
        [0, 50],
        [25, 25],
        [75, 25],
        [75, 75],
        [25, 75]
      ],
      // Octagon
      Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 2 * Math.PI;
        return [
          Math.round(100 * Math.cos(angle)),
          Math.round(100 * Math.sin(angle))
        ] as LocalScaled;
      })
    ];

    const hashes = await Promise.all(polygons.map(calculatePolygonHash));

    // All should be unique
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(polygons.length);
  });
});

describe('Hash Format Validation', () => {
  test('should only contain lowercase hex characters', async () => {
    const coords: LocalScaled[] = [
      [123, 456],
      [789, 101],
      [112, 131],
      [415, 161],
      [718, 192],
      [21, 222],
      [324, 252],
      [627, 282]
    ];

    const hash = await calculatePolygonHash(coords);

    // Check each character is valid hex
    for (const char of hash) {
      expect('0123456789abcdef').toContain(char);
    }
  });

  test('should have consistent length', async () => {
    const testCases = [
      [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]],
      [
        [100000, 100000],
        [200000, 200000],
        [300000, 300000],
        [400000, 400000],
        [500000, 500000],
        [600000, 600000],
        [700000, 700000],
        [800000, 800000]
      ],
      [
        [-100, -100],
        [-200, -200],
        [-300, -300],
        [-400, -400],
        [-500, -500],
        [-600, -600],
        [-700, -700],
        [-800, -800]
      ]
    ] as LocalScaled[][];

    const hashes = await Promise.all(testCases.map(calculatePolygonHash));

    hashes.forEach(hash => {
      expect(hash.length).toBe(64);
    });
  });
});

describe('Edge Cases', () => {
  test('should handle minimal coordinate differences', async () => {
    const coords1: LocalScaled[] = Array(8).fill([0, 0]);
    const coords2: LocalScaled[] = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 1] // Minimal difference
    ];

    const hash1 = await calculatePolygonHash(coords1);
    const hash2 = await calculatePolygonHash(coords2);

    expect(hash1).not.toBe(hash2);
  });

  test('should handle maximum coordinate values', async () => {
    const maxInt = 2147483647; // Max int32
    const coords: LocalScaled[] = [
      [maxInt, maxInt],
      [maxInt - 1, maxInt - 1],
      [maxInt - 2, maxInt - 2],
      [maxInt - 3, maxInt - 3],
      [maxInt - 4, maxInt - 4],
      [maxInt - 5, maxInt - 5],
      [maxInt - 6, maxInt - 6],
      [maxInt - 7, maxInt - 7]
    ];

    const hash = await calculatePolygonHash(coords);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Performance', () => {
  test('should hash quickly (< 10ms for single polygon)', async () => {
    const coords: LocalScaled[] = [
      [12345, 67890],
      [23456, 78901],
      [34567, 89012],
      [45678, 90123],
      [56789, 12340],
      [67890, 23451],
      [78901, 34562],
      [89012, 45673]
    ];

    const start = performance.now();
    await calculatePolygonHash(coords);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // Should be very fast
  });

  test('should batch hash efficiently', async () => {
    const polygons = Array.from({ length: 100 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) => [i * 100 + j, j * 100 + i] as LocalScaled)
    );

    const start = performance.now();
    await Promise.all(polygons.map(calculatePolygonHash));
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500); // 100 polygons in < 500ms
  });
});
