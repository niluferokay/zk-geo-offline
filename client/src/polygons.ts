/**
 * Polygon management system for ZK geofencing demo
 * Supports demo projects and custom polygon uploads
 *
 * COORDINATE SYSTEM TYPES:
 * - GeoDegrees: Raw GPS coordinates [longitude, latitude] in decimal degrees (floats)
 * - LocalScaled: Origin-relative coordinates [x, y] scaled by 10000 (integers)
 * - CircuitGrid: Coordinates in uint32 grid space [x, y] (integers 0 to 2^32-1)
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Raw GPS coordinates in decimal degrees [longitude, latitude] */
export type GeoDegrees = readonly [lon: number, lat: number];

/** Origin-relative coordinates scaled by 10000 [x, y] */
export type LocalScaled = readonly [x: number, y: number];

/** Coordinates in uint32 grid space [x, y] */
export type CircuitGrid = readonly [x: number, y: number];

export interface Polygon {
  id: string;
  name: string;
  description: string;
  /** Polygon coordinates - must be LocalScaled integers, open (no closing duplicate), CCW */
  coordinates: LocalScaled[];
  /** SHA-256 hash computed AFTER 8-vertex normalization */
  hash?: string;
  /** Longitude offset for converting GeoDegrees to LocalScaled */
  lonOffset?: number;
  /** Latitude offset for converting GeoDegrees to LocalScaled */
  latOffset?: number;
}

// ============================================================================
// DEMO POLYGONS (LocalScaled test fixtures)
// ============================================================================

/**
 * Demo polygon A - LocalScaled test fixture (NOT real GPS coordinates)
 * These are pre-scaled integer coordinates for testing without GPS
 */
const DEMO_FOREST_A: Polygon = {
  id: 'demo-forest-a',
  name: 'Demo Forest A',
  description: 'Test polygon',
  coordinates: [
    [290200, 411000],
    [290260, 411150],
    [290320, 411300],
    [290450, 411300],
    [290520, 411150],
    [290480, 411000],
    [290380, 410900],
    [290260, 410900]
  ] as LocalScaled[],
  lonOffset: 29.02,
  latOffset: 41.09
};

/**
 * Demo polygon B - LocalScaled test fixture (NOT real GPS coordinates)
 * These are pre-scaled integer coordinates for testing without GPS
 */
const DEMO_FOREST_B: Polygon = {
  id: 'demo-forest-b',
  name: 'Demo Forest B',
  description: 'Test polygon',
  coordinates: [
    [290300, 411200],
    [290400, 411300],
    [290500, 411300],
    [290600, 411200],
    [290600, 411500],
    [290500, 411600],
    [290400, 411600],
    [290300, 411500]
  ] as LocalScaled[],
  lonOffset: 29.02,
  latOffset: 41.09
};

export const DEMO_POLYGONS: Polygon[] = [
  DEMO_FOREST_A,
  DEMO_FOREST_B
];

// ============================================================================
// HASHING
// ============================================================================

/**
 * Calculate SHA-256 hash of polygon coordinates
 * IMPORTANT: Hash is computed AFTER 8-vertex normalization
 */
export async function calculatePolygonHash(coordinates: LocalScaled[]): Promise<string> {
  const coordString = JSON.stringify(coordinates);
  const msgBuffer = new TextEncoder().encode(coordString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

/**
 * Convert GeoDegrees polygon to LocalScaled (absolute scaled format)
 * Scales by 10000 and rounds to integers
 */
export function geoDegreesToLocalScaled(
  coords: GeoDegrees[]
): { coordinates: LocalScaled[]; lonOffset: number; latOffset: number } {
  if (coords.length < 3) {
    throw new Error('Polygon must have at least 3 vertices');
  }

  // Convert to absolute scaled
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
 * Convert user GPS location to LocalScaled (absolute scaled format)
 */
export function geoDegreesToLocalScaledPoint(
  lat: number,
  lon: number,
  _lonOffset: number,
  _latOffset: number
): LocalScaled {
  const x = Math.round(lon * 10000);
  const y = Math.round(lat * 10000);
  return [x, y] as LocalScaled;
}

/**
 * Convert LocalScaled to CircuitGrid using center-based normalization
 * Uses center of 32-bit space for maximum range
 */
export function localScaledToCircuitGrid(
  userPoint: LocalScaled,
  polygonCoords: LocalScaled[]
): { point: CircuitGrid; polygon: CircuitGrid[] } {
  // Find bounding box including user point
  const allX = [...polygonCoords.map(c => c[0]), userPoint[0]];
  const allY = [...polygonCoords.map(c => c[1]), userPoint[1]];

  const centerX = (Math.min(...allX) + Math.max(...allX)) / 2;
  const centerY = (Math.min(...allY) + Math.max(...allY)) / 2;

  const gridCenter = Math.pow(2, 31); // Center of 32-bit space

  function toGrid(coord: LocalScaled): CircuitGrid {
    const [x, y] = coord;
    const gridX = Math.floor((x - centerX) + gridCenter);
    const gridY = Math.floor((y - centerY) + gridCenter);
    return [gridX, gridY] as CircuitGrid;
  }

  return {
    point: toGrid(userPoint),
    polygon: polygonCoords.map(toGrid)
  };
}

// ============================================================================
// GEOJSON PARSING
// ============================================================================

/**
 * Parse GeoJSON and extract GeoDegrees coordinates
 * REJECTS polygons with holes (only outer ring is preserved with warning)
 */
export function parseGeoJSON(geojson: any): GeoDegrees[] {
  if (!geojson || !geojson.type) {
    throw new Error('Invalid GeoJSON format');
  }

  let coordinates: number[][] = [];

  if (geojson.type === 'Polygon') {
    // GeoJSON Polygon: coordinates[0] is outer ring, [1+] are holes
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

  // Validate and return as GeoDegrees
  if (coordinates.length < 3) {
    throw new Error('Polygon must have at least 3 vertices');
  }

  return coordinates.map(([lon, lat]) => {
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      throw new Error('Invalid coordinate format');
    }
    return [lon, lat] as GeoDegrees;
  });
}

// ============================================================================
// POLYGON GEOMETRY OPERATIONS
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
 * Creates a safe 8-sided polygon from any input polygon
 * - Open (no duplicate closing point)
 * - Counter-clockwise order
 * - Vertices evenly distributed along perimeter
 * - Small jitter applied (may not fully prevent axis-aligned edges after rounding)
 *
 * NOTE: After rounding to integers, some edges may still be axis-aligned.
 * The jitter reduces but does not eliminate this possibility.
 */
export function makeSafeEightPolygon(poly: LocalScaled[]): LocalScaled[] {
  // Remove closing duplicate
  poly = removeClosingDuplicate(poly);

  // Ensure CCW
  poly = ensureCCW(poly);

  // Build edges with lengths
  const edges: Array<{
    p1: LocalScaled;
    p2: LocalScaled;
    dx: number;
    dy: number;
    len: number;
  }> = [];
  let totalLength = 0;

  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy);

    edges.push({ p1, p2, dx, dy, len });
    totalLength += len;
  }

  // Sample 8 evenly spaced perimeter distances
  const result: LocalScaled[] = [];
  for (let i = 0; i < 8; i++) {
    const targetDist = (i / 8) * totalLength;

    // Walk perimeter until we reach the arc length
    let acc = 0;
    for (const e of edges) {
      if (acc + e.len >= targetDist) {
        const t = (targetDist - acc) / e.len;

        let x = e.p1[0] + e.dx * t;
        let y = e.p1[1] + e.dy * t;

        // Small jitter to reduce (but not eliminate) axis-aligned edges
        const ε = 0.5;
        x += (i % 2 === 0 ? ε : -ε);
        y += (i % 2 === 1 ? ε : -ε);

        result.push([Math.round(x), Math.round(y)] as LocalScaled);
        break;
      }
      acc += e.len;
    }
  }

  return ensureCCW(result);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate LocalScaled polygon
 * - Must have at least 3 vertices
 * - All coordinates must be integers
 * - Open (no duplicate closing point)
 * - Counter-clockwise order
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
    return false; // Has closing duplicate
  }

  // Check CCW
  if (signedArea(coordinates) < 0) {
    return false; // Clockwise
  }

  return true;
}

/**
 * Validate that CircuitGrid coordinates are within uint32 range
 * 0 ≤ x ≤ 2^32 - 1
 */
export function validateCircuitGridBounds(
  point: CircuitGrid,
  polygon: CircuitGrid[]
): { valid: boolean; min: number; max: number; allowedMax: number } {
  const allowedMax = Math.pow(2, 32) - 1; // Full uint32 range
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
// 8-VERTEX NORMALIZATION
// ============================================================================

/**
 * Normalize polygon to exactly 8 vertices for the ZK circuit
 * Input: LocalScaled (integers)
 * Output: LocalScaled (integers), open, CCW, exactly 8 vertices
 *
 * Uses safe polygon generation for all cases to ensure:
 * - Even distribution of vertices
 * - No duplicate vertices
 * - Proper geometry
 */
export function normalizePolygonTo8Vertices(coordinates: LocalScaled[]): LocalScaled[] {
  const REQUIRED_VERTICES = 8;

  // Ensure open and CCW
  let poly = removeClosingDuplicate(coordinates);
  poly = ensureCCW(poly);

  if (poly.length === REQUIRED_VERTICES) {
    // Already correct length, just ensure properties
    return sanitizePolygon(poly);
  }

  // Use safe generation for all other cases
  const result = makeSafeEightPolygon(poly);

  // Verify output
  if (result.length !== REQUIRED_VERTICES) {
    throw new Error(`Failed to generate ${REQUIRED_VERTICES} vertices`);
  }

  return result;
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * Create a custom polygon from user input
 * Input: GeoDegrees coordinates
 * Output: Polygon with LocalScaled coordinates, normalized to 8 vertices
 */
export async function createCustomPolygon(
  name: string,
  geoCoords: GeoDegrees[],
  description?: string
): Promise<Polygon> {
  // Convert GeoDegrees to LocalScaled
  const { coordinates, lonOffset, latOffset } = geoDegreesToLocalScaled(geoCoords);

  // Normalize to 8 vertices
  const normalized = normalizePolygonTo8Vertices(coordinates);

  // Validate output
  if (!validateLocalScaledPolygon(normalized)) {
    throw new Error('Generated polygon failed validation');
  }

  // Hash is computed AFTER 8-vertex normalization
  const hash = await calculatePolygonHash(normalized);

  return {
    id: `custom-${Date.now()}`,
    name,
    description: description || 'Custom polygon',
    coordinates: normalized,
    hash,
    lonOffset,
    latOffset
  };
}

/**
 * Prepare coordinates for circuit proof generation
 * Input: GeoDegrees user location + Polygon with LocalScaled coordinates
 * Output: CircuitGrid coordinates ready for the ZK circuit
 */
export function prepareCircuitInput(
  userLat: number,
  userLon: number,
  polygon: Polygon
): { point: CircuitGrid; polygon: CircuitGrid[] } {
  // Convert user location to LocalScaled
  const userPoint = geoDegreesToLocalScaledPoint(
    userLat,
    userLon,
    polygon.lonOffset || 0,
    polygon.latOffset || 0
  );

  // Convert to CircuitGrid
  return localScaledToCircuitGrid(userPoint, polygon.coordinates);
}

// ============================================================================
// STORAGE
// ============================================================================

export function saveSelectedPolygon(polygon: Polygon): void {
  localStorage.setItem('selectedPolygon', JSON.stringify(polygon));
}

export function loadSelectedPolygon(): Polygon | null {
  const stored = localStorage.getItem('selectedPolygon');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function getCurrentPolygon(): Polygon {
  return loadSelectedPolygon() || DEMO_POLYGONS[0];
}
