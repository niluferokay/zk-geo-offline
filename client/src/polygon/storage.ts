/**
 * Demo polygons and localStorage management
 *
 * Includes:
 * - Demo polygon initialization with cryptographic hashing
 * - Custom polygon creation from GeoJSON
 * - localStorage management with privacy-preserving storage
 *
 * Privacy approach:
 * - Demo polygons: Only store ID (doesn't expose user's area of interest)
 * - Custom polygons: Store full data (user explicitly uploaded)
 */

import type { Polygon, LocalScaled, GeoDegrees, BoundaryHashMetadata, BoundaryRuntimeMetadata } from './types';
import { geoDegreesToLocalScaled, normalizePolygonTo8Vertices, validateLocalScaledPolygon } from './normalization';
import { calculateBoundaryHash, createHashMetadata } from './hashing';

// Demo polygons for testing
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

// Demo polygons are exported via initializeDemoPolygons() to ensure proper hashing
let _initializedDemoPolygons: Polygon[] | null = null;

/**
 * Initialize demo polygons with cryptographic hashes
 * Call this once at app startup
 */
export async function initializeDemoPolygons(): Promise<void> {
  if (_initializedDemoPolygons) {
    return; // Already initialized
  }

  const hashMetadata = createHashMetadata();

  const polygons = [DEMO_FOREST_A, DEMO_FOREST_B];
  _initializedDemoPolygons = await Promise.all(
    polygons.map(async (polygon) => ({
      ...polygon,
      hash: await calculateBoundaryHash(polygon.coordinates, hashMetadata),
      hashMetadata,
      runtimeMetadata: {
        createdAt: 0,
        description: polygon.description,
        originalVertexCount: polygon.coordinates.length
      }
    }))
  );
}

/**
 * Get initialized demo polygons
 * @throws Error if not initialized - call initializeDemoPolygons() first
 */
export function getDemoPolygons(): Polygon[] {
  if (!_initializedDemoPolygons) {
    throw new Error('Demo polygons not initialized. Call initializeDemoPolygons() first.');
  }
  return _initializedDemoPolygons;
}

/**
 * Save selected polygon to localStorage
 *
 * Privacy approach:
 * - Demo polygons: Only store ID (privacy-preserving)
 * - Custom polygons: Store full data (acceptable since user uploaded)
 */
export function saveSelectedPolygon(polygon: Polygon): void {
  if (polygon.id.startsWith('demo-')) {
    // For demo polygons: only store ID
    localStorage.setItem('selectedPolygonId', polygon.id);
    localStorage.removeItem('customPolygon');
  } else {
    // For custom polygons: store full data
    localStorage.setItem('customPolygon', JSON.stringify(polygon));
    localStorage.removeItem('selectedPolygonId');
  }
}

/**
 * Load the selected polygon from localStorage
 * Returns null if no polygon selected
 */
export function loadSelectedPolygon(): Polygon | null {
  // Check for custom polygon first
  const customStored = localStorage.getItem('customPolygon');
  if (customStored) {
    try {
      return JSON.parse(customStored);
    } catch {
      localStorage.removeItem('customPolygon');
    }
  }

  // Check for demo polygon ID
  const storedId = localStorage.getItem('selectedPolygonId');
  if (storedId) {
    try {
      const demoPolygons = getDemoPolygons();
      const polygon = demoPolygons.find(p => p.id === storedId);
      return polygon || null;
    } catch {
      // Demo polygons not initialized yet
      return null;
    }
  }

  return null;
}

/**
 * Get current polygon (with fallback to first demo polygon)
 * @throws Error if no polygon selected and demos not initialized
 */
export function getCurrentPolygon(): Polygon {
  const selected = loadSelectedPolygon();
  if (selected) return selected;

  try {
    return getDemoPolygons()[0];
  } catch {
    throw new Error('No polygon selected and demo polygons not initialized');
  }
}

/**
 * Migrate legacy localStorage format to new privacy-preserving storage
 * Call this on app initialization
 */
export function migrateLegacyPolygonStorage(): void {
  const legacyKey = 'selectedPolygon';
  const legacyData = localStorage.getItem(legacyKey);

  if (legacyData) {
    try {
      const polygon = JSON.parse(legacyData);
      saveSelectedPolygon(polygon);
    } catch {
      // Corrupted data, just remove it
    }
    localStorage.removeItem(legacyKey);
  }
}

// ============================================================================
// CUSTOM POLYGON CREATION
// ============================================================================

/**
 * Create a custom polygon from user input (CRYPTOGRAPHICALLY HARDENED)
 *
 * Input: GeoDegrees coordinates
 * Output: Polygon with LocalScaled coordinates, normalized to 8 vertices
 *
 * CRYPTOGRAPHIC GUARANTEES:
 * ✓ Hash is deterministic (same input → same hash, always)
 * ✓ Hash includes ONLY geometry-affecting parameters
 * ✓ Timestamps stored separately (NOT in hash)
 * ✓ Fully reproducible across devices and time
 *
 * SECURITY DESIGN:
 * - hashMetadata: Deterministic, included in hash, affects geometry
 * - runtimeMetadata: Non-deterministic, NOT in hash, for tracking only
 * - Canonical serialization prevents property order issues
 *
 * @param name - Human-readable polygon name
 * @param geoCoords - Polygon vertices in decimal degrees [lon, lat]
 * @param description - Optional description (stored, not hashed)
 * @returns Polygon with cryptographically bound hash
 */
export async function createCustomPolygon(
  name: string,
  geoCoords: GeoDegrees[],
  description?: string
): Promise<Polygon> {
  // Convert GeoDegrees to LocalScaled using symmetric rounding
  const { coordinates, lonOffset, latOffset } = geoDegreesToLocalScaled(geoCoords);
  const originalVertexCount = coordinates.length;

  // Normalize to 8 vertices using shape-preserving algorithm
  const normalized = normalizePolygonTo8Vertices(coordinates);

  // Validate output
  if (!validateLocalScaledPolygon(normalized)) {
    throw new Error('Generated polygon failed validation');
  }

  // DETERMINISTIC metadata (affects hash)
  const hashMetadata: BoundaryHashMetadata = createHashMetadata();

  // NON-DETERMINISTIC metadata (does NOT affect hash)
  const runtimeMetadata: BoundaryRuntimeMetadata = {
    createdAt: Date.now(),
    description: description || 'Custom polygon',
    originalVertexCount
  };

  // Hash is computed AFTER 8-vertex normalization and includes ONLY deterministic metadata
  const hash = await calculateBoundaryHash(normalized, hashMetadata);

  return {
    id: `custom-${Date.now()}`, // ID is not hashed, safe to use timestamp
    name,
    description: description || 'Custom polygon',
    coordinates: normalized,
    hash,
    lonOffset,
    latOffset,
    hashMetadata,
    runtimeMetadata
  };
}
