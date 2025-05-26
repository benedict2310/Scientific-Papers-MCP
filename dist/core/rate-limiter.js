import { DEFAULT_RATE_LIMITS } from '../config/constants.js';
import { logWarn } from './logger.js';
export class RateLimiter {
    state = {};
    constructor() {
        // Initialize rate limiters for each source
        Object.keys(DEFAULT_RATE_LIMITS).forEach(source => {
            const config = DEFAULT_RATE_LIMITS[source];
            this.state[source] = {
                tokens: config.maxTokens,
                lastRefill: Date.now(),
                maxTokens: config.maxTokens,
                refillRate: config.refillRate
            };
        });
    }
    /**
     * Check if a request is allowed for the given source
     */
    checkRateLimit(source) {
        const limiter = this.state[source];
        if (!limiter) {
            // Unknown source, allow by default but log warning
            logWarn('Unknown source for rate limiting', { source });
            return true;
        }
        // Refill tokens based on time elapsed
        const now = Date.now();
        const timeSinceLastRefill = (now - limiter.lastRefill) / 1000; // convert to seconds
        const tokensToAdd = timeSinceLastRefill * limiter.refillRate;
        limiter.tokens = Math.min(limiter.maxTokens, limiter.tokens + tokensToAdd);
        limiter.lastRefill = now;
        // Check if we have tokens available
        if (limiter.tokens >= 1) {
            limiter.tokens -= 1;
            return true;
        }
        // Rate limited
        logWarn('Rate limit reached', {
            source,
            remainingTokens: limiter.tokens,
            nextRefillIn: (1 - limiter.tokens) / limiter.refillRate
        });
        return false;
    }
    /**
     * Get the number of remaining tokens for a source
     */
    getRemainingTokens(source) {
        return this.state[source]?.tokens || 0;
    }
    /**
     * Get retry after time in seconds
     */
    getRetryAfter(source) {
        const limiter = this.state[source];
        if (!limiter)
            return 0;
        // Time until we have at least 1 token
        return Math.ceil((1 - limiter.tokens) / limiter.refillRate);
    }
}
//# sourceMappingURL=rate-limiter.js.map