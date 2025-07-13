import { z } from "zod";
import { OpenAlexDriver } from "../drivers/openalex-driver.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { logInfo, logError } from "../core/logger.js";
import { DEFAULT_PAPER_COUNT, MAX_PAPER_COUNT } from "../config/constants.js";
import { PaperMetadata } from "../types/papers.js";

// Zod schema for input validation
export const fetchTopCitedSchema = z.object({
  concept: z.string().min(1),
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  count: z.number().min(1).max(MAX_PAPER_COUNT).default(DEFAULT_PAPER_COUNT),
});

export type FetchTopCitedInput = z.infer<typeof fetchTopCitedSchema>;

/**
 * MCP tool: fetch_top_cited
 * Fetches the top cited papers from OpenAlex for a given concept since a specific date
 * Note: This tool is OpenAlex-specific as arXiv doesn't provide citation data
 */
export async function fetchTopCited(
  input: FetchTopCitedInput,
  rateLimiter: RateLimiter,
): Promise<{ content: PaperMetadata[] }> {
  try {
    logInfo("fetch_top_cited tool called", {
      concept: input.concept,
      since: input.since,
      count: input.count,
    });

    const driver = new OpenAlexDriver(rateLimiter);
    const papers = await driver.fetchTopCited(
      input.concept,
      input.since,
      input.count,
    );

    logInfo("fetch_top_cited completed successfully", {
      concept: input.concept,
      since: input.since,
      papersReturned: papers.length,
    });

    return { content: papers };
  } catch (error) {
    logError("fetch_top_cited tool failed", {
      error: error instanceof Error ? error.message : error,
      concept: input.concept,
      since: input.since,
    });
    throw error;
  }
}
