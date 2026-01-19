import * as snarkjs from 'snarkjs';
import type { CircuitGrid } from './polygons';

export interface ProofResult {
  proof: any;
  publicSignals: string[];
}

export interface ProofOptions {
  wasmPath?: string;
  zkeyPath?: string;
}

export interface VerifyOptions {
  vkeyPath?: string;
}

export async function generateLocationProof(
  point: CircuitGrid,
  polygon: CircuitGrid[],
  opts?: ProofOptions
): Promise<ProofResult> {
  try {
    // Prepare the input for the circuit
    const input = {
      point: [point[0], point[1]],
      polygon: polygon.map(p => [p[0], p[1]])
    };

    // Use provided paths or defaults
    const wasmPath = opts?.wasmPath || '/circuits/Main.wasm';
    const zkeyPath = opts?.zkeyPath || '/circuits/Main_final.zkey';

    // Test file accessibility in browser environments (fetch-only).
    const isNodeEnv = typeof window === 'undefined';
    if (!isNodeEnv && !opts?.wasmPath) {
      try {
        await fetch(wasmPath);
        await fetch(zkeyPath);
      } catch (fetchError) {
        throw new Error(`Cannot access circuit files: ${fetchError}`);
      }
    }

    // Generate witness and proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath,
    );

    return { proof, publicSignals };
  } catch (error) {
    throw error;
  }
}

//Verify zero-knowledge proof
export async function verifyLocationProof(
  proof: any,
  publicSignals: string[],
  opts?: VerifyOptions
): Promise<boolean> {
  try {
    const vkeyPath = opts?.vkeyPath || '/circuits/verification_key.json';
    
    const isNodeEnv = typeof window === 'undefined';
    
    let vkey;
    if (isNodeEnv && opts?.vkeyPath) {
      // Dynamic import to avoid bundler issues
      const fs = await import('node:fs/promises' as any);
      vkey = JSON.parse(await fs.readFile(vkeyPath, 'utf8'));
    } else {
      const response = await fetch(vkeyPath);
      vkey = await response.json();
    }

    // Verify the proof
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);

    return isValid;
  } catch (error) {
    throw error;
  }
}
