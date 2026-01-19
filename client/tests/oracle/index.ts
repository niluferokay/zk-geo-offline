/**
 * Geometry Oracle - Ground Truth for Point-in-Polygon Tests
 *
 * This module provides an INDEPENDENT, TRUSTED implementation of point-in-polygon
 * testing using Turf.js, a battle-tested computational geometry library.
 *
 * CRITICAL: This oracle is the GROUND TRUTH. All production code must match it.
 *
 * The oracle MUST NOT use any production geometry code from src/polygons.ts.
 * It is an independent verification mechanism.
 */

import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygon as turfPolygon, point as turfPoint } from '@turf/turf';
import type { Position, Polygon } from 'geojson';

/**
 * Oracle point-in-polygon test using Turf.js
 *
 * This is the GROUND TRUTH for all geometry tests.
 *
 * @param point - [longitude, latitude] in decimal degrees
 * @param polygonCoords - Array of [longitude, latitude] vertices
 * @param options - Optional configuration
 * @returns true if point is inside polygon, false otherwise
 */
export function oraclePointInPolygon(
  point: [number, number],
  polygonCoords: [number, number][],
  options: { ignoreBoundary?: boolean } = {}
): boolean {
  // Validate inputs
  if (!Array.isArray(point) || point.length !== 2) {
    throw new Error('Point must be [lon, lat] array');
  }

  if (!Array.isArray(polygonCoords) || polygonCoords.length < 3) {
    throw new Error('Polygon must have at least 3 vertices');
  }

  // Ensure polygon is closed for Turf.js
  const closedPolygon = [...polygonCoords];
  const first = closedPolygon[0];
  const last = closedPolygon[closedPolygon.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    closedPolygon.push(first); // Close the polygon
  }

  // Create Turf.js objects
  const turfPt = turfPoint(point as Position);
  const turfPoly = turfPolygon([closedPolygon as Position[]]);

  // Use Turf.js robust point-in-polygon algorithm
  return booleanPointInPolygon(turfPt, turfPoly, {
    ignoreBoundary: options.ignoreBoundary ?? false
  });
}

/**
 * Batch test multiple points against a polygon
 *
 * @param points - Array of [lon, lat] points
 * @param polygonCoords - Polygon vertices
 * @returns Array of boolean results (same length as points)
 */
export function oracleBatchTest(
  points: [number, number][],
  polygonCoords: [number, number][]
): boolean[] {
  return points.map(point => oraclePointInPolygon(point, polygonCoords));
}

/**
 * Test if two polygons have the same inside/outside behavior for a set of points
 *
 * This is used to verify that polygon normalization preserves geometry.
 *
 * @param points - Test points
 * @param polygon1 - First polygon
 * @param polygon2 - Second polygon (e.g., normalized version)
 * @returns true if both polygons classify all points identically
 */
export function oraclePolygonsEquivalent(
  points: [number, number][],
  polygon1: [number, number][],
  polygon2: [number, number][]
): boolean {
  const results1 = oracleBatchTest(points, polygon1);
  const results2 = oracleBatchTest(points, polygon2);

  return results1.every((r, i) => r === results2[i]);
}

/**
 * Get a detailed report of point classifications
 *
 * @param points - Test points with labels
 * @param polygonCoords - Polygon vertices
 * @returns Detailed classification report
 */
export interface PointClassification {
  point: [number, number];
  label: string;
  inside: boolean;
}

export function oracleClassifyPoints(
  points: Array<{ point: [number, number]; label: string }>,
  polygonCoords: [number, number][]
): PointClassification[] {
  return points.map(({ point, label }) => ({
    point,
    label,
    inside: oraclePointInPolygon(point, polygonCoords)
  }));
}

/**
 * Validate that a polygon is simple (non-self-intersecting)
 *
 * Note: Turf.js doesn't have built-in simplicity check, so this is a basic heuristic.
 * For production use, consider more robust algorithms.
 *
 * @param polygonCoords - Polygon vertices
 * @returns true if polygon appears to be simple
 */
export function oracleIsSimplePolygon(
  polygonCoords: [number, number][]
): boolean {
  // Basic check: Use Turf's kinks (self-intersection) detection
  const { kinks } = require('@turf/turf');
  const closedPolygon = [...polygonCoords, polygonCoords[0]];
  const poly = turfPolygon([closedPolygon as Position[]]);

  try {
    const kinksResult = kinks(poly);
    return kinksResult.features.length === 0; // No intersections = simple
  } catch (error) {
    // If kinks detection fails, assume not simple
    console.warn('Oracle simplicity check failed:', error);
    return false;
  }
}

/**
 * Calculate polygon area using Turf.js
 *
 * @param polygonCoords - Polygon vertices
 * @returns Signed area (positive for CCW, negative for CW)
 */
export function oraclePolygonArea(
  polygonCoords: [number, number][]
): number {
  const { area } = require('@turf/turf');
  const closedPolygon = [...polygonCoords, polygonCoords[0]];
  const poly = turfPolygon([closedPolygon as Position[]]);

  return area(poly);
}

/**
 * Check if a polygon is counter-clockwise oriented
 *
 * @param polygonCoords - Polygon vertices
 * @returns true if CCW, false if CW
 */
export function oracleIsCCW(
  polygonCoords: [number, number][]
): boolean {
  // Use shoelace formula
  let sum = 0;
  const n = polygonCoords.length;

  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygonCoords[i];
    const [x2, y2] = polygonCoords[(i + 1) % n];
    sum += (x2 - x1) * (y2 + y1);
  }

  return sum < 0; // Negative sum = CCW in geographic coordinates
}

/**
 * Export oracle metadata for debugging
 */
export const ORACLE_INFO = {
  name: 'Turf.js Geometry Oracle',
  version: '7.3.1',
  algorithm: 'Ray casting with robust predicates',
  purpose: 'Ground truth for ZK geofencing tests',
  trustLevel: 'HIGH - battle-tested in production worldwide'
};

/**
 * Oracle validation function
 *
 * Run this to ensure the oracle itself is working correctly.
 */
export function validateOracle(): void {
  // Test 1: Point clearly inside a square
  const square: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1]
  ];

  const insidePoint: [number, number] = [0, 0];
  const outsidePoint: [number, number] = [2, 2];

  if (!oraclePointInPolygon(insidePoint, square)) {
    throw new Error('Oracle validation failed: Center point should be inside square');
  }

  if (oraclePointInPolygon(outsidePoint, square)) {
    throw new Error('Oracle validation failed: External point should be outside square');
  }

  // Test 2: Concave polygon (L-shape)
  const lShape: [number, number][] = [
    [0, 3],
    [1, 3],
    [1, 1],
    [3, 1],
    [3, 0],
    [0, 0]
  ];

  const insideLShape: [number, number] = [0.5, 2.5];
  const outsideLShape: [number, number] = [2, 2]; // In the notch

  if (!oraclePointInPolygon(insideLShape, lShape)) {
    throw new Error('Oracle validation failed: Point in L-shape top rectangle should be inside');
  }

  if (oraclePointInPolygon(outsideLShape, lShape)) {
    throw new Error('Oracle validation failed: Point in L-shape notch should be outside');
  }

  console.log('✓ Oracle validation passed');
}

// Run validation on module load (in test environment only)
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  try {
    validateOracle();
  } catch (error) {
    console.error('⚠️  Oracle validation failed:', error);
    throw error;
  }
}
