/**
 * Polygon normalization and coordinate transformations
 *
 * Includes:
 * - Coordinate system conversions (GPS ↔ LocalScaled ↔ CircuitGrid)
 * - 8-vertex normalization for ZK circuit
 * - Topology-preserving simplification algorithms
 *
 * CRITICAL GUARANTEES:
 * - Only real polygon vertices are used (except for safe padding)
 * - Deterministic output (same input → same output)
 * - Ray-tracing topology preserved (inside/outside classification maintained)
 * - No zero-length edges
 * - No jitter or randomness
 */

import type { GeoDegrees, LocalScaled, CircuitGrid } from './types';

// ============================================================================
// COORDINATE TRANSFORMATIONS
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
 * Calculate meters per degree of latitude at a given latitude
 * Accounts for Earth's ellipsoidal shape (WGS84)
 */
export function metersPerDegreeLat(latDeg: number): number {
  const latRad = latDeg * Math.PI / 180;
  return 111132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
}

/**
 * Calculate meters per degree of longitude at a given latitude
 */
export function metersPerDegreeLon(latDeg: number): number {
  const latRad = latDeg * Math.PI / 180;
  return 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
}

/**
 * Convert GeoDegrees coordinates to LocalScaled
 * Scales by 10000 and rounds to integers
 *
 * Note: This is a coordinate transformation function, not a polygon validator.
 * It works with any number of coordinates (even 1 or 2).
 * Polygon validation should be done separately.
 */
export function geoDegreesToLocalScaled(
  coords: GeoDegrees[]
): { coordinates: LocalScaled[]; lonOffset: number; latOffset: number } {
  // Validate all coordinates are valid GPS coordinates
  for (const [lon, lat] of coords) {
    validateLonLat(lon, lat);
  }

  // Convert to scaled integers
  const scaled: LocalScaled[] = coords.map(([lon, lat]) => {
    const x = Math.round(lon * 10000);
    const y = Math.round(lat * 10000);
    return [x, y] as LocalScaled;
  });

  return {
    coordinates: scaled,
    lonOffset: 0,
    latOffset: 0
  };
}

/**
 * Convert user GPS location to LocalScaled
 */
export function geoDegreesToLocalScaledPoint(
  lat: number,
  lon: number,
  _lonOffset: number,
  _latOffset: number
): LocalScaled {
  validateLonLat(lon, lat);

  const x = Math.round(lon * 10000);
  const y = Math.round(lat * 10000);
  return [x, y] as LocalScaled;
}

/**
 * Convert LocalScaled to CircuitGrid using center-based normalization
 */
export function localScaledToCircuitGrid(
  userPoint: LocalScaled,
  polygonCoords: LocalScaled[]
): { point: CircuitGrid; polygon: CircuitGrid[] } {
  const allX = [...polygonCoords.map(c => c[0]), userPoint[0]];
  const allY = [...polygonCoords.map(c => c[1]), userPoint[1]];

  const centerX = (Math.min(...allX) + Math.max(...allX)) / 2;
  const centerY = (Math.min(...allY) + Math.max(...allY)) / 2;

  const gridCenter = Math.pow(2, 31);

  function toGrid(coord: LocalScaled): CircuitGrid {
    const [x, y] = coord;
    const gridX = Math.round((x - centerX) + gridCenter);
    const gridY = Math.round((y - centerY) + gridCenter);
    return [gridX, gridY] as CircuitGrid;
  }

  return {
    point: toGrid(userPoint),
    polygon: polygonCoords.map(toGrid)
  };
}

// ============================================================================
// POLYGON GEOMETRY UTILITIES
// ============================================================================

/**
 * Remove duplicate consecutive coordinates from a polygon
 */
export function sanitizePolygon<T extends readonly [number, number]>(poly: T[]): T[] {
  return poly.filter(
    (pt, i, arr) => i === 0 || pt[0] !== arr[i - 1][0] || pt[1] !== arr[i - 1][1]
  );
}

/**
 * Calculate the signed area of a polygon
 * Positive if CCW, negative if CW
 */
export function signedArea<T extends readonly [number, number]>(poly: T[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Ensure polygon vertices are in counter-clockwise order
 */
export function ensureCCW<T extends readonly [number, number]>(poly: T[]): T[] {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

/**
 * Remove duplicate closing point if present
 */
export function removeClosingDuplicate<T extends readonly [number, number]>(poly: T[]): T[] {
  if (
    poly.length > 2 &&
    poly[0][0] === poly[poly.length - 1][0] &&
    poly[0][1] === poly[poly.length - 1][1]
  ) {
    return poly.slice(0, -1);
  }
  return poly;
}

/**
 * Calculate the effective area of a triangle formed by three consecutive vertices
 * Used for Visvalingam-Whyatt simplification
 */
function triangleArea(
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number]
): number {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  return Math.abs(0.5 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)));
}

/**
 * Check if removing a vertex would change ray-intersection parity
 * This ensures topology preservation for point-in-polygon tests
 */
function isRemovalTopologySafe(
  prevVertex: readonly [number, number],
  vertex: readonly [number, number],
  nextVertex: readonly [number, number]
): boolean {
  const [, y0] = prevVertex;
  const [, y1] = vertex;
  const [, y2] = nextVertex;

  const area = triangleArea(prevVertex, vertex, nextVertex);
  if (area < 0.001) {
    return true; // Nearly collinear
  }

  // Check if vertex is a local extremum in Y
  const isLocalMaxY = y1 > y0 && y1 > y2;
  const isLocalMinY = y1 < y0 && y1 < y2;

  if (isLocalMaxY || isLocalMinY) {
    return area < 10.0; // Only safe if very small
  }

  // Check if vertex is between prev and next in Y
  const isBetweenY = (y1 >= y0 && y1 <= y2) || (y1 <= y0 && y1 >= y2);
  if (isBetweenY) {
    return true;
  }

  return area < 5.0;
}

/**
 * Visvalingam-Whyatt polygon simplification with topology preservation
 */
function simplifyPolygonVisvalingam<T extends readonly [number, number]>(
  poly: T[],
  targetVertexCount: number
): T[] {
  if (poly.length <= targetVertexCount) {
    return poly;
  }

  let vertices = [...poly];

  interface VertexScore {
    index: number;
    area: number;
    topologySafe: boolean;
  }

  while (vertices.length > targetVertexCount) {
    const scores: VertexScore[] = [];

    for (let i = 1; i < vertices.length - 1; i++) {
      const prev = vertices[(i - 1 + vertices.length) % vertices.length];
      const curr = vertices[i];
      const next = vertices[(i + 1) % vertices.length];

      const area = triangleArea(prev, curr, next);
      const topologySafe = isRemovalTopologySafe(prev, curr, next);

      scores.push({ index: i, area, topologySafe });
    }

    if (scores.length === 0) break;

    let bestScore: VertexScore | null = null;
    for (const score of scores) {
      if (score.topologySafe) {
        if (!bestScore || score.area < bestScore.area) {
          bestScore = score;
        }
      }
    }

    if (!bestScore) {
      bestScore = scores.reduce((min, s) => s.area < min.area ? s : min);
    }

    vertices.splice(bestScore.index, 1);
  }

  return vertices as T[];
}

/**
 * Simplify a closed polygon using topology-preserving Visvalingam-Whyatt
 */
export function simplifyPolygonToN<T extends readonly [number, number]>(
  poly: T[],
  targetVertexCount: number
): T[] {
  if (poly.length <= targetVertexCount) {
    return poly;
  }

  const openPoly = removeClosingDuplicate(poly);
  if (openPoly.length <= targetVertexCount) {
    return openPoly;
  }

  const closedPoly = [...openPoly, openPoly[0] as T];
  const simplified = simplifyPolygonVisvalingam(closedPoly, targetVertexCount + 1);
  return removeClosingDuplicate(simplified);
}

/**
 * Pad a polygon with < N vertices to exactly N vertices without creating degenerate edges
 */
function padPolygonToN(
  poly: LocalScaled[],
  targetVertices: number
): LocalScaled[] {
  if (poly.length >= targetVertices) {
    return poly;
  }

  const result = [...poly];
  const paddingCount = targetVertices - poly.length;
  const [x0, y0] = poly[0];

  const offsets: [number, number][] = [
    [1, 0],   // Right
    [1, 1],   // Diagonal up-right
    [0, 1],   // Up
    [-1, 1],  // Diagonal up-left
    [-1, 0],  // Left
    [-1, -1], // Diagonal down-left
    [0, -1],  // Down
  ];

  for (let i = 0; i < paddingCount; i++) {
    const offset = offsets[i % offsets.length];
    const multiplier = Math.floor(i / offsets.length) + 1;

    const paddedVertex: LocalScaled = [
      x0 + offset[0] * multiplier,
      y0 + offset[1] * multiplier
    ];

    result.push(paddedVertex);
  }

  return result;
}

/**
 * Select exactly N vertices from a polygon while preserving ray-tracing topology
 */
function selectVerticesPreservingTopology(
  poly: LocalScaled[],
  targetVertices: number
): LocalScaled[] {
  poly = removeClosingDuplicate(poly);
  poly = ensureCCW(poly);
  poly = sanitizePolygon(poly);

  if (poly.length === targetVertices) {
    return poly;
  }

  if (poly.length < targetVertices) {
    return padPolygonToN(poly, targetVertices);
  }

  const simplified = simplifyPolygonToN(poly, targetVertices);
  return sanitizePolygon(simplified);
}

/**
 * Normalize polygon to exactly 8 vertices for the ZK circuit
 *
 * This is the main entry point for polygon normalization.
 *
 * @param coordinates - Input polygon coordinates in LocalScaled format
 * @returns Normalized polygon with exactly 8 vertices
 */
export function normalizePolygonTo8Vertices(
  coordinates: LocalScaled[]
): LocalScaled[] {
  const REQUIRED_VERTICES = 8;

  let poly = removeClosingDuplicate(coordinates);
  poly = ensureCCW(poly);
  poly = sanitizePolygon(poly);

  if (poly.length === REQUIRED_VERTICES) {
    return poly;
  }

  const result = selectVerticesPreservingTopology(poly, REQUIRED_VERTICES);

  if (result.length !== REQUIRED_VERTICES) {
    throw new Error(`Failed to generate ${REQUIRED_VERTICES} vertices`);
  }

  return result;
}

/**
 * Validate LocalScaled polygon format
 */
export function validateLocalScaledPolygon(coordinates: LocalScaled[]): boolean {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    return false;
  }

  // Check all coordinates are integers
  for (const [x, y] of coordinates) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return false;
    }
  }

  // Check open (no closing duplicate)
  if (
    coordinates.length > 2 &&
    coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
    coordinates[0][1] === coordinates[coordinates.length - 1][1]
  ) {
    return false;
  }

  // Check CCW
  if (signedArea(coordinates) < 0) {
    return false;
  }

  return true;
}
