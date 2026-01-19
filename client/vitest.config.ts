import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom',

    // Global setup
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',

      // Critical components must have 100% coverage
      include: [
        'src/polygons.ts',
        'src/proof.ts',
        'src/db.ts'
      ],

      // Coverage thresholds - enforced by CI
      thresholds: {
        // Global thresholds
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,

        // Per-file thresholds for critical components
        'src/polygons.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        }
      },

      // Exclude test files and build artifacts
      exclude: [
        'tests/**',
        'node_modules/**',
        'dist/**',
        '**/*.config.ts'
      ]
    },

    // Test file patterns
    include: [
      'tests/**/*.test.ts'
    ],

    // Test timeout (ZK tests can be slow)
    testTimeout: 60000,  // 60 seconds for ZK proof generation

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Reporters
    reporters: ['verbose'],

    // Pool options for parallel execution (Vitest v4 pool rework)
    pool: 'threads',
    maxThreads: 4,
    minThreads: 1,
    singleThread: false
  },

  // Resolve configuration for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  }
});
