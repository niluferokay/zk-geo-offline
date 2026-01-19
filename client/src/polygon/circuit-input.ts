/**
 * Circuit input preparation and validation
 *
 * Includes:
 * - GeoJSON parsing with security validation
 * - Boundary safety distance checks
 * - Circuit coordinate validation
 * - Point adjustment for ray-tracing degeneracy
 * - Final preparation for ZK circuit proof generation
 */

import type { GeoDegrees, LocalScaled, CircuitGrid, Polygon } from './types';
import { geoDegreesToLocalScaledPoint, localScaledToCircuitGrid, metersPerDegreeLat, metersPerDegreeLon } from './normalization';

// ============================================================================
// GEOJSON PARSING & VALIDATION
// ============================================================================

/**
 * Assert that a value is a finite number
 */
function assertFiniteNumber(n: unknown, name: string): asserts n is number {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new Error(`Invalid ${name}: must be a finite number, got ${typeof n}`);
  }
}

/**
 * SECURITY: Validate longitude and latitude values
 */
function validateLonLat(lon: unknown, lat: unknown): void {
  assertFiniteNumber(lon, 'longitude');
  assertFiniteNumber(lat, 'latitude');

  if (lon < -180 || lon > 180) {
    throw new Error(`Longitude out of range: ${lon} (must be between -180 and 180)`);
  }

  if (lat < -90 || lat > 90) {
    throw new Error(`Latitude out of range: ${lat} (must be between -90 and 90)`);
  }
}

/**
 * Parse GeoJSON and extract GeoDegrees coordinates
 * SECURITY: Includes strict validation to prevent malicious inputs
 */
export function parseGeoJSON(geojson: any, maxVertices: number = 500): GeoDegrees[] {
  if (!geojson || !geojson.type) {
    throw new Error('Invalid GeoJSON format: missing type field');
  }

  // SECURITY: Validate GeoJSON is not too large (prevent memory exhaustion)
  const jsonSize = JSON.stringify(geojson).length;
  const MAX_SIZE = 1024 * 1024; // 1MB limit
  if (jsonSize > MAX_SIZE) {
    throw new Error(`GeoJSON file too large: ${(jsonSize / 1024).toFixed(0)}KB (max ${MAX_SIZE / 1024}KB)`);
  }

  let coordinates: number[][] = [];

  if (geojson.type === 'Polygon') {
    if (geojson.coordinates.length > 1) {
      console.warn('GeoJSON polygon contains holes - only outer ring will be used');
    }
    coordinates = geojson.coordinates[0];
  } else if (geojson.type === 'Feature' && geojson.geometry?.type === 'Polygon') {
    if (geojson.geometry.coordinates.length > 1) {
      console.warn('GeoJSON polygon contains holes - only outer ring will be used');
    }
    coordinates = geojson.geometry.coordinates[0];
  } else if (geojson.type === 'FeatureCollection') {
    const firstPolygon = geojson.features.find((f: any) => f.geometry?.type === 'Polygon');
    if (!firstPolygon) {
      throw new Error('No Polygon feature found in FeatureCollection');
    }
    if (firstPolygon.geometry.coordinates.length > 1) {
      console.warn('GeoJSON polygon contains holes - only outer ring will be used');
    }
    coordinates = firstPolygon.geometry.coordinates[0];
  } else {
    throw new Error(`Unsupported GeoJSON type: ${geojson.type}`);
  }

  // SECURITY: Validate minimum vertex count
  if (coordinates.length < 3) {
    throw new Error('Polygon must have at least 3 vertices');
  }

  // SECURITY: Limit maximum vertices to prevent DoS and memory exhaustion
  if (coordinates.length > maxVertices) {
    throw new Error(
      `Polygon has too many vertices: ${coordinates.length} (max ${maxVertices}). ` +
      `Simplify the polygon before uploading.`
    );
  }

  // SECURITY: Validate each coordinate is a finite number in valid GPS range
  return coordinates.map(([lon, lat], index) => {
    try {
      validateLonLat(lon, lat);
      return [lon, lat] as GeoDegrees;
    } catch (error) {
      throw new Error(
        `Invalid coordinate at index ${index}: ${error instanceof Error ? error.message : 'unknown error'}`
      );
    }
  });
}

// ============================================================================
// BOUNDARY SAFETY CHECKS
// ============================================================================

/**
 * Calculate the minimum distance from a point to a line segment
 */
function pointToSegmentDistance(
  point: readonly [number, number],
  segStart: readonly [number, number],
  segEnd: readonly [number, number]
): number {
  const [px, py] = point;
  const [x1, y1] = segStart;
  const [x2, y2] = segEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const denom = dx * dx + dy * dy;

  // SECURITY: Guard against zero-length segments
  if (denom === 0) {
    const ax = px - x1;
    const ay = py - y1;
    return Math.sqrt(ax * ax + ay * ay);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / denom));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Calculate minimum distance from a point to any edge of a polygon
 */
export function distanceToPolygonEdge(
  point: LocalScaled,
  polygon: LocalScaled[]
): number {
  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const segStart = polygon[i];
    const segEnd = polygon[(i + 1) % polygon.length];
    const distance = pointToSegmentDistance(point, segStart, segEnd);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Check if a point is within a safe distance from polygon edges
 * SECURITY: Uses latitude-aware conversion for accuracy
 */
export function checkBoundarySafety(
  point: LocalScaled,
  polygon: LocalScaled[],
  safetyDistanceMeters: number = 20,
  userLatDegrees?: number
): { isSafe: boolean; distanceMeters: number; distanceUnits: number } {
  const distanceUnits = distanceToPolygonEdge(point, polygon);

  let metersPerUnit: number;
  if (userLatDegrees !== undefined) {
    const metersPerLatUnit = metersPerDegreeLat(userLatDegrees) * 0.0001;
    const metersPerLonUnit = metersPerDegreeLon(userLatDegrees) * 0.0001;
    metersPerUnit = (metersPerLatUnit + metersPerLonUnit) / 2;
  } else {
    metersPerUnit = 11.132; // Equatorial approximation
  }

  const distanceMeters = distanceUnits * metersPerUnit;

  return {
    isSafe: distanceMeters >= safetyDistanceMeters,
    distanceMeters,
    distanceUnits
  };
}

// ============================================================================
// CIRCUIT COORDINATE VALIDATION
// ============================================================================

/**
 * Adjust point y-coordinate if it equals any polygon vertex y-coordinate
 * Prevents circuit from rejecting proofs due to ray-tracing degeneracy
 */
export function adjustPointForCircuit(
  point: CircuitGrid,
  polygon: CircuitGrid[]
): { adjustedPoint: CircuitGrid; wasAdjusted: boolean; adjustment: number } {
  const [px, py] = point;
  const polygonYValues = polygon.map(v => v[1]);

  if (polygonYValues.includes(py)) {
    return {
      adjustedPoint: [px, py + 1] as CircuitGrid,
      wasAdjusted: true,
      adjustment: 1
    };
  }

  return {
    adjustedPoint: point,
    wasAdjusted: false,
    adjustment: 0
  };
}

/**
 * Validate that CircuitGrid coordinates are within uint32 range
 */
export function validateCircuitGridBounds(
  point: CircuitGrid,
  polygon: CircuitGrid[]
): { valid: boolean; min: number; max: number; allowedMax: number } {
  const allowedMax = Math.pow(2, 32) - 1;
  const all = [point, ...polygon].flat();
  const max = Math.max(...all);
  const min = Math.min(...all);

  return {
    valid: max <= allowedMax && min >= 0,
    min,
    max,
    allowedMax,
  };
}

// ============================================================================
// MAIN CIRCUIT INPUT PREPARATION
// ============================================================================

/**
 * Prepare coordinates for circuit proof generation
 *
 * Input: GeoDegrees user location + Polygon with LocalScaled coordinates
 * Output: CircuitGrid coordinates ready for the ZK circuit
 *
 * SAFETY CHECKS:
 * - Verifies user is not too close to polygon boundary (20m safety buffer)
 * - Adjusts point y-coordinate if it conflicts with polygon vertex y-coordinates
 * - Ensures all coordinates are within uint32 range
 *
 * @param userLat - User's latitude in decimal degrees
 * @param userLon - User's longitude in decimal degrees
 * @param polygon - Polygon with normalized 8-vertex coordinates
 * @param safetyDistanceMeters - Minimum distance from edges (default: 20m)
 * @returns Circuit-ready coordinates and safety metadata
 * @throws Error if user is too close to polygon boundary
 * @throws Error if coordinates exceed uint32 range
 */
export function prepareCircuitInput(
  userLat: number,
  userLon: number,
  polygon: Polygon,
  safetyDistanceMeters: number = 20
): {
  point: CircuitGrid;
  polygon: CircuitGrid[];
  boundarySafety: { isSafe: boolean; distanceMeters: number };
  pointAdjustment: { wasAdjusted: boolean; adjustment: number };
} {
  // Convert user location to LocalScaled
  const userPoint = geoDegreesToLocalScaledPoint(
    userLat,
    userLon,
    polygon.lonOffset || 0,
    polygon.latOffset || 0
  );

  // Check boundary safety (BEFORE circuit conversion)
  const boundarySafety = checkBoundarySafety(
    userPoint,
    polygon.coordinates,
    safetyDistanceMeters,
    userLat
  );

  if (!boundarySafety.isSafe) {
    throw new Error(
      `User location is too close to polygon boundary (${boundarySafety.distanceMeters.toFixed(1)}m). ` +
      `Minimum safe distance is ${safetyDistanceMeters}m. ` +
      `This safety margin absorbs quantization errors.`
    );
  }

  // Convert to CircuitGrid
  const { point, polygon: polygonGrid } = localScaledToCircuitGrid(
    userPoint,
    polygon.coordinates
  );

  // Adjust point if y-coordinate conflicts with polygon vertices
  const { adjustedPoint, wasAdjusted, adjustment } = adjustPointForCircuit(
    point,
    polygonGrid
  );

  // Validate uint32 range
  const validation = validateCircuitGridBounds(adjustedPoint, polygonGrid);
  if (!validation.valid) {
    throw new Error(
      `Coordinates exceed uint32 range: min=${validation.min}, max=${validation.max}, ` +
      `allowed max=${validation.allowedMax}`
    );
  }

  return {
    point: adjustedPoint,
    polygon: polygonGrid,
    boundarySafety: {
      isSafe: boundarySafety.isSafe,
      distanceMeters: boundarySafety.distanceMeters
    },
    pointAdjustment: {
      wasAdjusted,
      adjustment
    }
  };
}
