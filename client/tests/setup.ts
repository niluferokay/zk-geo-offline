/**
 * Vitest global setup file
 *
 * This file runs before all tests and sets up the global environment.
 */

import { beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Mock Web Crypto API for Node.js environment
beforeAll(() => {
  // Ensure crypto.subtle is available
  if (!global.crypto) {
    const { webcrypto } = require('crypto');
    global.crypto = webcrypto as any;
  }

  // Mock TextEncoder/TextDecoder if not available
  if (!global.TextEncoder) {
    global.TextEncoder = require('util').TextEncoder;
  }
  if (!global.TextDecoder) {
    global.TextDecoder = require('util').TextDecoder;
  }

  // No need for fetch shim in Node environment - snarkjs will use filesystem paths directly

  console.log('✓ Test environment initialized');
});

afterAll(() => {
  console.log('✓ Test suite completed');
});

// Increase test timeout for ZK tests
vi.setConfig({
  testTimeout: 60000 // 60 seconds
});
