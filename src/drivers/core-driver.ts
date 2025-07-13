/**
 * CORE Driver - Week 4 Implementation
 *
 * Provides access to CORE's collection of open access academic papers
 * Uses CORE API v3 with authentication and scroll API for large datasets
 */

import axios from "axios";
import { BaseDriver } from "./base-driver.js";
import { Category, PaperMetadata } from "../types/papers.js";
import { logInfo, logError, logWarn } from "../core/logger.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { HtmlExtractor } from "../extractors/html-extractor.js";
import { DEFAULT_TEXT_EXTRACTION_CONFIG } from "../config/constants.js";

interface CorePaper {
  id: number;
  doi?: string;
  title: string;
  authors: Array<{
    name: string;
  }>;
  publishedDate?: string;
  yearPublished?: number;
  publisher?: string;
  journals?: Array<{
    title: string;
    identifiers?: string[];
  }>;
  abstract?: string;
  downloadUrl?: string;
  fullText?: string;
  dataProviders?: Array<{
    id: number;
    name: string;
    url: string;
  }>;
  links?: Array<{
    type: string;
    url: string;
  }>;
  sourceFulltextUrls?: string[];
}

interface CoreSearchResponse {
  totalHits: number;
  results: CorePaper[];
  scrollId?: string;
}

export class CoreDriver extends BaseDriver {
  private textExtractor: HtmlExtractor;
  private readonly apiBase = "https://api.core.ac.uk/v3";
  private readonly apiKey?: string;

  // CORE subject categories - based on their classification system
  private readonly coreCategories = [
    {
      id: "computer_science",
      name: "Computer Science",
      description: "Computing and information technology research",
    },
    {
      id: "mathematics",
      name: "Mathematics",
      description: "Mathematical research and analysis",
    },
    {
      id: "physics",
      name: "Physics",
      description: "Physical sciences and astronomy",
    },
    {
      id: "chemistry",
      name: "Chemistry",
      description: "Chemical sciences and molecular research",
    },
    {
      id: "biology",
      name: "Biology",
      description: "Biological sciences and life sciences",
    },
    {
      id: "medicine",
      name: "Medicine",
      description: "Medical and health sciences",
    },
    {
      id: "engineering",
      name: "Engineering",
      description: "Engineering and technology",
    },
    {
      id: "social_sciences",
      name: "Social Sciences",
      description: "Social and behavioral sciences",
    },
    {
      id: "economics",
      name: "Economics",
      description: "Economic research and business studies",
    },
    {
      id: "psychology",
      name: "Psychology",
      description: "Psychological research and cognitive sciences",
    },
    {
      id: "education",
      name: "Education",
      description: "Educational research and pedagogy",
    },
    {
      id: "linguistics",
      name: "Linguistics",
      description: "Language and linguistic studies",
    },
    {
      id: "philosophy",
      name: "Philosophy",
      description: "Philosophical research and ethics",
    },
    {
      id: "history",
      name: "History",
      description: "Historical research and cultural studies",
    },
    {
      id: "geography",
      name: "Geography",
      description: "Geographic and environmental studies",
    },
    { id: "law", name: "Law", description: "Legal studies and jurisprudence" },
    {
      id: "arts",
      name: "Arts",
      description: "Arts, literature, and cultural studies",
    },
    {
      id: "agriculture",
      name: "Agriculture",
      description: "Agricultural sciences and food security",
    },
    {
      id: "environmental_science",
      name: "Environmental Science",
      description: "Environmental and sustainability research",
    },
    {
      id: "political_science",
      name: "Political Science",
      description: "Political research and governance studies",
    },
  ];

  constructor(rateLimiter: RateLimiter) {
    super(rateLimiter, "core");
    this.textExtractor = new HtmlExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG);

    // API key is optional but recommended for higher rate limits
    this.apiKey = process.env.CORE_API_KEY;

    if (!this.apiKey) {
      logWarn(
        "CORE API key not found in environment variables. Using public rate limits.",
      );
      logWarn("Set CORE_API_KEY environment variable for higher rate limits.");
    }
  }

  /**
   * List CORE categories
   */
  async listCategories(): Promise<Category[]> {
    logInfo("Fetching CORE categories");
    return this.coreCategories;
  }

  /**
   * Fetch latest papers from CORE for a given category
   */
  async fetchLatest(category: string, count: number): Promise<PaperMetadata[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching latest CORE papers", {
        retryAfter,
        category,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching latest CORE papers", { category, count });

      // Build search query for the category
      const searchQuery = this.buildSearchQuery(category);

      const headers: Record<string, string> = {
        "User-Agent":
          "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); CORE-client",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post<CoreSearchResponse>(
        `${this.apiBase}/search/works`,
        {
          q: searchQuery,
          limit: Math.min(count, 100), // CORE allows up to 100 results per request
          offset: 0,
          sort: "publishedDate:desc", // Sort by publication date, newest first
          // Only include papers with full text available
          exclude_without_fulltext: true,
        },
        {
          timeout: 15000,
          headers,
        },
      );

      if (!response.data || !response.data.results) {
        logWarn("CORE API returned unexpected response format", {
          category,
          searchQuery,
          responseData: response.data,
        });
        return [];
      }

      const results = response.data.results;

      if (results.length === 0) {
        logWarn("No CORE papers found for category", { category, searchQuery });
        return [];
      }

      // Convert results to PaperMetadata format (metadata only)
      const validResults = results.filter(
        (result) => result.title && result.id,
      );

      const papers = await Promise.all(
        validResults.map((result) =>
          this.convertPaperToMetadata(result, false),
        ),
      );

      logInfo("Successfully fetched CORE latest papers", {
        count: papers.length,
        category,
      });
      return papers;
    } catch (error) {
      logError("Failed to fetch latest CORE papers", {
        error: error instanceof Error ? error.message : error,
        category,
        count,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error("CORE API authentication failed. Check API key.");
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by CORE API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("CORE API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Fetch content for a specific CORE paper by ID
   */
  async fetchContent(id: string): Promise<PaperMetadata> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching CORE paper content", {
        retryAfter,
        id,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching CORE paper content", { id });

      const headers: Record<string, string> = {
        "User-Agent":
          "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); CORE-client",
      };

      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }

      // Fetch paper details by ID
      const response = await axios.get<CorePaper>(
        `${this.apiBase}/works/${id}`,
        {
          timeout: 15000,
          headers,
        },
      );

      if (!response.data) {
        throw new Error(`Paper with ID ${id} not found in CORE`);
      }

      const result = response.data;

      // Convert to paper format with full text extraction
      const paper = await this.convertPaperToMetadata(result, true);

      logInfo("Successfully fetched CORE paper content", {
        id,
        title: paper.title,
      });
      return paper;
    } catch (error) {
      logError("Failed to fetch CORE paper content", {
        error: error instanceof Error ? error.message : error,
        id,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Paper with ID ${id} not found in CORE`);
        }
        if (error.response?.status === 401) {
          throw new Error("CORE API authentication failed. Check API key.");
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by CORE API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("CORE API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Convert CORE paper to PaperMetadata format
   */
  private async convertPaperToMetadata(
    paper: CorePaper,
    includeText: boolean = false,
  ): Promise<PaperMetadata> {
    // Extract authors
    const authors = paper.authors?.map((author) => author.name) || [];

    // Format date
    let date: string;
    if (paper.publishedDate) {
      // Try to parse various date formats
      const parsedDate = new Date(paper.publishedDate);
      date = isNaN(parsedDate.getTime())
        ? `${paper.yearPublished || new Date().getFullYear()}-01-01`
        : parsedDate.toISOString().split("T")[0];
    } else if (paper.yearPublished) {
      date = `${paper.yearPublished}-01-01`;
    } else {
      date = new Date().toISOString().split("T")[0];
    }

    // Determine PDF URL from the new CORE API structure
    let pdf_url: string | undefined;
    if (paper.downloadUrl) {
      pdf_url = paper.downloadUrl;
    } else if (paper.links && paper.links.length > 0) {
      // Try to find PDF download link
      const pdfLink = paper.links.find(
        (link) => link.type === "download" && link.url.includes(".pdf"),
      );
      if (pdfLink) {
        pdf_url = pdfLink.url;
      }
    } else if (
      paper.sourceFulltextUrls &&
      paper.sourceFulltextUrls.length > 0
    ) {
      // Use source fulltext URLs as fallback
      pdf_url = paper.sourceFulltextUrls[0];
    }

    // Create base paper object
    const paperMetadata: PaperMetadata = {
      id: paper.id.toString(),
      title: paper.title || "Untitled",
      authors,
      date,
      pdf_url,
      text: "", // Always include text field, empty for metadata-only
    };

    // Only extract text if requested (for fetch_content)
    if (includeText) {
      let textTruncated = false;
      let textExtractionFailed = false;

      try {
        // Strategy 1: Use abstract if available as base text
        if (paper.abstract && paper.abstract.length > 0) {
          paperMetadata.text = `Abstract: ${paper.abstract}`;
          logInfo("Using abstract as base text for CORE paper", {
            id: paper.id,
            abstractLength: paper.abstract.length,
          });
        }

        // Strategy 2: Try to extract from PDF URL if available and rate limit allows
        if (pdf_url && this.checkRateLimit()) {
          try {
            const extractionResult =
              await this.textExtractor.extractText(pdf_url);
            if (
              extractionResult.extractionSuccess &&
              extractionResult.text.length > paperMetadata.text.length
            ) {
              paperMetadata.text = extractionResult.text;
              textTruncated = extractionResult.truncated;
              logInfo("Text extraction successful from CORE PDF", {
                id: paper.id,
                url: pdf_url,
                textLength: paperMetadata.text.length,
                truncated: textTruncated,
              });
            } else {
              logWarn("PDF text extraction failed, keeping abstract", {
                id: paper.id,
              });
            }
          } catch (pdfError) {
            logWarn("PDF text extraction failed, keeping abstract", {
              id: paper.id,
              pdfUrl: pdf_url,
              error: pdfError instanceof Error ? pdfError.message : pdfError,
            });
          }
        } else if (!pdf_url && !paper.abstract) {
          textExtractionFailed = true;
          logWarn("No text content available for CORE paper", { id: paper.id });
        }

        // Strategy 3: Try source fulltext URLs if available
        if (
          paperMetadata.text.length === 0 &&
          paper.sourceFulltextUrls &&
          this.checkRateLimit()
        ) {
          for (const sourceUrl of paper.sourceFulltextUrls) {
            try {
              const extractionResult =
                await this.textExtractor.extractText(sourceUrl);
              if (extractionResult.extractionSuccess) {
                paperMetadata.text = extractionResult.text;
                textTruncated = extractionResult.truncated;
                logInfo("Text extraction successful from CORE source URL", {
                  id: paper.id,
                  sourceUrl,
                  textLength: paperMetadata.text.length,
                  truncated: textTruncated,
                });
                break;
              }
            } catch (sourceError) {
              logWarn("Source URL text extraction failed", {
                id: paper.id,
                sourceUrl,
                error:
                  sourceError instanceof Error
                    ? sourceError.message
                    : sourceError,
              });
              continue;
            }
          }
        }

        if (paperMetadata.text.length === 0) {
          textExtractionFailed = true;
        }
      } catch (error) {
        textExtractionFailed = true;
        logError("Error during text extraction for CORE paper", {
          id: paper.id,
          error: error instanceof Error ? error.message : error,
        });
      }

      // Add warning flags if needed
      if (textTruncated) {
        paperMetadata.textTruncated = true;
      }
      if (textExtractionFailed) {
        paperMetadata.textExtractionFailed = true;
      }
    }

    return paperMetadata;
  }

  /**
   * Build search query for CORE based on category
   */
  private buildSearchQuery(category: string): string {
    const categoryMapping: Record<string, string> = {
      computer_science:
        'subjects:("computer science" OR "computing" OR "artificial intelligence" OR "machine learning")',
      mathematics:
        'subjects:("mathematics" OR "mathematical" OR "statistics" OR "probability")',
      physics:
        'subjects:("physics" OR "astronomy" OR "astrophysics" OR "quantum")',
      chemistry:
        'subjects:("chemistry" OR "chemical" OR "biochemistry" OR "molecular")',
      biology:
        'subjects:("biology" OR "biological" OR "genetics" OR "molecular biology")',
      medicine: 'subjects:("medicine" OR "medical" OR "health" OR "clinical")',
      engineering:
        'subjects:("engineering" OR "technology" OR "mechanical" OR "electrical")',
      social_sciences:
        'subjects:("social science" OR "sociology" OR "anthropology" OR "social")',
      economics:
        'subjects:("economics" OR "economic" OR "business" OR "finance")',
      psychology:
        'subjects:("psychology" OR "psychological" OR "cognitive" OR "behavioral")',
      education:
        'subjects:("education" OR "educational" OR "learning" OR "pedagogy")',
      linguistics:
        'subjects:("linguistics" OR "language" OR "linguistic" OR "phonetics")',
      philosophy:
        'subjects:("philosophy" OR "philosophical" OR "ethics" OR "logic")',
      history:
        'subjects:("history" OR "historical" OR "cultural studies" OR "heritage")',
      geography:
        'subjects:("geography" OR "geographic" OR "environmental" OR "spatial")',
      law: 'subjects:("law" OR "legal" OR "jurisprudence" OR "justice")',
      arts: 'subjects:("arts" OR "literature" OR "cultural" OR "humanities")',
      agriculture:
        'subjects:("agriculture" OR "agricultural" OR "farming" OR "food security")',
      environmental_science:
        'subjects:("environmental" OR "sustainability" OR "ecology" OR "climate")',
      political_science:
        'subjects:("political science" OR "politics" OR "governance" OR "policy")',
    };

    // Use predefined mapping or fallback to general search
    return categoryMapping[category.toLowerCase()] || `subjects:"${category}"`;
  }
}
