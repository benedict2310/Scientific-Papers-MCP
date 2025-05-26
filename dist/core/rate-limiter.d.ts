export declare class RateLimiter {
    private state;
    constructor();
    /**
     * Check if a request is allowed for the given source
     */
    checkRateLimit(source: string): boolean;
    /**
     * Get the number of remaining tokens for a source
     */
    getRemainingTokens(source: string): number;
    /**
     * Get retry after time in seconds
     */
    getRetryAfter(source: string): number;
}
