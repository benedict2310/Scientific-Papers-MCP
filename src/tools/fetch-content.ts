import { z } from "zod";
import { ArxivDriver } from "../drivers/arxiv-driver.js";
import { OpenAlexDriver } from "../drivers/openalex-driver.js";
import { PMCDriver } from "../drivers/pmc-driver.js";
import { EuropePMCDriver } from "../drivers/europepmc-driver.js";
import { BioRxivDriver } from "../drivers/biorxiv-driver.js";
import { CoreDriver } from "../drivers/core-driver.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { logInfo, logError } from "../core/logger.js";
import { PaperMetadata } from "../types/papers.js";

// Zod schema for input validation
export const fetchContentSchema = z.object({
  source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]),
  id: z.string().min(1),
});

export type FetchContentInput = z.infer<typeof fetchContentSchema>;

/**
 * MCP tool: fetch_content
 * Fetches full metadata for a specific paper by ID from arXiv or OpenAlex
 */
export async function fetchContent(
  input: FetchContentInput,
  rateLimiter: RateLimiter,
): Promise<{ content: PaperMetadata }> {
  try {
    logInfo("fetch_content tool called", {
      source: input.source,
      id: input.id,
    });

    let paper: PaperMetadata;

    switch (input.source) {
      case "arxiv": {
        const driver = new ArxivDriver(rateLimiter);
        paper = await driver.fetchContent(input.id);
        break;
      }
      case "openalex": {
        const driver = new OpenAlexDriver(rateLimiter);
        paper = await driver.fetchContent(input.id);
        break;
      }
      case "pmc": {
        const driver = new PMCDriver(rateLimiter);
        paper = await driver.fetchContent(input.id);
        break;
      }
      case "europepmc": {
        const driver = new EuropePMCDriver(rateLimiter);
        paper = await driver.fetchContent(input.id);
        break;
      }
      case "biorxiv": {
        const driver = new BioRxivDriver(rateLimiter);
        paper = await driver.fetchContent(input.id);
        break;
      }
      case "core": {
        const driver = new CoreDriver(rateLimiter);
        paper = await driver.fetchContent(input.id);
        break;
      }
      default:
        throw new Error(`Unsupported source: ${input.source}`);
    }

    logInfo("fetch_content completed successfully", {
      source: input.source,
      id: input.id,
      title: paper.title,
    });

    return { content: paper };
  } catch (error) {
    logError("fetch_content tool failed", {
      error: error instanceof Error ? error.message : error,
      source: input.source,
      id: input.id,
    });
    throw error;
  }
}

// Temporary: Directly print paper text for debugging/direct output
export async function fetchContentAndPrintText(
  input: FetchContentInput,
  rateLimiter: RateLimiter,
): Promise<{ content: PaperMetadata }> {
  const result = await fetchContent(input, rateLimiter);
  if (result.content.text) {
    process.stdout.write(result.content.text);
  }
  return result;
}
