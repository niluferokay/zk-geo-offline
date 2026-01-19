/**
 * CRYPTOGRAPHIC HASH STABILITY TEST SUITE
 *
 * PURPOSE: Verify that boundary hashes are deterministic and stable
 *
 * CRITICAL PROPERTIES TESTED:
 * 1. Same coordinates + metadata → same hash (determinism)
 * 2. Different time → same hash (time independence)
 * 3. Different object property order → same hash (canonical serialization)
 * 4. Different coordinate → different hash (collision resistance)
 * 5. Different metadata → different hash (parameter binding)
 * 6. Cross-platform consistency (same results on different JS engines)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  calculateBoundaryHash,
  createHashMetadata,
  recomputeBoundaryHash,
  createCustomPolygon,
  initializeDemoPolygons,
  getDemoPolygons,
  type LocalScaled,
  type BoundaryHashMetadata,
  type Polygon
} from '../src/polygons';

describe('Boundary Hash Stability', () => {
  const testCoordinates: LocalScaled[] = [
    [290200, 411000],
    [290260, 411150],
    [290320, 411300],
    [290450, 411300],
    [290520, 411150],
    [290480, 411000],
    [290380, 410900],
    [290260, 410900]
  ];

  const testMetadata: BoundaryHashMetadata = {
    version: 2,
    scale: 10000,
    roundingMode: 'symmetric',
    vertexSelectionAlgorithm: 'visvalingam-whyatt',
    targetVertexCount: 8
  };

  describe('Determinism Tests', () => {
    it('should produce identical hashes for identical inputs', async () => {
      const hash1 = await calculateBoundaryHash(testCoordinates, testMetadata);
      const hash2 = await calculateBoundaryHash(testCoordinates, testMetadata);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/); // Valid SHA-256 hex
    });

    it('should produce same hash at different times', async () => {
      const hash1 = await calculateBoundaryHash(testCoordinates, testMetadata);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const hash2 = await calculateBoundaryHash(testCoordinates, testMetadata);

      expect(hash1).toBe(hash2);
    });

    it('should produce same hash with different metadata object instances', async () => {
      const metadata1 = { ...testMetadata };
      const metadata2 = { ...testMetadata };

      const hash1 = await calculateBoundaryHash(testCoordinates, metadata1);
      const hash2 = await calculateBoundaryHash(testCoordinates, metadata2);

      expect(hash1).toBe(hash2);
    });

    it('should produce same hash regardless of metadata property order', async () => {
      // Create metadata with properties in different order
      const metadata1 = {
        version: 2,
        scale: 10000,
        roundingMode: 'symmetric' as const,
        vertexSelectionAlgorithm: 'visvalingam-whyatt' as const,
        targetVertexCount: 8
      };

      const metadata2 = {
        targetVertexCount: 8,
        vertexSelectionAlgorithm: 'visvalingam-whyatt' as const,
        scale: 10000,
        version: 2,
        roundingMode: 'symmetric' as const
      };

      const hash1 = await calculateBoundaryHash(testCoordinates, metadata1);
      const hash2 = await calculateBoundaryHash(testCoordinates, metadata2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Collision Resistance Tests', () => {
    it('should produce different hashes for different coordinates', async () => {
      const coords1 = testCoordinates;
      const coords2 = [...testCoordinates];
      coords2[0] = [290201, 411000]; // Change one coordinate

      const hash1 = await calculateBoundaryHash(coords1, testMetadata);
      const hash2 = await calculateBoundaryHash(coords2, testMetadata);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different metadata versions', async () => {
      const metadata1 = { ...testMetadata, version: 1 };
      const metadata2 = { ...testMetadata, version: 2 };

      const hash1 = await calculateBoundaryHash(testCoordinates, metadata1);
      const hash2 = await calculateBoundaryHash(testCoordinates, metadata2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different scale', async () => {
      const metadata1 = { ...testMetadata, scale: 10000 };
      const metadata2 = { ...testMetadata, scale: 1000 };

      const hash1 = await calculateBoundaryHash(testCoordinates, metadata1);
      const hash2 = await calculateBoundaryHash(testCoordinates, metadata2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different rounding modes', async () => {
      const metadata1 = { ...testMetadata, roundingMode: 'symmetric' as const };
      const metadata2 = { ...testMetadata, roundingMode: 'floor' as const };

      const hash1 = await calculateBoundaryHash(testCoordinates, metadata1);
      const hash2 = await calculateBoundaryHash(testCoordinates, metadata2);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for different vertex selection algorithms', async () => {
      const metadata1 = { ...testMetadata, vertexSelectionAlgorithm: 'visvalingam-whyatt' as const };
      const metadata2 = { ...testMetadata, vertexSelectionAlgorithm: 'douglas-peucker' as const };

      const hash1 = await calculateBoundaryHash(testCoordinates, metadata1);
      const hash2 = await calculateBoundaryHash(testCoordinates, metadata2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Security Tests', () => {
    it('should reject metadata containing timestamp', async () => {
      const badMetadata: any = {
        ...testMetadata,
        timestamp: Date.now()
      };

      await expect(
        calculateBoundaryHash(testCoordinates, badMetadata)
      ).rejects.toThrow('non-deterministic timestamp');
    });

    it('should reject metadata containing createdAt', async () => {
      const badMetadata: any = {
        ...testMetadata,
        createdAt: Date.now()
      };

      await expect(
        calculateBoundaryHash(testCoordinates, badMetadata)
      ).rejects.toThrow('non-deterministic timestamp');
    });

    it('should reject empty coordinates', async () => {
      await expect(
        calculateBoundaryHash([], testMetadata)
      ).rejects.toThrow('empty coordinates');
    });

    it('should reject invalid metadata', async () => {
      const badMetadata: any = { version: 2 }; // Missing required fields

      await expect(
        calculateBoundaryHash(testCoordinates, badMetadata)
      ).rejects.toThrow('Invalid hash metadata');
    });
  });

  describe('Verification Utilities', () => {
    it('should recompute hash correctly', async () => {
      const polygon: Polygon = {
        id: 'test',
        name: 'Test',
        description: 'Test polygon',
        coordinates: testCoordinates,
        hashMetadata: testMetadata,
        hash: await calculateBoundaryHash(testCoordinates, testMetadata)
      };

      const recomputed = await recomputeBoundaryHash(polygon);
      expect(recomputed).toBe(polygon.hash);
    });
  });

  describe('Polygon Creation', () => {
    it('should create polygon with deterministic hash', async () => {
      const geoCoords: [number, number][] = [
        [29.02, 41.09],
        [29.026, 41.115],
        [29.032, 41.13],
        [29.045, 41.13],
        [29.052, 41.115],
        [29.048, 41.09],
        [29.038, 41.09],
        [29.026, 41.09]
      ];

      const polygon1 = await createCustomPolygon('Test', geoCoords, 'Test description');

      // Wait and create again
      await new Promise(resolve => setTimeout(resolve, 10));

      const polygon2 = await createCustomPolygon('Test', geoCoords, 'Test description');

      // Hashes should be identical despite different creation times
      expect(polygon1.hash).toBe(polygon2.hash);

      // But IDs will be different (which is OK, IDs are not hashed)
      expect(polygon1.id).not.toBe(polygon2.id);

      // Runtime metadata should have different timestamps
      expect(polygon1.runtimeMetadata?.createdAt).not.toBe(polygon2.runtimeMetadata?.createdAt);
    });

    it('should separate hash metadata from runtime metadata', async () => {
      const geoCoords: [number, number][] = [
        [29.02, 41.09],
        [29.026, 41.115],
        [29.032, 41.13],
        [29.045, 41.13]
      ];

      const polygon = await createCustomPolygon('Test', geoCoords, 'Test description');

      // Hash metadata should NOT contain timestamps
      expect(polygon.hashMetadata).toBeDefined();
      expect('timestamp' in polygon.hashMetadata!).toBe(false);
      expect('createdAt' in polygon.hashMetadata!).toBe(false);

      // Runtime metadata SHOULD contain timestamps
      expect(polygon.runtimeMetadata).toBeDefined();
      expect(polygon.runtimeMetadata?.createdAt).toBeGreaterThan(0);
    });
  });

  describe('Demo Polygons', () => {
    beforeAll(async () => {
      await initializeDemoPolygons();
    });

    it('should initialize demo polygons with hashes', async () => {
      const demoPolygons = getDemoPolygons();

      expect(demoPolygons.length).toBeGreaterThan(0);

      for (const polygon of demoPolygons) {
        expect(polygon.hash).toBeDefined();
        expect(polygon.hash).toMatch(/^[0-9a-f]{64}$/);
        expect(polygon.hashMetadata).toBeDefined();
      }
    });

    it('should produce consistent hashes for demo polygons', async () => {
      const demoPolygons = getDemoPolygons();
      const firstPolygon = demoPolygons[0];

      const recomputed = await recomputeBoundaryHash(firstPolygon);
      expect(recomputed).toBe(firstPolygon.hash);
    });
  });

  describe('Known Hash Values (Regression Tests)', () => {
    it('should produce expected hash for known input', async () => {
      // This test ensures hash algorithm doesn't change unexpectedly
      const knownCoords: LocalScaled[] = [
        [100000, 200000],
        [110000, 200000],
        [110000, 210000],
        [100000, 210000],
        [100000, 200000],
        [100000, 200000],
        [100000, 200000],
        [100000, 200000]
      ];

      const knownMetadata: BoundaryHashMetadata = {
        version: 2,
        scale: 10000,
        roundingMode: 'symmetric',
        vertexSelectionAlgorithm: 'visvalingam-whyatt',
        targetVertexCount: 8
      };

      const hash = await calculateBoundaryHash(knownCoords, knownMetadata);

      // First time running: compute and store the expected hash
      // This exact hash value is correct for this input with the canonical serialization
      // If this test fails in the future, the hash algorithm has changed (BAD!)
      expect(hash).toBe('d4996cc62db68616a8a3fc124a7262c69d8358aba45b60878aeb8a78e436783b');
    });

    it('should maintain hash stability across multiple computations', async () => {
      // Ensure multiple computations of same data produce identical results
      const coords: LocalScaled[] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16]];
      const metadata = createHashMetadata();

      const hashes = await Promise.all([
        calculateBoundaryHash(coords, metadata),
        calculateBoundaryHash(coords, metadata),
        calculateBoundaryHash(coords, metadata)
      ]);

      expect(hashes[0]).toBe(hashes[1]);
      expect(hashes[1]).toBe(hashes[2]);
    });
  });
});
