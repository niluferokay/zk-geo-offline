import * as snarkjs from 'snarkjs';

// Define a geofence polygon (integer coordinates for the circuit)
const DEFAULT_POLYGON = [
  [290200, 411000], // W
  [290260, 411150], // NW
  [290320, 411300], // N
  [290450, 411300], // NE
  [290520, 411150], // E
  [290480, 411000], // SE
  [290380, 410900], // S
  [290260, 410900]  // SW
];

export interface ProofResult {
  proof: any;
  publicSignals: string[];
}

/**
 * Generate a zero-knowledge proof that a location (lat, lon) is inside a polygon
 * without revealing the exact coordinates
 */
export async function generateLocationProof(
  lat: number,
  lon: number,
  polygon: number[][] = DEFAULT_POLYGON
): Promise<ProofResult> {
  try {
    console.log('Generating ZK proof for location:', { lat, lon });

    // Scale coordinates to match polygon scale (multiply by 10000)
    // e.g., 29.0325 becomes 290325, 41.1100 becomes 411100
    const scaledLon = Math.round(lon * 10000);
    const scaledLat = Math.round(lat * 10000);

    // Prepare the input for the circuit
    const input = {
      point: [scaledLon, scaledLat],
      polygon: polygon
    };

    console.log('Circuit input:', input);

    // Load the WASM file and zkey
    const wasmPath = '/circuits/Main.wasm';
    const zkeyPath = '/circuits/Main_final.zkey';

    // Generate witness and proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log('✓ Proof generated successfully');
    console.log('Public signals:', publicSignals);

    return { proof, publicSignals };
  } catch (error) {
    console.error('Error generating proof:', error);
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
