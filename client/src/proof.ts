import * as snarkjs from 'snarkjs';
import type { CircuitGrid } from './polygons';

export interface ProofResult {
  proof: any;
  publicSignals: string[];
}

/**
 * Generate a zero-knowledge proof that a location is inside a polygon
 * without revealing the exact coordinates
 *
 * @param point - User location in CircuitGrid coordinates
 * @param polygon - Polygon vertices in CircuitGrid coordinates (exactly 8 vertices)
 */
export async function generateLocationProof(
  point: CircuitGrid,
  polygon: CircuitGrid[]
): Promise<ProofResult> {
  try {
    console.log('Generating ZK proof for location');
    console.log('Point (CircuitGrid):', point);
    console.log('Polygon (CircuitGrid):', polygon);

    // Prepare the input for the circuit
    const input = {
      point: [point[0], point[1]],
      polygon: polygon.map(p => [p[0], p[1]])
    };

    console.log('Circuit input:', input);

    // Load the WASM file and zkey
    const wasmPath = '/circuits/Main.wasm';
    const zkeyPath = '/circuits/Main_final.zkey';

    console.log('Loading circuit files...');
    console.log('WASM path:', wasmPath);
    console.log('ZKey path:', zkeyPath);

    // Test file accessibility
    try {
      const wasmTest = await fetch(wasmPath);
      console.log('WASM fetch status:', wasmTest.status, wasmTest.statusText);
      console.log('WASM content-type:', wasmTest.headers.get('content-type'));

      const zkeyTest = await fetch(zkeyPath);
      console.log('ZKey fetch status:', zkeyTest.status, zkeyTest.statusText);
      console.log('ZKey size:', zkeyTest.headers.get('content-length'));
    } catch (fetchError) {
      console.error('File fetch test failed:', fetchError);
      throw new Error(`Cannot access circuit files: ${fetchError}`);
    }

    // Generate witness and proof
    console.log('Calling snarkjs.groth16.fullProve...');

    // Use logger to debug memory issues
    const logger = {
      info: (...args: any[]) => console.log('[snarkjs]', ...args),
      debug: (...args: any[]) => console.log('[snarkjs debug]', ...args),
      warn: (...args: any[]) => console.warn('[snarkjs warn]', ...args),
      error: (...args: any[]) => console.error('[snarkjs error]', ...args)
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath,
      logger
    );

    console.log('✓ Proof generated successfully');
    console.log('Public signals:', publicSignals);

    return { proof, publicSignals };
  } catch (error) {
    console.error('Error generating proof:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', (error as any)?.name);
    console.error('Error message:', (error as any)?.message);
    console.error('Error stack:', (error as any)?.stack);
    throw error;
  }
}

/**
 * Verify a zero-knowledge proof
 */
export async function verifyLocationProof(
  proof: any,
  publicSignals: string[]
): Promise<boolean> {
  try {
    // Load the verification key
    const vkeyPath = '/circuits/verification_key.json';
    const response = await fetch(vkeyPath);
    const vkey = await response.json();

    // Verify the proof
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    console.log('Proof verification result:', isValid);
    return isValid;
  } catch (error) {
    console.error('Error verifying proof:', error);
    throw error;
  }
}
