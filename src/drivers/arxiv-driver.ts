import axios from 'axios';
import { BaseDriver } from './base-driver.js';
import { Category, PaperMetadata } from '../types/papers.js';
import { ARXIV_API_BASE, ARXIV_CATEGORIES, DEFAULT_TEXT_EXTRACTION_CONFIG, ARXIV_HTML_BASE } from '../config/constants.js';
import { logInfo, logError, logWarn } from '../core/logger.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { HtmlExtractor } from '../extractors/html-extractor.js';

// arXiv API XML response types
interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  author: Array<{ name: string }> | { name: string };
  published: string;
  link: Array<{ href: string; type?: string; rel?: string }>;
}

export class ArxivDriver extends BaseDriver {
  private textExtractor: HtmlExtractor;

  constructor(rateLimiter: RateLimiter) {
    super(rateLimiter, 'arxiv');
    this.textExtractor = new HtmlExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG);
  }

  /**
   * List arXiv categories
   * For MVP, we return a predefined list of common categories
   * Future versions could fetch this dynamically
   */
  async listCategories(): Promise<Category[]> {
    logInfo('Listing arXiv categories');
    
    // For MVP, return predefined categories without API call
    // This avoids unnecessary API calls for static data
    return ARXIV_CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description
    }));
  }

  /**
   * Fetch latest papers from arXiv for a given category
   */
  async fetchLatest(category: string, count: number): Promise<PaperMetadata[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn('Rate limited when fetching latest arXiv papers', { retryAfter, category });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo('Fetching latest arXiv papers', { category, count });

      // Build search query for arXiv API
      const searchQuery = `cat:${category}`;
      const response = await axios.get(`${ARXIV_API_BASE}`, {
        params: {
          search_query: searchQuery,
          start: 0,
          max_results: count,
          sortBy: 'submittedDate',
          sortOrder: 'descending'
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'latest-science-mcp/0.1.0 (https://github.com/futurelab/latest-science-mcp)'
        }
      });

      // Parse XML response (arXiv returns Atom XML)
      const papers = await this.parseArxivResponse(response.data, false);
      logInfo('Successfully fetched arXiv papers', { count: papers.length, category });

      return papers;

    } catch (error) {
      logError('Failed to fetch latest arXiv papers', { 
        error: error instanceof Error ? error.message : error,
        category,
        count 
      });
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('arXiv API request timed out');
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('arXiv API server error');
        }
      }
      
      throw error;
    }
  }

  /**
   * Fetch content for a specific arXiv paper by ID
   */
  async fetchContent(id: string): Promise<PaperMetadata> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn('Rate limited when fetching arXiv paper content', { retryAfter, id });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo('Fetching arXiv paper content', { id });

      // Clean the ID (remove version if present, ensure format)
      const cleanId = this.cleanArxivId(id);
      const response = await axios.get(`${ARXIV_API_BASE}`, {
        params: {
          id_list: cleanId,
          max_results: 1
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'latest-science-mcp/0.1.0 (https://github.com/futurelab/latest-science-mcp)'
        }
      });

      const papers = await this.parseArxivResponse(response.data, true);
      
      if (papers.length === 0) {
        throw new Error(`Paper with ID ${id} not found on arXiv`);
      }

      logInfo('Successfully fetched arXiv paper content', { id, title: papers[0].title });
      return papers[0];

    } catch (error) {
      logError('Failed to fetch arXiv paper content', { 
        error: error instanceof Error ? error.message : error,
        id 
      });
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('arXiv API request timed out');
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error('arXiv API server error');
        }
      }
      
      throw error;
    }
  }

  /**
   * Parse arXiv XML response and extract paper metadata
   */
  private async parseArxivResponse(xmlData: string, includeText: boolean = false): Promise<PaperMetadata[]> {
    // Simple XML parsing for arXiv Atom feed
    // In production, consider using a proper XML parser like xml2js
    const papers: PaperMetadata[] = [];
    
    // Extract entries from XML (basic regex-based parsing for MVP)
    const entryRegex = /<entry>(.*?)<\/entry>/gs;
    const entries = xmlData.match(entryRegex) || [];

    // Process entries in parallel for better performance
    const paperPromises = entries.map(async (entry) => {
      try {
        return await this.parseArxivEntry(entry, includeText);
      } catch (error) {
        logWarn('Failed to parse arXiv entry', { error: error instanceof Error ? error.message : error });
        return null;
      }
    });

    const results = await Promise.all(paperPromises);
    
    // Filter out null results
    return results.filter((paper): paper is PaperMetadata => paper !== null);
  }

  /**
   * Parse individual arXiv entry from XML
   */
  private async parseArxivEntry(entryXml: string, includeText: boolean = false): Promise<PaperMetadata | null> {
    try {
      // Extract ID
      const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
      if (!idMatch) return null;
      const fullId = idMatch[1];
      const id = this.extractArxivId(fullId);

      // Extract title
      const titleMatch = entryXml.match(/<title>(.*?)<\/title>/s);
      if (!titleMatch) return null;
      const title = this.cleanXmlText(titleMatch[1]);

      // Extract authors
      const authorMatches = entryXml.match(/<author>.*?<name>(.*?)<\/name>.*?<\/author>/gs) || [];
      const authors = authorMatches.map(match => {
        const nameMatch = match.match(/<name>(.*?)<\/name>/);
        return nameMatch ? this.cleanXmlText(nameMatch[1]) : '';
      }).filter(author => author);

      // Extract published date
      const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/);
      if (!publishedMatch) return null;
      const date = publishedMatch[1].split('T')[0]; // Extract date part only

      // Extract PDF URL
      const linkMatches = entryXml.match(/<link.*?href="(.*?)".*?(?:type="(.*?)")?.*?\/>/g) || [];
      let pdf_url: string | undefined;
      
      for (const linkMatch of linkMatches) {
        const hrefMatch = linkMatch.match(/href="(.*?)"/);
        const typeMatch = linkMatch.match(/type="(.*?)"/);
        
        if (hrefMatch && (!typeMatch || typeMatch[1].includes('pdf'))) {
          pdf_url = hrefMatch[1].replace('/abs/', '/pdf/') + '.pdf';
          break;
        }
      }

      // Create base paper object
      const paper: PaperMetadata = {
        id,
        title,
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
          // Check rate limit for text extraction
          if (this.checkRateLimit()) {
            const htmlUrl = `${ARXIV_HTML_BASE}/${id}`;
            const extractionResult = await this.textExtractor.extractText(htmlUrl);
            
            if (extractionResult.extractionSuccess) {
              paper.text = extractionResult.text;
              textTruncated = extractionResult.truncated;
              logInfo('Text extraction successful for arXiv paper', { 
                id, 
                textLength: paper.text.length, 
                truncated: textTruncated,
                source: extractionResult.source
              });
            } else {
              textExtractionFailed = true;
              logWarn('Text extraction failed for arXiv paper', { id });
            }
          } else {
            textExtractionFailed = true;
            logWarn('Rate limited for text extraction', { id });
          }
        } catch (error) {
          textExtractionFailed = true;
          logError('Error during text extraction for arXiv paper', { 
            id, 
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

    } catch (error) {
      logError('Error parsing arXiv entry', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  /**
   * Extract arXiv ID from full URL
   */
  private extractArxivId(fullId: string): string {
    const match = fullId.match(/(?:arxiv\.org\/abs\/|arxiv:)([^v\s]+)/);
    return match ? match[1] : fullId;
  }

  /**
   * Clean arXiv ID (remove version, normalize format)
   */
  private cleanArxivId(id: string): string {
    // Remove version if present (e.g., "2401.12345v2" -> "2401.12345")
    return id.replace(/v\d+$/, '');
  }

  /**
   * Clean XML text content
   */
  private cleanXmlText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Future method: Fetch categories dynamically from arXiv
   * This could be implemented later if arXiv provides a categories endpoint
   */
  private async fetchCategoriesDynamically(): Promise<Category[]> {
    if (!this.checkRateLimit()) {
      throw new Error(`Rate limited. Retry after ${this.getRetryAfter()} seconds`);
    }

    try {
      // arXiv doesn't have a dedicated categories endpoint
      // This is a placeholder for future implementation
      logInfo('Fetching arXiv categories dynamically (not implemented)');
      return [];
    } catch (error) {
      logError('Failed to fetch arXiv categories', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
} 