/**
 * Integration Tests for All Scientific Paper Sources
 * 
 * Tests all 6 sources: arXiv, OpenAlex, PMC, Europe PMC, bioRxiv/medRxiv, CORE
 * Validates full workflow from category listing to content fetching
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { RateLimiter } from '../../src/core/rate-limiter.js';
import { listCategories } from '../../src/tools/list-categories.js';
import { fetchLatest } from '../../src/tools/fetch-latest.js';
import { fetchContent } from '../../src/tools/fetch-content.js';

// Test configuration
const TEST_CONFIG = {
  // Reduced counts for faster testing
  categoryTestCount: 5,
  paperTestCount: 2,
  // Test categories for each source
  testCategories: {
    arxiv: 'cs.AI',
    openalex: 'artificial intelligence',
    pmc: 'immunology',
    europepmc: 'biology',
    biorxiv: 'biorxiv:neuroscience',
    core: 'computer_science'
  },
  // Timeout for API calls (30 seconds)
  timeout: 30000
};

describe('Integration Tests - All Sources', () => {
  let rateLimiter: RateLimiter;

  beforeAll(() => {
    rateLimiter = new RateLimiter();
  });

  describe('Source: arXiv', () => {
    test('should list arXiv categories', async () => {
      const result = await listCategories({ source: 'arxiv' });
      
      expect(result.source).toBe('arxiv');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.categories[0]).toHaveProperty('id');
      expect(result.categories[0]).toHaveProperty('name');
      expect(result.categories[0]).toHaveProperty('description');
    }, TEST_CONFIG.timeout);

    test('should fetch latest arXiv papers', async () => {
      const result = await fetchLatest({
        source: 'arxiv',
        category: TEST_CONFIG.testCategories.arxiv,
        count: TEST_CONFIG.paperTestCount
      }, rateLimiter);

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content.length).toBeLessThanOrEqual(TEST_CONFIG.paperTestCount);
      
      // Validate paper structure
      const paper = result.content[0];
      expect(paper).toHaveProperty('id');
      expect(paper).toHaveProperty('title');
      expect(paper).toHaveProperty('authors');
      expect(paper).toHaveProperty('date');
      expect(paper).toHaveProperty('text');
      expect(Array.isArray(paper.authors)).toBe(true);
    }, TEST_CONFIG.timeout);

    test('should fetch arXiv paper content', async () => {
      // First get a paper ID
      const latestResult = await fetchLatest({
        source: 'arxiv',
        category: TEST_CONFIG.testCategories.arxiv,
        count: 1
      }, rateLimiter);

      expect(latestResult.content.length).toBeGreaterThan(0);
      const paperId = latestResult.content[0].id;

      // Then fetch its content
      const contentResult = await fetchContent({
        source: 'arxiv',
        id: paperId
      }, rateLimiter);

      expect(contentResult.content).toBeDefined();
      expect(contentResult.content.id).toBe(paperId);
      expect(contentResult.content.title).toBeTruthy();
      expect(contentResult.content.text).toBeTruthy();
    }, TEST_CONFIG.timeout);
  });

  describe('Source: OpenAlex', () => {
    test('should list OpenAlex categories', async () => {
      const result = await listCategories({ source: 'openalex' });
      
      expect(result.source).toBe('openalex');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
    }, TEST_CONFIG.timeout);

    test('should fetch latest OpenAlex papers', async () => {
      const result = await fetchLatest({
        source: 'openalex',
        category: TEST_CONFIG.testCategories.openalex,
        count: TEST_CONFIG.paperTestCount
      }, rateLimiter);

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      
      const paper = result.content[0];
      expect(paper).toHaveProperty('id');
      expect(paper).toHaveProperty('title');
      expect(paper).toHaveProperty('authors');
      expect(paper).toHaveProperty('date');
    }, TEST_CONFIG.timeout);

    test('should fetch OpenAlex paper content', async () => {
      const latestResult = await fetchLatest({
        source: 'openalex',
        category: TEST_CONFIG.testCategories.openalex,
        count: 1
      }, rateLimiter);

      if (latestResult.content.length > 0) {
        const paperId = latestResult.content[0].id;
        
        const contentResult = await fetchContent({
          source: 'openalex',
          id: paperId
        }, rateLimiter);

        expect(contentResult.content).toBeDefined();
        expect(contentResult.content.id).toBe(paperId);
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Source: PMC', () => {
    test('should list PMC categories', async () => {
      const result = await listCategories({ source: 'pmc' });
      
      expect(result.source).toBe('pmc');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      
      // Check for biomedical categories
      const categoryIds = result.categories.map(cat => cat.id);
      expect(categoryIds).toContain('immunology');
    }, TEST_CONFIG.timeout);

    test('should fetch latest PMC papers', async () => {
      const result = await fetchLatest({
        source: 'pmc',
        category: TEST_CONFIG.testCategories.pmc,
        count: TEST_CONFIG.paperTestCount
      }, rateLimiter);

      expect(result.content).toBeDefined();
      
      if (result.content.length > 0) {
        const paper = result.content[0];
        expect(paper).toHaveProperty('id');
        expect(paper).toHaveProperty('title');
        expect(paper).toHaveProperty('authors');
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Source: Europe PMC', () => {
    test('should list Europe PMC categories', async () => {
      const result = await listCategories({ source: 'europepmc' });
      
      expect(result.source).toBe('europepmc');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      
      // Check for life science categories
      const categoryIds = result.categories.map(cat => cat.id);
      expect(categoryIds).toContain('biology');
    }, TEST_CONFIG.timeout);

    test('should fetch latest Europe PMC papers', async () => {
      const result = await fetchLatest({
        source: 'europepmc',
        category: TEST_CONFIG.testCategories.europepmc,
        count: TEST_CONFIG.paperTestCount
      }, rateLimiter);

      expect(result.content).toBeDefined();
      
      if (result.content.length > 0) {
        const paper = result.content[0];
        expect(paper).toHaveProperty('id');
        expect(paper).toHaveProperty('title');
        expect(paper).toHaveProperty('authors');
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Source: bioRxiv/medRxiv', () => {
    test('should list bioRxiv/medRxiv categories', async () => {
      const result = await listCategories({ source: 'biorxiv' });
      
      expect(result.source).toBe('biorxiv');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      
      // Should have both bioRxiv and medRxiv categories
      const categoryIds = result.categories.map(cat => cat.id);
      const bioRxivCategories = categoryIds.filter(id => id.startsWith('biorxiv:'));
      const medRxivCategories = categoryIds.filter(id => id.startsWith('medrxiv:'));
      
      expect(bioRxivCategories.length).toBeGreaterThan(0);
      expect(medRxivCategories.length).toBeGreaterThan(0);
    }, TEST_CONFIG.timeout);

    test('should fetch latest bioRxiv papers', async () => {
      const result = await fetchLatest({
        source: 'biorxiv',
        category: TEST_CONFIG.testCategories.biorxiv,
        count: TEST_CONFIG.paperTestCount
      }, rateLimiter);

      expect(result.content).toBeDefined();
      
      if (result.content.length > 0) {
        const paper = result.content[0];
        expect(paper).toHaveProperty('id');
        expect(paper).toHaveProperty('title');
        expect(paper).toHaveProperty('authors');
        expect(paper).toHaveProperty('pdf_url');
        // bioRxiv papers should have DOI format
        expect(paper.id).toMatch(/^10\.1101\//);
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Source: CORE', () => {
    test('should list CORE categories', async () => {
      const result = await listCategories({ source: 'core' });
      
      expect(result.source).toBe('core');
      expect(result.categories).toBeDefined();
      expect(result.categories.length).toBeGreaterThan(0);
      
      // Check for academic categories
      const categoryIds = result.categories.map(cat => cat.id);
      expect(categoryIds).toContain('computer_science');
      expect(categoryIds).toContain('mathematics');
      expect(categoryIds).toContain('physics');
    }, TEST_CONFIG.timeout);

    test('should fetch latest CORE papers', async () => {
      const result = await fetchLatest({
        source: 'core',
        category: TEST_CONFIG.testCategories.core,
        count: TEST_CONFIG.paperTestCount
      }, rateLimiter);

      expect(result.content).toBeDefined();
      
      if (result.content.length > 0) {
        const paper = result.content[0];
        expect(paper).toHaveProperty('id');
        expect(paper).toHaveProperty('title');
        expect(paper).toHaveProperty('authors');
        // CORE IDs should be numeric
        expect(parseInt(paper.id)).not.toBeNaN();
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Cross-Source Validation', () => {
    test('all sources should have consistent paper metadata structure', async () => {
      const sources = ['arxiv', 'openalex', 'pmc', 'europepmc', 'biorxiv', 'core'] as const;
      const paperSamples: any[] = [];

      // Collect one paper from each source
      for (const source of sources) {
        try {
          const result = await fetchLatest({
            source,
            category: TEST_CONFIG.testCategories[source],
            count: 1
          }, rateLimiter);

          if (result.content.length > 0) {
            paperSamples.push({ source, paper: result.content[0] });
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${source}:`, error);
        }
      }

      expect(paperSamples.length).toBeGreaterThan(0);

      // Validate structure consistency
      for (const { source, paper } of paperSamples) {
        expect(paper, `${source} paper structure`).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          authors: expect.any(Array),
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          text: expect.any(String)
        });
      }
    }, TEST_CONFIG.timeout * 2);

    test('rate limiting should work across all sources', async () => {
      const testRateLimiter = new RateLimiter();
      
      // Make multiple rapid calls to test rate limiting
      const promises = ['arxiv', 'openalex'].map(source => 
        fetchLatest({
          source: source as any,
          category: source === 'arxiv' ? 'cs.AI' : 'artificial intelligence',
          count: 1
        }, testRateLimiter)
      );

      // Should not throw rate limit errors for reasonable requests
      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successful).toBeGreaterThan(0);
    }, TEST_CONFIG.timeout);
  });
});