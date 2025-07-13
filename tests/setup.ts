/**
 * Test Setup and Configuration
 * 
 * Global test setup, mocks, and utilities
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Global test configuration
beforeAll(() => {
  console.log('🧪 Starting Scientific Papers MCP Test Suite');
  console.log('📊 Testing all 6 sources: arXiv, OpenAlex, PMC, Europe PMC, bioRxiv/medRxiv, CORE');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  
  // Increase timeout for integration tests
  process.env.VITEST_TIMEOUT = '30000';
  
  // Warn about API keys
  if (!process.env.CORE_API_KEY) {
    console.warn('⚠️  CORE_API_KEY not set - using public rate limits for CORE tests');
  }
  
  // Set up error handling for unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });
});

beforeEach(() => {
  // Clear any cached modules or state before each test
  // This helps ensure test isolation
});

afterAll(() => {
  console.log('✅ Test suite completed');
  
  // Clean up any resources
  process.removeAllListeners('unhandledRejection');
});

// Global test utilities
declare global {
  var testUtils: {
    isValidPaper: (paper: any) => boolean;
    isValidCategory: (category: any) => boolean;
    isValidDOI: (doi: string) => boolean;
    delay: (ms: number) => Promise<void>;
  };
}

globalThis.testUtils = {
  /**
   * Validate paper metadata structure
   */
  isValidPaper: (paper: any): boolean => {
    return (
      typeof paper === 'object' &&
      typeof paper.id === 'string' && paper.id.length > 0 &&
      typeof paper.title === 'string' && paper.title.length > 0 &&
      Array.isArray(paper.authors) && paper.authors.length > 0 &&
      typeof paper.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paper.date) &&
      typeof paper.text === 'string'
    );
  },

  /**
   * Validate category structure
   */
  isValidCategory: (category: any): boolean => {
    return (
      typeof category === 'object' &&
      typeof category.id === 'string' && category.id.length > 0 &&
      typeof category.name === 'string' && category.name.length > 0
    );
  },

  /**
   * Validate DOI format
   */
  isValidDOI: (doi: string): boolean => {
    return /^10\.\d{4,}\/[^\s]+$/.test(doi);
  },

  /**
   * Utility function for adding delays in tests
   */
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Export test constants
export const TEST_CONSTANTS = {
  // Default timeouts
  FAST_TIMEOUT: 5000,
  MEDIUM_TIMEOUT: 15000,
  SLOW_TIMEOUT: 30000,
  
  // Test data limits
  MAX_PAPERS_PER_TEST: 5,
  MAX_CATEGORIES_PER_TEST: 10,
  
  // Sources and test categories
  SOURCES: ['arxiv', 'openalex', 'pmc', 'europepmc', 'biorxiv', 'core'] as const,
  
  TEST_CATEGORIES: {
    arxiv: 'cs.AI',
    openalex: 'artificial intelligence',
    pmc: 'immunology',
    europepmc: 'biology',
    biorxiv: 'biorxiv:neuroscience',
    core: 'computer_science'
  } as const,
  
  // Performance thresholds
  PERFORMANCE_THRESHOLDS: {
    categoryListing: 5000,
    paperFetching: 15000,
    contentFetching: 20000,
    memoryLeakThreshold: 100
  } as const
};