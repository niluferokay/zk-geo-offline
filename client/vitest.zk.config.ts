import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Pure Node environment for ZK tests
    environment: 'node',
    
    // Global setup
    globals: true,
    
    // Use forks to avoid thread worker issues with WASM
    pool: 'forks',
    
    // Longer timeout for ZK proof generation
    testTimeout: 120000,
    
    // Only include ZK parity tests
    include: [
      'tests/zk/zk-parity.test.ts'
    ],
    
    // Keep the setup for crypto globals
    setupFiles: ['./tests/setup.ts'],
    
    // Reporters
    reporters: ['verbose'],
    
    // Pool options for Vitest v4 - moved to top level
    maxForks: 2,
    singleFork: false
  },
  
  // Resolve configuration for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});