/**
 * PubMed Central (PMC) Driver - Week 3 Implementation
 *
 * Provides access to PMC's collection of open-access biomedical papers
 * Uses E-utilities API for metadata and full-text retrieval
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { BaseDriver } from "./base-driver.js";
import { Category, PaperMetadata } from "../types/papers.js";
import { logInfo, logError, logWarn } from "../core/logger.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { HtmlExtractor } from "../extractors/html-extractor.js";
import { DEFAULT_TEXT_EXTRACTION_CONFIG } from "../config/constants.js";

interface PMCSearchResult {
  esearchresult: {
    idlist: string[];
    count: string;
    retmax: string;
    retstart: string;
  };
}

interface PMCSummary {
  uid: string;
  title: string;
  authors: Array<{
    name: string;
    authtype: string;
  }>;
  pubdate: string;
  epubdate: string;
  pmcid: string;
  doi?: string;
  elocationid?: string;
}

interface PMCSummaryResult {
  result: {
    [key: string]: PMCSummary;
  };
}

export class PMCDriver extends BaseDriver {
  private textExtractor: HtmlExtractor;
  private readonly eUtilsBase = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  private readonly pmcBase = "https://www.ncbi.nlm.nih.gov/pmc";

  // PMC subject categories mapped to search terms
  private readonly pmcCategories = [
    {
      id: "medicine",
      name: "Medicine",
      description: "General medical research",
    },
    { id: "biology", name: "Biology", description: "Biological sciences" },
    {
      id: "biochemistry",
      name: "Biochemistry",
      description: "Biochemical research",
    },
    { id: "genetics", name: "Genetics", description: "Genetic studies" },
    {
      id: "immunology",
      name: "Immunology",
      description: "Immune system research",
    },
    {
      id: "neuroscience",
      name: "Neuroscience",
      description: "Neurological studies",
    },
    { id: "oncology", name: "Oncology", description: "Cancer research" },
    {
      id: "cardiology",
      name: "Cardiology",
      description: "Cardiovascular research",
    },
    { id: "pharmacology", name: "Pharmacology", description: "Drug research" },
    {
      id: "microbiology",
      name: "Microbiology",
      description: "Microbial studies",
    },
    {
      id: "bioinformatics",
      name: "Bioinformatics",
      description: "Computational biology",
    },
    {
      id: "public_health",
      name: "Public Health",
      description: "Population health studies",
    },
  ];

  constructor(rateLimiter: RateLimiter) {
    super(rateLimiter, "pmc");
    this.textExtractor = new HtmlExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG);
  }

  /**
   * List PMC categories
   */
  async listCategories(): Promise<Category[]> {
    logInfo("Fetching PMC categories");
    return this.pmcCategories;
  }

  /**
   * Fetch latest papers from PMC for a given category
   */
  async fetchLatest(category: string, count: number): Promise<PaperMetadata[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching latest PMC papers", {
        retryAfter,
        category,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching latest PMC papers", { category, count });

      // Build search query for the category
      const searchQuery = this.buildSearchQuery(category);

      // Step 1: Search for PMC IDs
      const searchUrl = `${this.eUtilsBase}/esearch.fcgi`;
      const searchResponse = await axios.get<PMCSearchResult>(searchUrl, {
        params: {
          db: "pmc",
          term: searchQuery,
          retmax: Math.min(count, 100), // PMC allows up to 100 results per request
          retmode: "json",
          sort: "pub_date",
          tool: "SciHarvester-MCP",
          email: "contact@sciharvestermcp.org",
        },
        timeout: 15000,
      });

      const pmcIds = searchResponse.data.esearchresult.idlist;

      if (pmcIds.length === 0) {
        logWarn("No PMC papers found for category", { category, searchQuery });
        return [];
      }

      // Step 2: Fetch detailed summaries
      const summaryUrl = `${this.eUtilsBase}/esummary.fcgi`;
      const summaryResponse = await axios.get<PMCSummaryResult>(summaryUrl, {
        params: {
          db: "pmc",
          id: pmcIds.join(","),
          retmode: "json",
          tool: "SciHarvester-MCP",
          email: "contact@sciharvestermcp.org",
        },
        timeout: 15000,
      });

      // Convert summaries to PaperMetadata format (metadata only)
      const validSummaries = pmcIds
        .map((id) => summaryResponse.data.result[id])
        .filter((summary) => summary && summary.title);

      const papers = await Promise.all(
        validSummaries.map((summary) =>
          this.convertSummaryToPaper(summary, false),
        ),
      );

      logInfo("Successfully fetched PMC latest papers", {
        count: papers.length,
        category,
      });
      return papers;
    } catch (error) {
      logError("Failed to fetch latest PMC papers", {
        error: error instanceof Error ? error.message : error,
        category,
        count,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error("Rate limited by PMC E-utilities API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("PMC E-utilities API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Fetch content for a specific PMC paper by ID
   */
  async fetchContent(id: string): Promise<PaperMetadata> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching PMC paper content", {
        retryAfter,
        id,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching PMC paper content", { id });

      // Clean the PMC ID (remove PMC prefix if present)
      const cleanId = this.cleanPMCId(id);

      // Step 1: Get paper summary
      const summaryUrl = `${this.eUtilsBase}/esummary.fcgi`;
      const summaryResponse = await axios.get<PMCSummaryResult>(summaryUrl, {
        params: {
          db: "pmc",
          id: cleanId,
          retmode: "json",
          tool: "SciHarvester-MCP",
          email: "contact@sciharvestermcp.org",
        },
        timeout: 15000,
      });

      const summary = summaryResponse.data.result[cleanId];
      if (!summary) {
        throw new Error(`PMC paper with ID ${id} not found`);
      }

      // Step 2: Convert to paper format with full text extraction
      const paper = await this.convertSummaryToPaper(summary, true);

      logInfo("Successfully fetched PMC paper content", {
        id,
        title: paper.title,
      });
      return paper;
    } catch (error) {
      logError("Failed to fetch PMC paper content", {
        error: error instanceof Error ? error.message : error,
        id,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Paper with PMC ID ${id} not found`);
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by PMC E-utilities API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("PMC E-utilities API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Convert PMC summary to PaperMetadata format
   */
  private async convertSummaryToPaper(
    summary: PMCSummary,
    includeText: boolean = false,
  ): Promise<PaperMetadata> {
    // Extract authors
    const authors =
      summary.authors
        ?.filter((author) => author.authtype === "Author")
        .map((author) => author.name) || [];

    // Extract date (prefer epubdate over pubdate)
    const date = this.formatDate(summary.epubdate || summary.pubdate);

    // Create PMC URL
    const pmcId = summary.pmcid || summary.uid;
    const pmcUrl = `${this.pmcBase}/articles/${pmcId}/`;

    // Create base paper object
    const paper: PaperMetadata = {
      id: pmcId,
      title: summary.title || "Untitled",
      authors,
      date,
      pdf_url: `${this.pmcBase}/articles/${pmcId}/pdf/`,
      text: "", // Always include text field, empty for metadata-only
    };

    // Only extract text if requested (for fetch_content)
    if (includeText) {
      let textTruncated = false;
      let textExtractionFailed = false;

      try {
        if (this.checkRateLimit()) {
          // Try to extract text from PMC HTML page
          const extractionResult = await this.textExtractor.extractText(pmcUrl);

          if (extractionResult.extractionSuccess) {
            paper.text = extractionResult.text;
            textTruncated = extractionResult.truncated;
            logInfo("Text extraction successful for PMC paper", {
              id: pmcId,
              textLength: paper.text.length,
              truncated: textTruncated,
              source: extractionResult.source,
            });
          } else {
            textExtractionFailed = true;
            logWarn("Text extraction failed for PMC paper", { id: pmcId });
          }
        } else {
          textExtractionFailed = true;
          logWarn("Rate limited for text extraction", { id: pmcId });
        }
      } catch (error) {
        textExtractionFailed = true;
        logError("Error during text extraction for PMC paper", {
          id: pmcId,
          error: error instanceof Error ? error.message : error,
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
   * Search for papers with query and field-specific options
   * Note: PMC E-utilities API has limited search capabilities
   */
  async searchPapers(
    query: string,
    field: string,
    count: number,
    sortBy: string,
  ): Promise<PaperMetadata[]> {
    // PMC E-utilities API has limited advanced search functionality
    // This is a placeholder implementation that throws an appropriate error
    throw new Error(
      "Advanced search functionality is not fully supported by PMC E-utilities API. " +
      "The API primarily supports MeSH term searches and basic field searches. " +
      "Please use fetch_latest with specific medical categories instead, or try EuropePMC for advanced search."
    );
  }

  /**
   * Build search query for PMC based on category
   */
  private buildSearchQuery(category: string): string {
    const categoryMapping: Record<string, string> = {
      medicine: '"medicine"[MeSH Terms] OR "clinical medicine"[All Fields]',
      biology: '"biology"[MeSH Terms] OR "biological science"[All Fields]',
      biochemistry: '"biochemistry"[MeSH Terms] OR "biochemical"[All Fields]',
      genetics: '"genetics"[MeSH Terms] OR "genetic"[All Fields]',
      immunology: '"immunology"[MeSH Terms] OR "immune"[All Fields]',
      neuroscience: '"neuroscience"[MeSH Terms] OR "neurological"[All Fields]',
      oncology: '"oncology"[MeSH Terms] OR "cancer"[All Fields]',
      cardiology: '"cardiology"[MeSH Terms] OR "cardiovascular"[All Fields]',
      pharmacology: '"pharmacology"[MeSH Terms] OR "drug"[All Fields]',
      microbiology: '"microbiology"[MeSH Terms] OR "microbial"[All Fields]',
      bioinformatics:
        '"bioinformatics"[MeSH Terms] OR "computational biology"[All Fields]',
      public_health:
        '"public health"[MeSH Terms] OR "epidemiology"[All Fields]',
    };

    // Use predefined mapping or fallback to general search
    return (
      categoryMapping[category.toLowerCase()] || `"${category}"[All Fields]`
    );
  }

  /**
   * Clean PMC ID (remove PMC prefix if present)
   */
  private cleanPMCId(id: string): string {
    return id.replace(/^PMC/, "");
  }

  /**
   * Format date from PMC format to ISO format
   */
  private formatDate(dateStr: string): string {
    if (!dateStr) {
      return new Date().toISOString().split("T")[0];
    }

    try {
      // PMC dates are often in YYYY/MM/DD format
      const date = new Date(dateStr.replace(/\//g, "-"));
      return date.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }
}
