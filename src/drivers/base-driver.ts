import { Category, PaperMetadata } from '../types/papers.js';
import { RateLimiter } from '../core/rate-limiter.js';

export abstract class BaseDriver {
  protected rateLimiter: RateLimiter;
  protected source: string;

  constructor(rateLimiter: RateLimiter, source: string) {
    this.rateLimiter = rateLimiter;
    this.source = source;
  }

  /**
   * List available categories/concepts for this source
   */
  abstract listCategories(): Promise<Category[]>;

  /**
   * Fetch latest papers for a given category
   */
  abstract fetchLatest(category: string, count: number): Promise<PaperMetadata[]>;

  /**
   * Fetch content for a specific paper by ID
   */
  abstract fetchContent(id: string): Promise<PaperMetadata>;

  /**
   * Check rate limit before making requests
   */
  protected checkRateLimit(): boolean {
    return this.rateLimiter.checkRateLimit(this.source);
  }

  /**
   * Get retry after time if rate limited
   */
  protected getRetryAfter(): number {
    return this.rateLimiter.getRetryAfter(this.source);
  }
} 