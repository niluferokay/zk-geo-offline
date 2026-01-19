/**
 * Type definitions for polygon geometry and coordinate systems
 */

/**
 * Geographic coordinates in decimal degrees
 * Format: [longitude, latitude]
 */
export type GeoDegrees = readonly [lon: number, lat: number];

/**
 * Scaled integer coordinates (scaled by 10000)
 * 1 unit = 0.0001 degrees ≈ 11.1 meters at equator
 */
export type LocalScaled = readonly [x: number, y: number];

/**
 * Circuit grid coordinates (uint32 space, centered at 2^31)
 * Used for ZK circuit proof generation
 */
export type CircuitGrid = readonly [x: number, y: number];

/**
 * Metadata that affects boundary hash computation
 * CRITICAL: Only deterministic, geometry-affecting parameters
 * NO timestamps or non-deterministic data
 */
export interface BoundaryHashMetadata {
  version: number;
  scale: number;
  roundingMode: 'symmetric' | 'floor' | 'ceil';
  vertexSelectionAlgorithm: 'douglas-peucker' | 'visvalingam-whyatt' | 'none';
  simplificationTolerance?: number;
  targetVertexCount: number;
}

/**
 * Runtime metadata that does NOT affect hash
 * Used for tracking and display purposes only
 */
export interface BoundaryRuntimeMetadata {
  createdAt: number;
  description?: string;
  originalVertexCount?: number;
}

/**
 * Polygon with coordinates and cryptographic binding
 */
export interface Polygon {
  id: string;
  name: string;
  description: string;
  coordinates: LocalScaled[];
  hash?: string;
  lonOffset?: number;
  latOffset?: number;
  hashMetadata?: BoundaryHashMetadata;
  runtimeMetadata?: BoundaryRuntimeMetadata;
}
