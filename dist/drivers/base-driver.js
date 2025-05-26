export class BaseDriver {
    rateLimiter;
    source;
    constructor(rateLimiter, source) {
        this.rateLimiter = rateLimiter;
        this.source = source;
    }
    /**
     * Check rate limit before making requests
     */
    checkRateLimit() {
        return this.rateLimiter.checkRateLimit(this.source);
    }
    /**
     * Get retry after time if rate limited
     */
    getRetryAfter() {
        return this.rateLimiter.getRetryAfter(this.source);
    }
}
//# sourceMappingURL=base-driver.js.map