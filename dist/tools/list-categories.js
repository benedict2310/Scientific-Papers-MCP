import { ArxivDriver } from '../drivers/arxiv-driver.js';
import { OpenAlexDriver } from '../drivers/openalex-driver.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { logInfo } from '../core/logger.js';
// Create a single rate limiter instance for the whole application
let globalRateLimiter = null;
function getRateLimiter() {
    if (!globalRateLimiter) {
        globalRateLimiter = new RateLimiter();
    }
    return globalRateLimiter;
}
export async function listCategories(params) {
    const { source } = params;
    logInfo('MCP tool called', { tool: 'list_categories', source });
    const rateLimiter = getRateLimiter();
    let driver;
    switch (source) {
        case 'arxiv':
            driver = new ArxivDriver(rateLimiter);
            break;
        case 'openalex':
            driver = new OpenAlexDriver(rateLimiter);
            break;
        default:
            throw new Error(`Unsupported source: ${source}`);
    }
    const categories = await driver.listCategories();
    return {
        source,
        categories
    };
}
//# sourceMappingURL=list-categories.js.map