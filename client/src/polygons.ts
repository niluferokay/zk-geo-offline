/**
 * Main polygon utilities module
 *
 * This file serves as the public API facade, re-exporting from specialized modules:
 * - types.ts: Type definitions
 * - normalization.ts: 8-vertex polygon normalization + coordinate transforms
 * - hashing.ts: Cryptographic boundary hashing
 * - circuit-input.ts: Prepare coordinates for ZK circuit + validation
 * - storage.ts: Demo polygons, localStorage, and custom polygon creation
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type {
  GeoDegrees,
  LocalScaled,
  CircuitGrid,
  BoundaryHashMetadata,
  BoundaryRuntimeMetadata,
  Polygon
} from './polygon/types';

// ============================================================================
// POLYGON NORMALIZATION & COORDINATE TRANSFORMS
// ============================================================================

export {
  geoDegreesToLocalScaled,
  geoDegreesToLocalScaledPoint,
  localScaledToCircuitGrid,
  metersPerDegreeLat,
  metersPerDegreeLon,
  sanitizePolygon,
  signedArea,
  ensureCCW,
  removeClosingDuplicate,
  simplifyPolygonToN,
  normalizePolygonTo8Vertices,
  validateLocalScaledPolygon
} from './polygon/normalization';

// ============================================================================
// CRYPTOGRAPHIC HASHING
// ============================================================================

export {
  calculateBoundaryHash,
  recomputeBoundaryHash,
  createHashMetadata
} from './polygon/hashing';

// Backwards-compatible alias used by tests
export async function calculatePolygonHash(coordinates: import('./polygon/types').LocalScaled[]): Promise<string> {
  const { calculateBoundaryHash, createHashMetadata } = await import('./polygon/hashing');
  return calculateBoundaryHash(coordinates, createHashMetadata());
}


// ============================================================================
// CIRCUIT INPUT PREPARATION & VALIDATION
// ============================================================================

export {
  parseGeoJSON,
  distanceToPolygonEdge,
  checkBoundarySafety,
  adjustPointForCircuit,
  validateCircuitGridBounds,
  prepareCircuitInput
} from './polygon/circuit-input';

// ============================================================================
// STORAGE, DEMO POLYGONS & CUSTOM POLYGON CREATION
// ============================================================================

export {
  initializeDemoPolygons,
  getDemoPolygons,
  saveSelectedPolygon,
  loadSelectedPolygon,
  getCurrentPolygon,
  migrateLegacyPolygonStorage,
  createCustomPolygon
} from './polygon/storage';
