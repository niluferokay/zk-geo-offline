/**
 * Polygon management system for ZK geofencing demo
 * Supports demo projects and custom polygon uploads
 */

export interface Polygon {
  id: string;
  name: string;
  description: string;
  coordinates: number[][]; // [lon, lat] pairs scaled by 10000
  hash?: string;
}

// Demo polygon 1: Small square (Houston area)
const DEMO_SQUARE: Polygon = {
  id: 'demo-square',
  name: 'Demo Square A',
  description: 'Small square geofence (Houston area)',
  coordinates: [
    [290300, 411000], // SW
    [290300, 411200], // NW
    [290500, 411200], // NE
    [290500, 411000], // SE
  ]
};

// Demo polygon 2: Irregular forest-like shape
const DEMO_FOREST: Polygon = {
  id: 'demo-forest',
  name: 'Demo Forest B',
  description: 'Irregular forest-like geofence',
  coordinates: [
    [290200, 411000], // W
    [290260, 411150], // NW
    [290320, 411300], // N
    [290450, 411300], // NE
    [290520, 411150], // E
    [290480, 411000], // SE
    [290380, 410900], // S
    [290260, 410900]  // SW
  ]
};

// Demo polygon 3: Edge-case polygon (narrow corridor)
const DEMO_CORRIDOR: Polygon = {
  id: 'demo-corridor',
  name: 'Demo Corridor C',
  description: 'Narrow corridor edge case',
  coordinates: [
    [290250, 411000], // Start
    [290270, 411000], // Narrow width (20 units)
    [290270, 411500], // Long length
    [290250, 411500], // Back
  ]
};

export const DEMO_POLYGONS: Polygon[] = [
  DEMO_SQUARE,
  DEMO_FOREST,
  DEMO_CORRIDOR
];

/**
 * Calculate SHA-256 hash of polygon coordinates
 */
export async function calculatePolygonHash(coordinates: number[][]): Promise<string> {
  const coordString = JSON.stringify(coordinates);
  const msgBuffer = new TextEncoder().encode(coordString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Parse GeoJSON and convert to scaled integer coordinates
 * Supports GeoJSON Polygon format
 */
export function parseGeoJSON(geojson: any): number[][] {
  if (!geojson || !geojson.type) {
    throw new Error('Invalid GeoJSON format');
  }

  let coordinates: number[][] = [];

  if (geojson.type === 'Polygon') {
    // GeoJSON Polygon has coordinates as [[[lon, lat], ...]]
    coordinates = geojson.coordinates[0];
  } else if (geojson.type === 'Feature' && geojson.geometry?.type === 'Polygon') {
    coordinates = geojson.geometry.coordinates[0];
  } else if (geojson.type === 'FeatureCollection') {
    // Take the first polygon feature
    const firstPolygon = geojson.features.find((f: any) => f.geometry?.type === 'Polygon');
    if (!firstPolygon) {
      throw new Error('No Polygon feature found in FeatureCollection');
    }
    coordinates = firstPolygon.geometry.coordinates[0];
  } else {
    throw new Error(`Unsupported GeoJSON type: ${geojson.type}`);
  }

  // Scale coordinates from decimal degrees to integers (multiply by 10000)
  // GeoJSON is [lon, lat], we keep the same order
  return coordinates.map(([lon, lat]: [number, number]) => [
    Math.round(lon * 10000),
    Math.round(lat * 10000)
  ]);
}

/**
 * Validate polygon has enough vertices and is properly formatted
 */
export function validatePolygon(coordinates: number[][]): boolean {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    return false;
  }

  for (const coord of coordinates) {
    if (!Array.isArray(coord) || coord.length !== 2) {
      return false;
    }
    if (!Number.isInteger(coord[0]) || !Number.isInteger(coord[1])) {
      return false;
    }
  }

  return true;
}

/**
 * Store selected polygon in localStorage
 */
export function saveSelectedPolygon(polygon: Polygon): void {
  localStorage.setItem('selectedPolygon', JSON.stringify(polygon));
}

/**
 * Load selected polygon from localStorage
 */
export function loadSelectedPolygon(): Polygon | null {
  const stored = localStorage.getItem('selectedPolygon');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Get current polygon (from localStorage or default to first demo)
 */
export function getCurrentPolygon(): Polygon {
  return loadSelectedPolygon() || DEMO_POLYGONS[0];
}

/**
 * Create a custom polygon from user input
 */
export async function createCustomPolygon(
  name: string,
  coordinates: number[][],
  description?: string
): Promise<Polygon> {
  if (!validatePolygon(coordinates)) {
    throw new Error('Invalid polygon coordinates');
  }

  const hash = await calculatePolygonHash(coordinates);

  return {
    id: `custom-${Date.now()}`,
    name,
    description: description || 'Custom polygon',
    coordinates,
    hash
  };
}
