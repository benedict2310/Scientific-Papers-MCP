import { z } from "zod";
import { ArxivDriver } from "../drivers/arxiv-driver.js";
import { OpenAlexDriver } from "../drivers/openalex-driver.js";
import { EuropePMCDriver } from "../drivers/europepmc-driver.js";
import { CoreDriver } from "../drivers/core-driver.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { logInfo, logError } from "../core/logger.js";
import { DEFAULT_PAPER_COUNT, MAX_PAPER_COUNT } from "../config/constants.js";
import { PaperMetadata } from "../types/papers.js";

// Zod schema for input validation
export const searchPapersSchema = z.object({
  source: z.enum(["arxiv", "openalex", "europepmc", "core"]),
  query: z.string().min(1).max(1500), // Max 1500 chars based on EuropePMC limit
  field: z.enum(["all", "title", "abstract", "author", "fulltext"]).optional().default("all"),
  count: z.number().min(1).max(MAX_PAPER_COUNT).default(DEFAULT_PAPER_COUNT),
  sortBy: z.enum(["relevance", "date", "citations"]).optional().default("relevance"),
});

export type SearchPapersInput = z.infer<typeof searchPapersSchema>;

/**
 * MCP tool: search_papers
 * Search for papers across different sources with query and field-specific options
 */
export async function searchPapers(
  input: SearchPapersInput,
  rateLimiter: RateLimiter,
): Promise<{ content: PaperMetadata[] }> {
  try {
    logInfo("search_papers tool called", {
      source: input.source,
      query: input.query,
      field: input.field,
      count: input.count,
      sortBy: input.sortBy,
    });

    let papers: PaperMetadata[];

    switch (input.source) {
      case "arxiv": {
        const driver = new ArxivDriver(rateLimiter);
        papers = await driver.searchPapers(
          input.query,
          input.field,
          input.count,
          input.sortBy,
        );
        break;
      }
      case "openalex": {
        const driver = new OpenAlexDriver(rateLimiter);
        papers = await driver.searchPapers(
          input.query,
          input.field,
          input.count,
          input.sortBy,
        );
        break;
      }
      case "europepmc": {
        const driver = new EuropePMCDriver(rateLimiter);
        papers = await driver.searchPapers(
          input.query,
          input.field,
          input.count,
          input.sortBy,
        );
        break;
      }
      case "core": {
        const driver = new CoreDriver(rateLimiter);
        papers = await driver.searchPapers(
          input.query,
          input.field,
          input.count,
          input.sortBy,
        );
        break;
      }
      default:
        throw new Error(`Unsupported source: ${input.source}`);
    }

    logInfo("search_papers completed successfully", {
      source: input.source,
      query: input.query,
      field: input.field,
      papersReturned: papers.length,
    });

    return { content: papers };
  } catch (error) {
    logError("search_papers tool failed", {
      error: error instanceof Error ? error.message : error,
      source: input.source,
      query: input.query,
      field: input.field,
    });
    throw error;
  }
}