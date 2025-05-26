import axios from 'axios';
import { BaseDriver } from './base-driver.js';
import { OPENALEX_API_BASE, DEFAULT_TEXT_EXTRACTION_CONFIG } from '../config/constants.js';
import { logInfo, logError, logWarn } from '../core/logger.js';
import { HtmlExtractor } from '../extractors/html-extractor.js';
export class OpenAlexDriver extends BaseDriver {
    textExtractor;
    constructor(rateLimiter) {
        super(rateLimiter, 'openalex');
        this.textExtractor = new HtmlExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG);
    }
    /**
     * List OpenAlex concepts (categories)
     * Fetches top-level concepts with highest paper counts
     */
    async listCategories() {
        if (!this.checkRateLimit()) {
            const retryAfter = this.getRetryAfter();
            logWarn('Rate limited when fetching OpenAlex concepts', { retryAfter });
            throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
        }
        try {
            logInfo('Fetching OpenAlex concepts');
            // Fetch top-level concepts (level 0) with highest works count
            const response = await axios.get(`${OPENALEX_API_BASE}/concepts`, {
                params: {
                    filter: 'level:0',
                    sort: 'works_count:desc',
                    per_page: 50,
                    select: 'id,display_name,description,level,works_count'
                },
                timeout: 10000,
                headers: {
                    'User-Agent': 'latest-science-mcp/0.1.0 (https://github.com/futurelab/latest-science-mcp)'
                }
            });
            const concepts = response.data.results;
            logInfo('Successfully fetched OpenAlex concepts', { count: concepts.length });
            return concepts.map(concept => ({
                id: this.extractConceptId(concept.id),
                name: concept.display_name,
                description: concept.description || `${concept.works_count.toLocaleString()} works`
            }));
        }
        catch (error) {
            logError('Failed to fetch OpenAlex concepts', {
                error: error instanceof Error ? error.message : error,
                source: 'openalex'
            });
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    throw new Error('Rate limited by OpenAlex API');
                }
                if (error.response?.status && error.response.status >= 500) {
                    throw new Error('OpenAlex API server error');
                }
            }
            throw error;
        }
    }
    /**
     * Fetch latest papers from OpenAlex for a given concept/category
     */
    async fetchLatest(category, count) {
        if (!this.checkRateLimit()) {
            const retryAfter = this.getRetryAfter();
            logWarn('Rate limited when fetching latest OpenAlex papers', { retryAfter, category });
            throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
        }
        try {
            logInfo('Fetching latest OpenAlex papers', { category, count });
            // Build filter for concept - handle both ID and name
            const conceptFilter = this.buildConceptFilter(category);
            const response = await axios.get(`${OPENALEX_API_BASE}/works`, {
                params: {
                    filter: conceptFilter,
                    sort: 'publication_date:desc',
                    per_page: count,
                    select: 'id,title,display_name,publication_date,authorships,primary_location,cited_by_count,concepts'
                },
                timeout: 15000,
                headers: {
                    'User-Agent': 'latest-science-mcp/0.1.0 (https://github.com/futurelab/latest-science-mcp)'
                }
            });
            // Process works in parallel for better performance (metadata only)
            const paperPromises = response.data.results.map(work => this.convertWorkToPaper(work, false)); // false = metadata only
            const papers = await Promise.all(paperPromises);
            logInfo('Successfully fetched OpenAlex latest papers', { count: papers.length, category });
            return papers;
        }
        catch (error) {
            logError('Failed to fetch latest OpenAlex papers', {
                error: error instanceof Error ? error.message : error,
                category,
                count
            });
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    throw new Error('Rate limited by OpenAlex API');
                }
                if (error.response?.status && error.response.status >= 500) {
                    throw new Error('OpenAlex API server error');
                }
            }
            throw error;
        }
    }
    /**
     * Fetch top cited papers from OpenAlex for a given concept since a date
     */
    async fetchTopCited(concept, since, count) {
        if (!this.checkRateLimit()) {
            const retryAfter = this.getRetryAfter();
            logWarn('Rate limited when fetching top cited OpenAlex papers', { retryAfter, concept });
            throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
        }
        try {
            logInfo('Fetching top cited OpenAlex papers', { concept, since, count });
            // Build filter for concept and date
            const conceptFilter = this.buildConceptFilter(concept);
            const dateFilter = `publication_date:>${since}`;
            const combinedFilter = `${conceptFilter},${dateFilter}`;
            const response = await axios.get(`${OPENALEX_API_BASE}/works`, {
                params: {
                    filter: combinedFilter,
                    sort: 'cited_by_count:desc',
                    per_page: count,
                    select: 'id,title,display_name,publication_date,authorships,primary_location,cited_by_count,concepts'
                },
                timeout: 15000,
                headers: {
                    'User-Agent': 'latest-science-mcp/0.1.0 (https://github.com/futurelab/latest-science-mcp)'
                }
            });
            const paperPromises = response.data.results.map(work => this.convertWorkToPaper(work, false)); // false = metadata only
            const papers = await Promise.all(paperPromises);
            logInfo('Successfully fetched OpenAlex top cited papers', { count: papers.length, concept, since });
            return papers;
        }
        catch (error) {
            logError('Failed to fetch top cited OpenAlex papers', {
                error: error instanceof Error ? error.message : error,
                concept,
                since,
                count
            });
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 429) {
                    throw new Error('Rate limited by OpenAlex API');
                }
                if (error.response?.status && error.response.status >= 500) {
                    throw new Error('OpenAlex API server error');
                }
            }
            throw error;
        }
    }
    /**
     * Fetch content for a specific OpenAlex work by ID
     */
    async fetchContent(id) {
        if (!this.checkRateLimit()) {
            const retryAfter = this.getRetryAfter();
            logWarn('Rate limited when fetching OpenAlex paper content', { retryAfter, id });
            throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
        }
        try {
            logInfo('Fetching OpenAlex paper content', { id });
            // Clean the ID and build URL
            const cleanId = this.cleanOpenAlexId(id);
            const workUrl = cleanId.startsWith('W') ?
                `${OPENALEX_API_BASE}/works/${cleanId}` :
                `${OPENALEX_API_BASE}/works/https://openalex.org/${cleanId}`;
            const response = await axios.get(workUrl, {
                params: {
                    select: 'id,title,display_name,publication_date,authorships,primary_location,cited_by_count,concepts'
                },
                timeout: 15000,
                headers: {
                    'User-Agent': 'latest-science-mcp/0.1.0 (https://github.com/futurelab/latest-science-mcp)'
                }
            });
            const paper = await this.convertWorkToPaper(response.data, true);
            logInfo('Successfully fetched OpenAlex paper content', { id, title: paper.title });
            return paper;
        }
        catch (error) {
            logError('Failed to fetch OpenAlex paper content', {
                error: error instanceof Error ? error.message : error,
                id
            });
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 404) {
                    throw new Error(`Paper with ID ${id} not found on OpenAlex`);
                }
                if (error.response?.status === 429) {
                    throw new Error('Rate limited by OpenAlex API');
                }
                if (error.response?.status && error.response.status >= 500) {
                    throw new Error('OpenAlex API server error');
                }
            }
            throw error;
        }
    }
    /**
     * Convert OpenAlex Work to PaperMetadata format
     */
    async convertWorkToPaper(work, includeText = false) {
        // Extract authors
        const authors = work.authorships.map(authorship => authorship.author.display_name);
        // Extract date (ensure it's in ISO format)
        const date = work.publication_date || new Date().toISOString().split('T')[0];
        // Extract PDF URL if available
        const pdf_url = work.primary_location?.pdf_url;
        // Create base paper object
        const paper = {
            id: this.extractWorkId(work.id),
            title: work.title || work.display_name || 'Untitled',
            authors,
            date,
            pdf_url,
            text: '' // Always include text field, empty for metadata-only
        };
        // Only extract text if requested (for fetch_content)
        if (includeText) {
            let textTruncated = false;
            let textExtractionFailed = false;
            try {
                // Only extract text if HTML source is available and extraction is enabled
                if (work.primary_location?.source_type === 'html' &&
                    work.primary_location?.landing_page_url &&
                    this.checkRateLimit()) {
                    const extractionResult = await this.textExtractor.extractText(work.primary_location.landing_page_url);
                    if (extractionResult.extractionSuccess) {
                        paper.text = extractionResult.text;
                        textTruncated = extractionResult.truncated;
                        logInfo('Text extraction successful for OpenAlex paper', {
                            id: this.extractWorkId(work.id),
                            textLength: paper.text.length,
                            truncated: textTruncated,
                            source: extractionResult.source
                        });
                    }
                    else {
                        textExtractionFailed = true;
                        logWarn('Text extraction failed for OpenAlex paper', { id: this.extractWorkId(work.id) });
                    }
                }
                else {
                    // Skip text extraction if no HTML source or rate limited
                    if (!work.primary_location?.source_type || work.primary_location.source_type !== 'html') {
                        logInfo('Skipping text extraction - no HTML source available', {
                            id: this.extractWorkId(work.id),
                            sourceType: work.primary_location?.source_type
                        });
                    }
                    else if (!this.checkRateLimit()) {
                        textExtractionFailed = true;
                        logWarn('Rate limited for text extraction', { id: this.extractWorkId(work.id) });
                    }
                }
            }
            catch (error) {
                textExtractionFailed = true;
                logError('Error during text extraction for OpenAlex paper', {
                    id: this.extractWorkId(work.id),
                    error: error instanceof Error ? error.message : error
                });
            }
            // Add warning flags if needed
            if (textTruncated) {
                paper.textTruncated = true;
            }
            if (textExtractionFailed) {
                paper.textExtractionFailed = true;
            }
        }
        return paper;
    }
    /**
     * Build concept filter for OpenAlex API
     */
    buildConceptFilter(category) {
        // Handle different input formats
        if (category.startsWith('C') && /^C\d+$/.test(category)) {
            // Already an OpenAlex concept ID
            return `concepts.id:https://openalex.org/${category}`;
        }
        else if (category.startsWith('https://openalex.org/C')) {
            // Full OpenAlex URL
            return `concepts.id:${category}`;
        }
        else {
            // Assume it's a concept name or search term
            return `concepts.display_name.search:${category}`;
        }
    }
    /**
     * Extract concept ID from OpenAlex URL format
     * e.g., "https://openalex.org/C41008148" -> "C41008148"
     */
    extractConceptId(openAlexId) {
        const match = openAlexId.match(/\/([^\/]+)$/);
        return match ? match[1] : openAlexId;
    }
    /**
     * Extract work ID from OpenAlex URL format
     * e.g., "https://openalex.org/W2741809807" -> "W2741809807"
     */
    extractWorkId(openAlexId) {
        const match = openAlexId.match(/\/([^\/]+)$/);
        return match ? match[1] : openAlexId;
    }
    /**
     * Clean OpenAlex ID (normalize format)
     */
    cleanOpenAlexId(id) {
        // Remove URL prefix if present
        if (id.startsWith('https://openalex.org/')) {
            return id.replace('https://openalex.org/', '');
        }
        return id;
    }
}
//# sourceMappingURL=openalex-driver.js.map