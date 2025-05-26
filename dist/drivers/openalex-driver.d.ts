import { BaseDriver } from './base-driver.js';
import { Category, PaperMetadata } from '../types/papers.js';
import { RateLimiter } from '../core/rate-limiter.js';
export declare class OpenAlexDriver extends BaseDriver {
    private textExtractor;
    constructor(rateLimiter: RateLimiter);
    /**
     * List OpenAlex concepts (categories)
     * Fetches top-level concepts with highest paper counts
     */
    listCategories(): Promise<Category[]>;
    /**
     * Fetch latest papers from OpenAlex for a given concept/category
     */
    fetchLatest(category: string, count: number): Promise<PaperMetadata[]>;
    /**
     * Fetch top cited papers from OpenAlex for a given concept since a date
     */
    fetchTopCited(concept: string, since: string, count: number): Promise<PaperMetadata[]>;
    /**
     * Fetch content for a specific OpenAlex work by ID
     */
    fetchContent(id: string): Promise<PaperMetadata>;
    /**
     * Convert OpenAlex Work to PaperMetadata format
     */
    private convertWorkToPaper;
    /**
     * Build concept filter for OpenAlex API
     */
    private buildConceptFilter;
    /**
     * Extract concept ID from OpenAlex URL format
     * e.g., "https://openalex.org/C41008148" -> "C41008148"
     */
    private extractConceptId;
    /**
     * Extract work ID from OpenAlex URL format
     * e.g., "https://openalex.org/W2741809807" -> "W2741809807"
     */
    private extractWorkId;
    /**
     * Clean OpenAlex ID (normalize format)
     */
    private cleanOpenAlexId;
}
