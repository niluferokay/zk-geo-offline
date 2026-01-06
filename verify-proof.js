#!/usr/bin/env node

/**
 * Verify a ZK proof from the command line
 *
 * Usage:
 *   node verify-proof.js <proof-file.json>
 *
 * Example:
 *   node verify-proof.js proof-abc123.json
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function verifyProof(proofFilePath) {
  try {
    console.log('🔍 Loading proof file...');

    // Read the proof file (downloaded from browser)
    const proofData = JSON.parse(fs.readFileSync(proofFilePath, 'utf8'));

    console.log('📋 Proof details:');
    console.log(`  Session ID: ${proofData.session_id}`);
    console.log(`  Location: ${proofData.lat}, ${proofData.lon}`);
    console.log(`  Accuracy: ${proofData.accuracy}m`);
    console.log(`  Timestamp: ${new Date(proofData.timestamp).toISOString()}`);
    console.log('');

    // Load verification key
    const vkeyPath = path.join(__dirname, 'client/public/circuits/verification_key.json');
    console.log('🔑 Loading verification key...');
    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

    // Verify the proof
    console.log('⚙️  Verifying proof...');
    const isValid = await snarkjs.groth16.verify(
      vkey,
      proofData.publicSignals,
      proofData.proof
    );

    console.log('');
    if (isValid) {
      console.log('✅ PROOF VALID');
      console.log('   The location was inside the polygon.');
    } else {
      console.log('❌ PROOF INVALID');
      console.log('   The proof verification failed.');
    }

    // Decode public signals
    console.log('');
    console.log('📊 Public Signals:');
    console.log('   (These are visible to the verifier)');
    proofData.publicSignals.forEach((signal, i) => {
      console.log(`   [${i}]: ${signal}`);
    });

    return isValid;

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const proofFile = process.argv[2];

  if (!proofFile) {
    console.error('Usage: node verify-proof.js <proof-file.json>');
    console.error('');
    console.error('Example:');
    console.error('  node verify-proof.js proof-abc123.json');
    console.error('');
    console.error('To get a proof file:');
    console.error('  1. Open http://localhost:5174 in browser');
    console.error('  2. Generate a proof');
    console.error('  3. Open console (F12) and run:');
    console.error('     downloadAllProofs()');
    process.exit(1);
  }

  if (!fs.existsSync(proofFile)) {
    console.error(`❌ File not found: ${proofFile}`);
    process.exit(1);
  }

  verifyProof(proofFile)
    .then(isValid => {
      process.exit(isValid ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { verifyProof };
