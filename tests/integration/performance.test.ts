/**
 * Performance Benchmarking Tests
 * 
 * Tests response times, throughput, and resource usage across all sources
 * Validates performance requirements and identifies bottlenecks
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { RateLimiter } from '../../src/core/rate-limiter.js';
import { listCategories } from '../../src/tools/list-categories.js';
import { fetchLatest } from '../../src/tools/fetch-latest.js';
import { fetchContent } from '../../src/tools/fetch-content.js';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  categoryListing: 5000,    // 5 seconds max for category listing
  paperFetching: 15000,     // 15 seconds max for paper fetching
  contentFetching: 20000,   // 20 seconds max for content fetching
  memoryLeakThreshold: 100, // Max 100MB memory increase during tests
};

interface PerformanceMetrics {
  operation: string;
  source: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  success: boolean;
  error?: string;
}

describe('Performance Benchmarking Tests', () => {
  let rateLimiter: RateLimiter;
  let performanceLog: PerformanceMetrics[] = [];

  beforeAll(() => {
    rateLimiter = new RateLimiter();
  });

  function measurePerformance<T>(
    operation: string, 
    source: string, 
    fn: () => Promise<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    return new Promise(async (resolve, reject) => {
      const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const startTime = Date.now();
      
      try {
        const result = await fn();
        const endTime = Date.now();
        const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        
        const metrics: PerformanceMetrics = {
          operation,
          source,
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryBefore,
          memoryAfter,
          success: true
        };
        
        performanceLog.push(metrics);
        resolve({ result, metrics });
      } catch (error) {
        const endTime = Date.now();
        const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024; // MB
        
        const metrics: PerformanceMetrics = {
          operation,
          source,
          startTime,
          endTime,
          duration: endTime - startTime,
          memoryBefore,
          memoryAfter,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
        
        performanceLog.push(metrics);
        reject(error);
      }
    });
  }

  describe('Category Listing Performance', () => {
    const sources = ['arxiv', 'openalex', 'pmc', 'europepmc', 'biorxiv', 'core'] as const;

    test.each(sources)('should list %s categories within time threshold', async (source) => {
      const { metrics } = await measurePerformance(
        'list-categories',
        source,
        () => listCategories({ source })
      );

      expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.categoryListing);
      expect(metrics.success).toBe(true);
      
      console.log(`${source} categories listed in ${metrics.duration}ms`);
    });

    test('category listing performance comparison', async () => {
      const results: { source: string; duration: number }[] = [];
      
      for (const source of sources) {
        try {
          const { metrics } = await measurePerformance(
            'list-categories-benchmark',
            source,
            () => listCategories({ source })
          );
          results.push({ source, duration: metrics.duration });
        } catch (error) {
          console.warn(`Failed to benchmark ${source}:`, error);
        }
      }

      expect(results.length).toBeGreaterThan(0);
      
      // Sort by performance
      results.sort((a, b) => a.duration - b.duration);
      
      console.log('Category Listing Performance Ranking:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.source}: ${result.duration}ms`);
      });
      
      // Fastest should be under 2 seconds
      expect(results[0].duration).toBeLessThan(2000);
    });
  });

  describe('Paper Fetching Performance', () => {
    const testCases = [
      { source: 'arxiv' as const, category: 'cs.AI', count: 5 },
      { source: 'openalex' as const, category: 'artificial intelligence', count: 5 },
      { source: 'pmc' as const, category: 'immunology', count: 3 },
      { source: 'europepmc' as const, category: 'biology', count: 3 },
      { source: 'biorxiv' as const, category: 'biorxiv:neuroscience', count: 3 },
      { source: 'core' as const, category: 'computer_science', count: 3 }
    ];

    test.each(testCases)('should fetch papers from $source within time threshold', async ({ source, category, count }) => {
      const { result, metrics } = await measurePerformance(
        'fetch-latest',
        source,
        () => fetchLatest({ source, category, count }, rateLimiter)
      );

      expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.paperFetching);
      expect(metrics.success).toBe(true);
      
      if (result.content.length > 0) {
        const avgTimePerPaper = metrics.duration / result.content.length;
        console.log(`${source}: ${result.content.length} papers in ${metrics.duration}ms (${avgTimePerPaper.toFixed(0)}ms/paper)`);
      }
    });

    test('paper fetching throughput analysis', async () => {
      const throughputResults: { source: string; papersPerSecond: number; totalPapers: number }[] = [];
      
      for (const testCase of testCases) {
        try {
          const { result, metrics } = await measurePerformance(
            'fetch-latest-throughput',
            testCase.source,
            () => fetchLatest(testCase, rateLimiter)
          );
          
          const papersPerSecond = (result.content.length / metrics.duration) * 1000;
          throughputResults.push({
            source: testCase.source,
            papersPerSecond,
            totalPapers: result.content.length
          });
        } catch (error) {
          console.warn(`Throughput test failed for ${testCase.source}:`, error);
        }
      }

      expect(throughputResults.length).toBeGreaterThan(0);
      
      console.log('Paper Fetching Throughput:');
      throughputResults
        .sort((a, b) => b.papersPerSecond - a.papersPerSecond)
        .forEach(result => {
          console.log(`${result.source}: ${result.papersPerSecond.toFixed(2)} papers/sec (${result.totalPapers} papers)`);
        });
    });
  });

  describe('Content Fetching Performance', () => {
    test('content fetching speed across sources', async () => {
      const contentResults: { source: string; duration: number; textLength: number }[] = [];
      
      // Get sample papers from each source first
      const samplePapers = await Promise.allSettled([
        fetchLatest({ source: 'arxiv', category: 'cs.AI', count: 1 }, rateLimiter),
        fetchLatest({ source: 'openalex', category: 'artificial intelligence', count: 1 }, rateLimiter),
      ]);

      // Test content fetching for available papers
      for (let i = 0; i < samplePapers.length; i++) {
        const result = samplePapers[i];
        if (result.status === 'fulfilled' && result.value.content.length > 0) {
          const paper = result.value.content[0];
          const source = i === 0 ? 'arxiv' : 'openalex';
          
          try {
            const { result: content, metrics } = await measurePerformance(
              'fetch-content',
              source,
              () => fetchContent({ source: source as any, id: paper.id }, rateLimiter)
            );

            contentResults.push({
              source,
              duration: metrics.duration,
              textLength: content.content.text.length
            });

            expect(metrics.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.contentFetching);
          } catch (error) {
            console.warn(`Content fetch failed for ${source}:`, error);
          }
        }
      }

      if (contentResults.length > 0) {
        console.log('Content Fetching Performance:');
        contentResults.forEach(result => {
          const charsPerMs = result.textLength / result.duration;
          console.log(`${result.source}: ${result.duration}ms for ${result.textLength} chars (${charsPerMs.toFixed(2)} chars/ms)`);
        });
      }
    });
  });

  describe('Memory Usage Analysis', () => {
    test('memory usage during extended operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      
      // Perform multiple operations to test for memory leaks
      const operations = [
        () => listCategories({ source: 'arxiv' }),
        () => listCategories({ source: 'openalex' }),
        () => fetchLatest({ source: 'arxiv', category: 'cs.AI', count: 3 }, rateLimiter),
        () => fetchLatest({ source: 'openalex', category: 'artificial intelligence', count: 3 }, rateLimiter),
      ];

      for (const operation of operations) {
        try {
          await operation();
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        } catch (error) {
          console.warn('Memory test operation failed:', error);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`Memory usage: ${initialMemory.toFixed(2)}MB → ${finalMemory.toFixed(2)}MB (${memoryIncrease > 0 ? '+' : ''}${memoryIncrease.toFixed(2)}MB)`);
      
      // Should not have significant memory leaks
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryLeakThreshold);
    });
  });

  describe('Rate Limiting Performance', () => {
    test('rate limiter efficiency', async () => {
      const testRateLimiter = new RateLimiter();
      const startTime = Date.now();
      
      // Make several requests to test rate limiting behavior
      const requests = Array(5).fill(null).map((_, i) => 
        measurePerformance(
          'rate-limit-test',
          'arxiv',
          () => fetchLatest({ source: 'arxiv', category: 'cs.AI', count: 1 }, testRateLimiter)
        )
      );

      const results = await Promise.allSettled(requests);
      const totalTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - successful;
      
      console.log(`Rate limiting test: ${successful} successful, ${failed} failed in ${totalTime}ms`);
      
      // Should handle rate limiting gracefully
      expect(successful).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute
    });
  });

  describe('Performance Summary', () => {
    test('generate performance report', async () => {
      // Wait for all performance tests to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const report = {
        totalOperations: performanceLog.length,
        successfulOperations: performanceLog.filter(p => p.success).length,
        averageDuration: performanceLog.reduce((sum, p) => sum + p.duration, 0) / performanceLog.length,
        operationBreakdown: {} as Record<string, { count: number; avgDuration: number; successRate: number }>
      };

      // Group by operation type
      const operationGroups = performanceLog.reduce((groups, metric) => {
        if (!groups[metric.operation]) {
          groups[metric.operation] = [];
        }
        groups[metric.operation].push(metric);
        return groups;
      }, {} as Record<string, PerformanceMetrics[]>);

      // Calculate statistics for each operation
      for (const [operation, metrics] of Object.entries(operationGroups)) {
        const successful = metrics.filter(m => m.success);
        report.operationBreakdown[operation] = {
          count: metrics.length,
          avgDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
          successRate: successful.length / metrics.length
        };
      }

      console.log('\n=== PERFORMANCE REPORT ===');
      console.log(`Total Operations: ${report.totalOperations}`);
      console.log(`Success Rate: ${((report.successfulOperations / report.totalOperations) * 100).toFixed(1)}%`);
      console.log(`Average Duration: ${report.averageDuration.toFixed(0)}ms`);
      console.log('\nOperation Breakdown:');
      
      Object.entries(report.operationBreakdown).forEach(([operation, stats]) => {
        console.log(`  ${operation}:`);
        console.log(`    Count: ${stats.count}`);
        console.log(`    Avg Duration: ${stats.avgDuration.toFixed(0)}ms`);
        console.log(`    Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
      });

      // Performance assertions
      expect(report.successfulOperations / report.totalOperations).toBeGreaterThan(0.7); // 70% success rate
      expect(report.averageDuration).toBeLessThan(30000); // Average under 30 seconds
    });
  });
});