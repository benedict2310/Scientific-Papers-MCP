import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test files location
    include: ['tests/**/*.test.ts'],
    
    // Environment setup
    environment: 'node',
    
    // Global test configuration
    globals: true,
    
    // Timeout settings
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'dist/**'
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Retry configuration for flaky tests
    retry: 2,
    
    // Sequential execution for integration tests to avoid rate limiting
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    
    // Setup files
    setupFiles: ['tests/setup.ts']
  }
});