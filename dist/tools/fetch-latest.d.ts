import { z } from 'zod';
import { RateLimiter } from '../core/rate-limiter.js';
import { PaperMetadata } from '../types/papers.js';
export declare const fetchLatestSchema: z.ZodObject<{
    source: z.ZodEnum<["arxiv", "openalex"]>;
    category: z.ZodString;
    count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    source: "arxiv" | "openalex";
    category: string;
    count: number;
}, {
    source: "arxiv" | "openalex";
    category: string;
    count?: number | undefined;
}>;
export type FetchLatestInput = z.infer<typeof fetchLatestSchema>;
/**
 * MCP tool: fetch_latest
 * Fetches the latest papers from arXiv or OpenAlex for a given category
 */
export declare function fetchLatest(input: FetchLatestInput, rateLimiter: RateLimiter): Promise<{
    content: PaperMetadata[];
}>;
