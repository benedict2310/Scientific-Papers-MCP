import { z } from 'zod';
import { ArxivDriver } from '../drivers/arxiv-driver.js';
import { OpenAlexDriver } from '../drivers/openalex-driver.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { logInfo, logError } from '../core/logger.js';
import { DEFAULT_PAPER_COUNT, MAX_PAPER_COUNT } from '../config/constants.js';
import { PaperMetadata } from '../types/papers.js';

// Zod schema for input validation
export const fetchLatestSchema = z.object({
  source: z.enum(['arxiv', 'openalex']),
  category: z.string().min(1),
  count: z.number().min(1).max(MAX_PAPER_COUNT).default(DEFAULT_PAPER_COUNT)
});

export type FetchLatestInput = z.infer<typeof fetchLatestSchema>;

/**
 * MCP tool: fetch_latest
 * Fetches the latest papers from arXiv or OpenAlex for a given category
 */
export async function fetchLatest(
  input: FetchLatestInput,
  rateLimiter: RateLimiter
): Promise<{ content: PaperMetadata[] }> {
  try {
    logInfo('fetch_latest tool called', { 
      source: input.source, 
      category: input.category, 
      count: input.count 
    });

    let papers: PaperMetadata[];

    if (input.source === 'arxiv') {
      const driver = new ArxivDriver(rateLimiter);
      papers = await driver.fetchLatest(input.category, input.count);
    } else {
      const driver = new OpenAlexDriver(rateLimiter);
      papers = await driver.fetchLatest(input.category, input.count);
    }

    logInfo('fetch_latest completed successfully', { 
      source: input.source,
      category: input.category,
      papersReturned: papers.length 
    });

    return { content: papers };

  } catch (error) {
    logError('fetch_latest tool failed', { 
      error: error instanceof Error ? error.message : error,
      source: input.source,
      category: input.category
    });
    throw error;
  }
} 