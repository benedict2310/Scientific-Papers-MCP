import { z } from "zod";
import { ArxivDriver } from "../drivers/arxiv-driver.js";
import { OpenAlexDriver } from "../drivers/openalex-driver.js";
import { PMCDriver } from "../drivers/pmc-driver.js";
import { EuropePMCDriver } from "../drivers/europepmc-driver.js";
import { BioRxivDriver } from "../drivers/biorxiv-driver.js";
import { CoreDriver } from "../drivers/core-driver.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { logInfo, logError } from "../core/logger.js";
import { DEFAULT_PAPER_COUNT, MAX_PAPER_COUNT } from "../config/constants.js";
import { PaperMetadata } from "../types/papers.js";

// Zod schema for input validation
export const fetchLatestSchema = z.object({
  source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]),
  category: z.string().min(1),
  count: z.number().min(1).max(MAX_PAPER_COUNT).default(DEFAULT_PAPER_COUNT),
});

export type FetchLatestInput = z.infer<typeof fetchLatestSchema>;

/**
 * MCP tool: fetch_latest
 * Fetches the latest papers from arXiv or OpenAlex for a given category
 */
export async function fetchLatest(
  input: FetchLatestInput,
  rateLimiter: RateLimiter,
): Promise<{ content: PaperMetadata[] }> {
  try {
    logInfo("fetch_latest tool called", {
      source: input.source,
      category: input.category,
      count: input.count,
    });

    let papers: PaperMetadata[];

    switch (input.source) {
      case "arxiv": {
        const driver = new ArxivDriver(rateLimiter);
        papers = await driver.fetchLatest(input.category, input.count);
        break;
      }
      case "openalex": {
        const driver = new OpenAlexDriver(rateLimiter);
        papers = await driver.fetchLatest(input.category, input.count);
        break;
      }
      case "pmc": {
        const driver = new PMCDriver(rateLimiter);
        papers = await driver.fetchLatest(input.category, input.count);
        break;
      }
      case "europepmc": {
        const driver = new EuropePMCDriver(rateLimiter);
        papers = await driver.fetchLatest(input.category, input.count);
        break;
      }
      case "biorxiv": {
        const driver = new BioRxivDriver(rateLimiter);
        papers = await driver.fetchLatest(input.category, input.count);
        break;
      }
      case "core": {
        const driver = new CoreDriver(rateLimiter);
        papers = await driver.fetchLatest(input.category, input.count);
        break;
      }
      default:
        throw new Error(`Unsupported source: ${input.source}`);
    }

    logInfo("fetch_latest completed successfully", {
      source: input.source,
      category: input.category,
      papersReturned: papers.length,
    });

    return { content: papers };
  } catch (error) {
    logError("fetch_latest tool failed", {
      error: error instanceof Error ? error.message : error,
      source: input.source,
      category: input.category,
    });
    throw error;
  }
}
