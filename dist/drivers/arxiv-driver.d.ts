import { BaseDriver } from './base-driver.js';
import { Category, PaperMetadata } from '../types/papers.js';
import { RateLimiter } from '../core/rate-limiter.js';
export declare class ArxivDriver extends BaseDriver {
    private textExtractor;
    constructor(rateLimiter: RateLimiter);
    /**
     * List arXiv categories
     * For MVP, we return a predefined list of common categories
     * Future versions could fetch this dynamically
     */
    listCategories(): Promise<Category[]>;
    /**
     * Fetch latest papers from arXiv for a given category
     */
    fetchLatest(category: string, count: number): Promise<PaperMetadata[]>;
    /**
     * Fetch content for a specific arXiv paper by ID
     */
    fetchContent(id: string): Promise<PaperMetadata>;
    /**
     * Parse arXiv XML response and extract paper metadata
     */
    private parseArxivResponse;
    /**
     * Parse individual arXiv entry from XML
     */
    private parseArxivEntry;
    /**
     * Extract arXiv ID from full URL
     */
    private extractArxivId;
    /**
     * Clean arXiv ID (remove version, normalize format)
     */
    private cleanArxivId;
    /**
     * Clean XML text content
     */
    private cleanXmlText;
    /**
     * Future method: Fetch categories dynamically from arXiv
     * This could be implemented later if arXiv provides a categories endpoint
     */
    private fetchCategoriesDynamically;
}
