import { z } from 'zod';
import { ArxivDriver } from '../drivers/arxiv-driver.js';
import { OpenAlexDriver } from '../drivers/openalex-driver.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { logInfo, logError } from '../core/logger.js';
import { PaperMetadata } from '../types/papers.js';

// Zod schema for input validation
export const fetchContentSchema = z.object({
  source: z.enum(['arxiv', 'openalex']),
  id: z.string().min(1)
});

export type FetchContentInput = z.infer<typeof fetchContentSchema>;

/**
 * MCP tool: fetch_content
 * Fetches full metadata for a specific paper by ID from arXiv or OpenAlex
 */
export async function fetchContent(
  input: FetchContentInput,
  rateLimiter: RateLimiter
): Promise<{ content: PaperMetadata }> {
  try {
    logInfo('fetch_content tool called', { 
      source: input.source, 
      id: input.id 
    });

    let paper: PaperMetadata;

    if (input.source === 'arxiv') {
      const driver = new ArxivDriver(rateLimiter);
      paper = await driver.fetchContent(input.id);
    } else {
      const driver = new OpenAlexDriver(rateLimiter);
      paper = await driver.fetchContent(input.id);
    }

    logInfo('fetch_content completed successfully', { 
      source: input.source,
      id: input.id,
      title: paper.title 
    });

    return { content: paper };

  } catch (error) {
    logError('fetch_content tool failed', { 
      error: error instanceof Error ? error.message : error,
      source: input.source,
      id: input.id
    });
    throw error;
  }
} 