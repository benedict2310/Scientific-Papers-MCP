import { z } from 'zod';
import { RateLimiter } from '../core/rate-limiter.js';
import { PaperMetadata } from '../types/papers.js';
export declare const fetchTopCitedSchema: z.ZodObject<{
    concept: z.ZodString;
    since: z.ZodString;
    count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    count: number;
    concept: string;
    since: string;
}, {
    concept: string;
    since: string;
    count?: number | undefined;
}>;
export type FetchTopCitedInput = z.infer<typeof fetchTopCitedSchema>;
/**
 * MCP tool: fetch_top_cited
 * Fetches the top cited papers from OpenAlex for a given concept since a specific date
 * Note: This tool is OpenAlex-specific as arXiv doesn't provide citation data
 */
export declare function fetchTopCited(input: FetchTopCitedInput, rateLimiter: RateLimiter): Promise<{
    content: PaperMetadata[];
}>;
