/**
 * Cryptographic boundary hashing for polygon integrity verification
 *
 * SECURITY GUARANTEES:
 * - Deterministic: Same input always produces same hash
 * - Collision-resistant: Different inputs produce different hashes
 * - Tamper-proof: Detects coordinate or metadata modifications
 * - Reproducible: Same hash across devices and time
 */

import type { LocalScaled, BoundaryHashMetadata, Polygon } from './types';

/**
 * Canonical serialization of coordinates and metadata
 * Ensures consistent hash regardless of property order
 */
function canonicalSerialize(coordinates: LocalScaled[], metadata: BoundaryHashMetadata): string {
  const sortedMetadata: any = {};
  const keys = Object.keys(metadata).sort();
  for (const key of keys) {
    sortedMetadata[key] = (metadata as any)[key];
  }

  // Build canonical string with strict formatting
  const coordStr = coordinates
    .map(([x, y]) => `[${x},${y}]`)
    .join(',');

  const metaStr = keys
    .map(key => {
      const val = sortedMetadata[key];
      if (typeof val === 'number') {
        return `${key}:${val}`;
      } else if (typeof val === 'string') {
        return `${key}:"${val}"`;
      } else if (val === undefined) {
        return `${key}:null`;
      }
      return `${key}:${JSON.stringify(val)}`;
    })
    .join(',');

  return `coordinates:[${coordStr}];metadata:{${metaStr}}`;
}

/**
 * Calculate SHA-256 hash of polygon boundary
 *
 * CRITICAL SECURITY: Only deterministic, geometry-affecting parameters are hashed.
 * Timestamps and runtime metadata are explicitly excluded.
 *
 * @param coordinates - Polygon vertices in LocalScaled format
 * @param metadata - Deterministic hash metadata
 * @returns SHA-256 hash as hex string
 * @throws Error if coordinates empty or metadata invalid
 */
export async function calculateBoundaryHash(
  coordinates: LocalScaled[],
  metadata: BoundaryHashMetadata
): Promise<string> {
  // Validate inputs
  if (!coordinates || coordinates.length === 0) {
    throw new Error('Cannot hash empty coordinates');
  }

  if (!metadata || !metadata.version || !metadata.scale) {
    throw new Error('Invalid hash metadata: missing required fields');
  }

  // Validate no timestamps leaked into metadata
  if ('timestamp' in metadata || 'createdAt' in metadata) {
    throw new Error('SECURITY ERROR: Hash metadata contains non-deterministic timestamp');
  }

  // Create canonical serialization
  const canonicalString = canonicalSerialize(coordinates, metadata);

  // Hash using SHA-256
  const msgBuffer = new TextEncoder().encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Recompute boundary hash from polygon data
 *
 * PURPOSE: Verify that a polygon's stored hash matches its current data.
 * This detects:
 * - Coordinate tampering
 * - Metadata modifications
 * - Data corruption
 *
 * @param polygon - Polygon with coordinates and hashMetadata
 * @returns Recomputed hash for verification
 * @throws Error if polygon missing required fields
 */
export async function recomputeBoundaryHash(polygon: Polygon): Promise<string> {
  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    throw new Error('Polygon has no coordinates');
  }

  if (polygon.hashMetadata) {
    return calculateBoundaryHash(polygon.coordinates, polygon.hashMetadata);
  }

  throw new Error('Polygon has no hash metadata - cannot verify');
}

/**
 * Create standard hash metadata for polygon normalization
 *
 * Returns deterministic metadata configuration for:
 * - Version 2: Topology-preserving Visvalingam-Whyatt algorithm
 * - Scale: 10000 (0.0001 degree precision)
 * - Rounding: Symmetric (Math.round)
 * - Target: 8 vertices for ZK circuit
 */
export function createHashMetadata(): BoundaryHashMetadata {
  return {
    version: 2,
    scale: 10000,
    roundingMode: 'symmetric',
    vertexSelectionAlgorithm: 'visvalingam-whyatt',
    targetVertexCount: 8
  };
}
