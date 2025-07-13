import axios from "axios";
import { BaseDriver } from "./base-driver.js";
import { Category, PaperMetadata } from "../types/papers.js";
import {
  OPENALEX_API_BASE,
  DEFAULT_TEXT_EXTRACTION_CONFIG,
} from "../config/constants.js";
import { logInfo, logError, logWarn } from "../core/logger.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { HtmlExtractor } from "../extractors/html-extractor.js";
import { DOIResolver } from "../resolvers/doi-resolver.js";

interface OpenAlexConcept {
  id: string;
  display_name: string;
  description?: string;
  level: number;
  works_count: number;
}

interface OpenAlexConceptsResponse {
  results: OpenAlexConcept[];
  meta: {
    count: number;
    page: number;
  };
}

interface OpenAlexLocation {
  source?: {
    id: string;
    display_name: string;
  };
  landing_page_url?: string;
  pdf_url?: string;
  source_type?: string;
  is_oa?: boolean;
  version?: string;
  license?: string;
}

interface OpenAlexWork {
  id: string;
  title: string;
  display_name?: string;
  publication_date: string;
  doi?: string;
  authorships: Array<{
    author: {
      id: string;
      display_name: string;
    };
  }>;
  primary_location?: OpenAlexLocation;
  best_oa_location?: OpenAlexLocation;
  locations?: OpenAlexLocation[];
  open_access?: {
    is_oa: boolean;
    oa_date?: string;
    oa_url?: string;
    any_repository_has_fulltext?: boolean;
  };
  cited_by_count: number;
  concepts: Array<{
    id: string;
    display_name: string;
  }>;
}

interface OpenAlexWorksResponse {
  results: OpenAlexWork[];
  meta: {
    count: number;
    page: number;
  };
}

export class OpenAlexDriver extends BaseDriver {
  private textExtractor: HtmlExtractor;
  private doiResolver: DOIResolver;
  private readonly politePoolEmail = "contact@sciharvestermcp.org";

  constructor(rateLimiter: RateLimiter) {
    super(rateLimiter, "openalex");
    this.textExtractor = new HtmlExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG);
    this.doiResolver = new DOIResolver();
  }

  /**
   * Get common request headers for OpenAlex API with polite pool access
   */
  private getRequestHeaders() {
    return {
      "User-Agent": `SciHarvester-MCP/0.1.27 (mailto:${this.politePoolEmail}); latest-science-mcp`,
      Accept: "application/json",
    };
  }

  /**
   * Get common request parameters for OpenAlex API with polite pool access
   */
  private getRequestParams(additionalParams: Record<string, any> = {}) {
    return {
      mailto: this.politePoolEmail,
      ...additionalParams,
    };
  }

  /**
   * List OpenAlex concepts (categories)
   * Fetches top-level concepts with highest paper counts
   */
  async listCategories(): Promise<Category[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching OpenAlex concepts", { retryAfter });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching OpenAlex concepts");

      // Fetch top-level concepts (level 0) with highest works count
      const response = await axios.get<OpenAlexConceptsResponse>(
        `${OPENALEX_API_BASE}/concepts`,
        {
          params: this.getRequestParams({
            filter: "level:0",
            sort: "works_count:desc",
            per_page: 50,
            select: "id,display_name,description,level,works_count",
          }),
          timeout: 10000,
          headers: this.getRequestHeaders(),
        },
      );

      const concepts = response.data.results;
      logInfo("Successfully fetched OpenAlex concepts", {
        count: concepts.length,
      });

      return concepts.map((concept) => ({
        id: this.extractConceptId(concept.id),
        name: concept.display_name,
        description:
          concept.description ||
          `${concept.works_count.toLocaleString()} works`,
      }));
    } catch (error) {
      logError("Failed to fetch OpenAlex concepts", {
        error: error instanceof Error ? error.message : error,
        source: "openalex",
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error(
            "OpenAlex API access forbidden - check request parameters",
          );
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by OpenAlex API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("OpenAlex API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Fetch latest papers from OpenAlex for a given concept/category
   */
  async fetchLatest(category: string, count: number): Promise<PaperMetadata[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching latest OpenAlex papers", {
        retryAfter,
        category,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching latest OpenAlex papers", { category, count });

      // Build filter for concept - handle different input formats properly
      const conceptFilter = this.buildConceptFilter(category);
      logInfo("Built concept filter for OpenAlex", {
        category,
        filter: conceptFilter,
      });

      const response = await axios.get<OpenAlexWorksResponse>(
        `${OPENALEX_API_BASE}/works`,
        {
          params: this.getRequestParams({
            filter: conceptFilter,
            sort: "publication_date:desc",
            per_page: Math.min(count, 200), // OpenAlex max per_page is 200
            select:
              "id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts",
          }),
          timeout: 15000,
          headers: this.getRequestHeaders(),
        },
      );

      // Process works in parallel for better performance (metadata only)
      const paperPromises = response.data.results.map((work) =>
        this.convertWorkToPaper(work, false),
      ); // false = metadata only
      const papers = await Promise.all(paperPromises);

      logInfo("Successfully fetched OpenAlex latest papers", {
        count: papers.length,
        category,
      });

      return papers;
    } catch (error) {
      logError("Failed to fetch latest OpenAlex papers", {
        error: error instanceof Error ? error.message : error,
        category,
        count,
        status: axios.isAxiosError(error) ? error.response?.status : "unknown",
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error(
            `OpenAlex API access forbidden - invalid category format: ${category}`,
          );
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by OpenAlex API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("OpenAlex API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Fetch top cited papers from OpenAlex for a given concept since a date
   */
  async fetchTopCited(
    concept: string,
    since: string,
    count: number,
  ): Promise<PaperMetadata[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching top cited OpenAlex papers", {
        retryAfter,
        concept,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching top cited OpenAlex papers", { concept, since, count });

      // Build filter for concept and date
      const conceptFilter = this.buildConceptFilter(concept);
      const dateFilter = `publication_date:>${since}`;
      const combinedFilter = `${conceptFilter},${dateFilter}`;

      const response = await axios.get<OpenAlexWorksResponse>(
        `${OPENALEX_API_BASE}/works`,
        {
          params: this.getRequestParams({
            filter: combinedFilter,
            sort: "cited_by_count:desc",
            per_page: Math.min(count, 200), // OpenAlex max per_page is 200
            select:
              "id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts",
          }),
          timeout: 15000,
          headers: this.getRequestHeaders(),
        },
      );

      const paperPromises = response.data.results.map((work) =>
        this.convertWorkToPaper(work, false),
      ); // false = metadata only
      const papers = await Promise.all(paperPromises);
      logInfo("Successfully fetched OpenAlex top cited papers", {
        count: papers.length,
        concept,
        since,
      });

      return papers;
    } catch (error) {
      logError("Failed to fetch top cited OpenAlex papers", {
        error: error instanceof Error ? error.message : error,
        concept,
        since,
        count,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error(
            `OpenAlex API access forbidden - invalid concept format: ${concept}`,
          );
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by OpenAlex API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("OpenAlex API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Fetch content for a specific OpenAlex work by ID
   */
  async fetchContent(id: string): Promise<PaperMetadata> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching OpenAlex paper content", {
        retryAfter,
        id,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching OpenAlex paper content", { id });

      // Clean the ID and build URL
      const cleanId = this.cleanOpenAlexId(id);
      const workUrl = cleanId.startsWith("W")
        ? `${OPENALEX_API_BASE}/works/${cleanId}`
        : `${OPENALEX_API_BASE}/works/https://openalex.org/${cleanId}`;

      const response = await axios.get<OpenAlexWork>(workUrl, {
        params: this.getRequestParams({
          select:
            "id,title,display_name,publication_date,doi,authorships,primary_location,best_oa_location,locations,open_access,cited_by_count,concepts",
        }),
        timeout: 15000,
        headers: this.getRequestHeaders(),
      });

      const paper = await this.convertWorkToPaper(response.data, true);
      logInfo("Successfully fetched OpenAlex paper content", {
        id,
        title: paper.title,
      });

      return paper;
    } catch (error) {
      logError("Failed to fetch OpenAlex paper content", {
        error: error instanceof Error ? error.message : error,
        id,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error(
            `OpenAlex API access forbidden - invalid work ID: ${id}`,
          );
        }
        if (error.response?.status === 404) {
          throw new Error(`Paper with ID ${id} not found on OpenAlex`);
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by OpenAlex API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("OpenAlex API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Resolve the best full-text URL for a work using location hierarchy
   * Implements improved location resolution as per Week 1 & 2 requirements
   * Now includes DOI resolver fallback chain
   */
  private async resolveFullText(
    work: OpenAlexWork,
  ): Promise<{ url?: string; source: string; resolver_path: string }> {
    let resolver_path = "";

    // Step 1: Try best_oa_location first (highest quality open access)
    if (work.best_oa_location) {
      resolver_path += "best_oa_location";
      if (work.best_oa_location.pdf_url) {
        return {
          url: work.best_oa_location.pdf_url,
          source: "pdf",
          resolver_path: resolver_path + "->pdf_url",
        };
      }
      if (
        work.best_oa_location.landing_page_url &&
        work.best_oa_location.source_type === "html"
      ) {
        return {
          url: work.best_oa_location.landing_page_url,
          source: "html",
          resolver_path: resolver_path + "->landing_page_url",
        };
      }
    }

    // Step 2: Try primary_location
    if (work.primary_location) {
      resolver_path += resolver_path ? ",primary_location" : "primary_location";
      if (work.primary_location.pdf_url) {
        return {
          url: work.primary_location.pdf_url,
          source: "pdf",
          resolver_path: resolver_path + "->pdf_url",
        };
      }
      if (
        work.primary_location.landing_page_url &&
        work.primary_location.source_type === "html"
      ) {
        return {
          url: work.primary_location.landing_page_url,
          source: "html",
          resolver_path: resolver_path + "->landing_page_url",
        };
      }
    }

    // Step 3: Iterate through all locations array for HTML sources
    if (work.locations && work.locations.length > 0) {
      resolver_path += resolver_path ? ",locations_array" : "locations_array";
      for (let i = 0; i < work.locations.length; i++) {
        const location = work.locations[i];
        if (location.source_type === "html" && location.landing_page_url) {
          return {
            url: location.landing_page_url,
            source: "html",
            resolver_path: resolver_path + `->location[${i}]->landing_page_url`,
          };
        }
      }
    }

    // Step 4: DOI resolver fallback (Week 2 implementation)
    if (work.doi) {
      resolver_path += resolver_path ? ",doi_resolver" : "doi_resolver";
      try {
        const doiResult = await this.doiResolver.resolveDOI(work.doi);
        if (doiResult.fullTextUrl || doiResult.pdfUrl) {
          const url = doiResult.fullTextUrl || doiResult.pdfUrl;
          const source = doiResult.pdfUrl ? "pdf" : "html";
          return {
            url,
            source,
            resolver_path: resolver_path + `->${doiResult.source}->${source}`,
          };
        } else {
          logInfo("DOI resolver found no full-text URLs", {
            doi: work.doi,
            resolver_path: doiResult.resolverPath,
            cached: doiResult.cached,
          });
        }
      } catch (error) {
        logWarn("DOI resolver failed", {
          doi: work.doi,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    // No full-text source found
    return {
      url: undefined,
      source: "none",
      resolver_path: resolver_path || "no_sources",
    };
  }

  /**
   * Convert OpenAlex Work to PaperMetadata format
   * Enhanced with improved full-text resolution
   */
  private async convertWorkToPaper(
    work: OpenAlexWork,
    includeText: boolean = false,
  ): Promise<PaperMetadata> {
    // Extract authors
    const authors = work.authorships.map(
      (authorship) => authorship.author.display_name,
    );

    // Extract date (ensure it's in ISO format)
    const date =
      work.publication_date || new Date().toISOString().split("T")[0];

    // Resolve full-text URL using improved resolver (now with DOI fallback)
    const fullTextResult = await this.resolveFullText(work);
    const pdf_url =
      fullTextResult.source === "pdf"
        ? fullTextResult.url
        : work.primary_location?.pdf_url;

    // Create base paper object
    const paper: PaperMetadata = {
      id: this.extractWorkId(work.id),
      title: work.title || work.display_name || "Untitled",
      authors,
      date,
      pdf_url,
      text: "", // Always include text field, empty for metadata-only
    };

    // Only extract text if requested (for fetch_content)
    if (includeText) {
      let textTruncated = false;
      let textExtractionFailed = false;
      let resolverPath = fullTextResult.resolver_path;

      try {
        // Use improved full-text resolution
        if (
          fullTextResult.url &&
          fullTextResult.source === "html" &&
          this.checkRateLimit()
        ) {
          const extractionResult = await this.textExtractor.extractText(
            fullTextResult.url,
          );

          if (extractionResult.extractionSuccess) {
            paper.text = extractionResult.text;
            textTruncated = extractionResult.truncated;
            logInfo("Text extraction successful for OpenAlex paper", {
              id: this.extractWorkId(work.id),
              textLength: paper.text.length,
              truncated: textTruncated,
              source: extractionResult.source,
              resolver_path: resolverPath,
            });
          } else {
            textExtractionFailed = true;
            logWarn("Text extraction failed for OpenAlex paper", {
              id: this.extractWorkId(work.id),
              resolver_path: resolverPath,
            });
          }
        } else {
          // Log why text extraction was skipped
          if (!fullTextResult.url) {
            logInfo("Skipping text extraction - no full-text URL found", {
              id: this.extractWorkId(work.id),
              resolver_path: resolverPath,
            });
          } else if (fullTextResult.source !== "html") {
            logInfo("Skipping text extraction - non-HTML source", {
              id: this.extractWorkId(work.id),
              source_type: fullTextResult.source,
              resolver_path: resolverPath,
            });
          } else if (!this.checkRateLimit()) {
            textExtractionFailed = true;
            logWarn("Rate limited for text extraction", {
              id: this.extractWorkId(work.id),
              resolver_path: resolverPath,
            });
          }
        }
      } catch (error) {
        textExtractionFailed = true;
        logError("Error during text extraction for OpenAlex paper", {
          id: this.extractWorkId(work.id),
          error: error instanceof Error ? error.message : error,
          resolver_path: resolverPath,
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
   * Updated to handle OpenAlex API filtering requirements properly
   */
  private buildConceptFilter(category: string): string {
    // Handle different input formats - be more robust about concept filtering
    const trimmedCategory = category.trim();

    // Case 1: OpenAlex concept ID (e.g., "C41008148")
    if (trimmedCategory.startsWith("C") && /^C\d+$/.test(trimmedCategory)) {
      return `concepts.id:https://openalex.org/${trimmedCategory}`;
    }

    // Case 2: Full OpenAlex URL (e.g., "https://openalex.org/C41008148")
    else if (trimmedCategory.startsWith("https://openalex.org/C")) {
      return `concepts.id:${trimmedCategory}`;
    }

    // Case 3: Concept name search (e.g., "computer science", "machine learning")
    // Use exact display name match first, fallback to search if needed
    else {
      // For exact matching of common concepts, use display_name filter
      const normalizedName = trimmedCategory.toLowerCase();

      // Map common search terms to exact display names for better results
      const conceptMapping: Record<string, string> = {
        "computer science": "Computer science",
        medicine: "Medicine",
        biology: "Biology",
        physics: "Physics",
        chemistry: "Chemistry",
        economics: "Economics",
        mathematics: "Mathematics",
        psychology: "Psychology",
        engineering: "Engineering",
        philosophy: "Philosophy",
        "political science": "Political science",
        "materials science": "Materials science",
        art: "Art",
        geography: "Geography",
        business: "Business",
        sociology: "Sociology",
        geology: "Geology",
        history: "History",
        "environmental science": "Environmental science",
      };

      if (conceptMapping[normalizedName]) {
        // Use exact display name match for better precision
        return `concepts.display_name:"${conceptMapping[normalizedName]}"`;
      } else {
        // Fallback to search for other terms
        // Escape any special characters that might cause 403 errors
        const escapedCategory = trimmedCategory.replace(/[,&|]/g, "");
        return `concepts.display_name.search:${escapedCategory}`;
      }
    }
  }

  /**
   * Extract concept ID from OpenAlex URL format
   * e.g., "https://openalex.org/C41008148" -> "C41008148"
   */
  private extractConceptId(openAlexId: string): string {
    const match = openAlexId.match(/\/([^\/]+)$/);
    return match ? match[1] : openAlexId;
  }

  /**
   * Extract work ID from OpenAlex URL format
   * e.g., "https://openalex.org/W2741809807" -> "W2741809807"
   */
  private extractWorkId(openAlexId: string): string {
    const match = openAlexId.match(/\/([^\/]+)$/);
    return match ? match[1] : openAlexId;
  }

  /**
   * Clean OpenAlex ID (normalize format)
   */
  private cleanOpenAlexId(id: string): string {
    // Remove URL prefix if present
    if (id.startsWith("https://openalex.org/")) {
      return id.replace("https://openalex.org/", "");
    }
    return id;
  }
}
