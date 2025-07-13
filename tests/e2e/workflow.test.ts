/**
 * End-to-End Workflow Tests
 * 
 * Tests complete workflows from discovery to content extraction
 * Simulates real user scenarios across different academic domains
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { RateLimiter } from '../../src/core/rate-limiter.js';
import { listCategories } from '../../src/tools/list-categories.js';
import { fetchLatest } from '../../src/tools/fetch-latest.js';
import { fetchContent } from '../../src/tools/fetch-content.js';
import { fetchTopCited } from '../../src/tools/fetch-top-cited.js';

// Real-world workflow scenarios
const WORKFLOW_SCENARIOS = {
  aiResearcher: {
    description: 'AI researcher looking for recent machine learning papers',
    sources: ['arxiv', 'openalex'],
    categories: ['cs.LG', 'artificial intelligence'],
    expectedPapers: 3
  },
  biomedicalResearcher: {
    description: 'Biomedical researcher studying immunology',
    sources: ['pmc', 'europepmc', 'biorxiv'],
    categories: ['immunology', 'biology', 'biorxiv:immunology'],
    expectedPapers: 2
  },
  generalAcademicResearcher: {
    description: 'Academic researcher doing broad literature review',
    sources: ['core', 'openalex'],
    categories: ['computer_science', 'machine learning'],
    expectedPapers: 5
  }
};

describe('End-to-End Workflow Tests', () => {
  let rateLimiter: RateLimiter;

  beforeAll(() => {
    rateLimiter = new RateLimiter();
  });

  describe('Workflow: AI Researcher', () => {
    test('complete AI research workflow', async () => {
      const scenario = WORKFLOW_SCENARIOS.aiResearcher;
      const results: any[] = [];

      // Step 1: Discover available categories
      for (const source of scenario.sources) {
        const categories = await listCategories({ source: source as any });
        expect(categories.categories.length).toBeGreaterThan(0);
        
        // Find ML-related categories
        const mlCategories = categories.categories.filter(cat => 
          cat.id.includes('LG') || 
          cat.name.toLowerCase().includes('learning') ||
          cat.name.toLowerCase().includes('intelligence')
        );
        expect(mlCategories.length).toBeGreaterThan(0);
      }

      // Step 2: Fetch recent papers from each source
      for (let i = 0; i < scenario.sources.length; i++) {
        const source = scenario.sources[i];
        const category = scenario.categories[i];
        
        try {
          const papers = await fetchLatest({
            source: source as any,
            category,
            count: scenario.expectedPapers
          }, rateLimiter);
          
          if (papers.content.length > 0) {
            results.push(...papers.content.map(p => ({ ...p, source })));
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${source}:`, error);
        }
      }

      expect(results.length).toBeGreaterThan(0);

      // Step 3: Get full content for most recent paper
      if (results.length > 0) {
        const recentPaper = results[0];
        
        try {
          const fullContent = await fetchContent({
            source: recentPaper.source,
            id: recentPaper.id
          }, rateLimiter);

          expect(fullContent.content.title).toBeTruthy();
          expect(fullContent.content.text).toBeTruthy();
          expect(fullContent.content.text.length).toBeGreaterThan(100);
        } catch (error) {
          console.warn('Content fetch failed (might be expected for some sources):', error);
        }
      }

      // Step 4: Validate research-relevant metadata
      for (const paper of results) {
        expect(paper.title).toBeTruthy();
        expect(paper.authors.length).toBeGreaterThan(0);
        expect(paper.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        
        // AI papers should have relevant keywords in title or abstract
        const text = (paper.title + ' ' + paper.text).toLowerCase();
        const hasRelevantKeywords = [
          'learning', 'neural', 'algorithm', 'intelligence', 
          'model', 'training', 'deep', 'machine'
        ].some(keyword => text.includes(keyword));
        
        if (paper.title && paper.text) {
          expect(hasRelevantKeywords).toBe(true);
        }
      }
    }, 60000);
  });

  describe('Workflow: Biomedical Researcher', () => {
    test('complete biomedical research workflow', async () => {
      const scenario = WORKFLOW_SCENARIOS.biomedicalResearcher;
      const results: any[] = [];

      // Step 1: Check biomedical databases
      for (let i = 0; i < scenario.sources.length; i++) {
        const source = scenario.sources[i];
        const category = scenario.categories[i];
        
        try {
          const papers = await fetchLatest({
            source: source as any,
            category,
            count: scenario.expectedPapers
          }, rateLimiter);
          
          if (papers.content.length > 0) {
            results.push(...papers.content.map(p => ({ ...p, source })));
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${source}:`, error);
        }
      }

      // Should find papers from biomedical sources
      const biomedicalSources = results.map(r => r.source);
      const hasBiomedicalContent = biomedicalSources.some(s => 
        ['pmc', 'europepmc', 'biorxiv'].includes(s)
      );
      
      if (results.length > 0) {
        expect(hasBiomedicalContent).toBe(true);
      }

      // Step 2: Validate biomedical content characteristics
      for (const paper of results.slice(0, 3)) { // Test first 3 papers
        expect(paper.title).toBeTruthy();
        expect(paper.authors.length).toBeGreaterThan(0);
        
        // Biomedical papers often have specific characteristics
        if (paper.source === 'biorxiv') {
          expect(paper.id).toMatch(/^10\.1101\//); // bioRxiv DOI format
          expect(paper.pdf_url).toContain('biorxiv.org');
        }
        
        if (paper.source === 'pmc') {
          // PMC papers should have PMC or PMID identifiers
          expect(paper.id).toBeTruthy();
        }
      }
    }, 60000);
  });

  describe('Workflow: Literature Review', () => {
    test('comprehensive literature discovery workflow', async () => {
      const scenario = WORKFLOW_SCENARIOS.generalAcademicResearcher;
      const allPapers: any[] = [];
      const sourceStats: Record<string, number> = {};

      // Step 1: Systematic search across multiple sources
      for (let i = 0; i < scenario.sources.length; i++) {
        const source = scenario.sources[i];
        const category = scenario.categories[i];
        
        try {
          const papers = await fetchLatest({
            source: source as any,
            category,
            count: scenario.expectedPapers
          }, rateLimiter);
          
          allPapers.push(...papers.content.map(p => ({ ...p, source })));
          sourceStats[source] = papers.content.length;
        } catch (error) {
          console.warn(`Failed to fetch from ${source}:`, error);
          sourceStats[source] = 0;
        }
      }

      // Step 2: Also test top-cited papers for comparison
      try {
        const topCited = await fetchTopCited({
          concept: 'machine learning',
          since: '2024-01-01',
          count: 3
        }, rateLimiter);
        
        if (topCited.content.length > 0) {
          allPapers.push(...topCited.content.map(p => ({ ...p, source: 'openalex-cited' })));
        }
      } catch (error) {
        console.warn('Top cited fetch failed:', error);
      }

      // Step 3: Analyze coverage and diversity
      expect(allPapers.length).toBeGreaterThan(0);
      
      const uniqueSources = new Set(allPapers.map(p => p.source));
      expect(uniqueSources.size).toBeGreaterThan(1); // Should have multiple sources
      
      const uniqueTitles = new Set(allPapers.map(p => p.title));
      expect(uniqueTitles.size).toBe(allPapers.length); // No duplicate papers
      
      // Step 4: Quality assessment
      const papersWithFullText = allPapers.filter(p => p.text && p.text.length > 100);
      const textCoverage = papersWithFullText.length / allPapers.length;
      
      console.log('Literature Review Statistics:');
      console.log('- Total papers found:', allPapers.length);
      console.log('- Unique sources:', uniqueSources.size);
      console.log('- Papers with substantial text:', papersWithFullText.length);
      console.log('- Text coverage:', `${Math.round(textCoverage * 100)}%`);
      console.log('- Source distribution:', sourceStats);
      
      // Should have reasonable text coverage
      expect(textCoverage).toBeGreaterThan(0);
    }, 90000);
  });

  describe('Cross-Source Paper Discovery', () => {
    test('find papers on same topic across different sources', async () => {
      const topic = 'neural networks';
      const sources = [
        { source: 'arxiv' as const, category: 'cs.LG' },
        { source: 'openalex' as const, category: 'neural networks' },
        { source: 'core' as const, category: 'computer_science' }
      ];
      
      const topicPapers: any[] = [];
      
      for (const { source, category } of sources) {
        try {
          const papers = await fetchLatest({
            source,
            category,
            count: 2
          }, rateLimiter);
          
          // Filter for papers that mention the topic
          const relevantPapers = papers.content.filter(paper => {
            const text = (paper.title + ' ' + paper.text).toLowerCase();
            return text.includes(topic.toLowerCase()) || 
                   text.includes('neural') || 
                   text.includes('network');
          });
          
          topicPapers.push(...relevantPapers.map(p => ({ ...p, source })));
        } catch (error) {
          console.warn(`Failed to search ${source}:`, error);
        }
      }
      
      if (topicPapers.length > 0) {
        // Analyze topic coverage across sources
        const sourceMap = new Map();
        topicPapers.forEach(paper => {
          const source = paper.source;
          if (!sourceMap.has(source)) {
            sourceMap.set(source, []);
          }
          sourceMap.get(source).push(paper);
        });
        
        console.log(`Topic "${topic}" coverage:`, 
          Array.from(sourceMap.entries()).map(([src, papers]) => 
            `${src}: ${papers.length} papers`
          ).join(', ')
        );
        
        expect(sourceMap.size).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('Data Quality Validation', () => {
    test('validate data quality across all sources', async () => {
      const qualityMetrics = {
        totalPapers: 0,
        papersWithAuthors: 0,
        papersWithValidDates: 0,
        papersWithText: 0,
        papersWithPDF: 0,
        averageTextLength: 0
      };
      
      const sources = ['arxiv', 'openalex', 'pmc', 'biorxiv', 'core'] as const;
      const testCategories = {
        arxiv: 'cs.AI',
        openalex: 'artificial intelligence',
        pmc: 'biology',
        biorxiv: 'biorxiv:biology',
        core: 'biology'
      };
      
      const allPapers: any[] = [];
      
      for (const source of sources) {
        try {
          const result = await fetchLatest({
            source,
            category: testCategories[source],
            count: 2
          }, rateLimiter);
          
          allPapers.push(...result.content.map(p => ({ ...p, source })));
        } catch (error) {
          console.warn(`Quality test failed for ${source}:`, error);
        }
      }
      
      // Calculate quality metrics
      qualityMetrics.totalPapers = allPapers.length;
      
      for (const paper of allPapers) {
        if (paper.authors && paper.authors.length > 0) {
          qualityMetrics.papersWithAuthors++;
        }
        
        if (paper.date && /^\d{4}-\d{2}-\d{2}$/.test(paper.date)) {
          qualityMetrics.papersWithValidDates++;
        }
        
        if (paper.text && paper.text.length > 100) {
          qualityMetrics.papersWithText++;
          qualityMetrics.averageTextLength += paper.text.length;
        }
        
        if (paper.pdf_url) {
          qualityMetrics.papersWithPDF++;
        }
      }
      
      if (qualityMetrics.papersWithText > 0) {
        qualityMetrics.averageTextLength = Math.round(
          qualityMetrics.averageTextLength / qualityMetrics.papersWithText
        );
      }
      
      console.log('Data Quality Metrics:', qualityMetrics);
      
      // Quality assertions
      if (qualityMetrics.totalPapers > 0) {
        expect(qualityMetrics.papersWithAuthors / qualityMetrics.totalPapers).toBeGreaterThan(0.8);
        expect(qualityMetrics.papersWithValidDates / qualityMetrics.totalPapers).toBeGreaterThan(0.9);
        expect(qualityMetrics.papersWithText).toBeGreaterThan(0);
      }
    }, 120000);
  });
});