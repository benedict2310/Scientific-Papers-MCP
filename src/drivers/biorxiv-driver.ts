/**
 * bioRxiv/medRxiv Driver - Week 4 Implementation
 *
 * Provides access to bioRxiv and medRxiv preprint servers
 * Uses JSON API with date-based querying and incremental harvest
 */

import axios from "axios";
import { BaseDriver } from "./base-driver.js";
import { Category, PaperMetadata } from "../types/papers.js";
import { logInfo, logError, logWarn } from "../core/logger.js";
import { RateLimiter } from "../core/rate-limiter.js";
import { HtmlExtractor } from "../extractors/html-extractor.js";
import { DEFAULT_TEXT_EXTRACTION_CONFIG } from "../config/constants.js";

interface BioRxivPaper {
  doi: string;
  title: string;
  authors: string;
  author_corresponding: string;
  author_corresponding_institution: string;
  date: string; // YYYY-MM-DD format
  version: number;
  type: string; // "new" or "revision"
  category: string;
  jatsxml: string; // URL to JATS XML
  abstract: string;
  published?: string; // Published date if peer-reviewed
  server: "biorxiv" | "medrxiv";
}

interface BioRxivResponse {
  messages: Array<{
    status: string;
    count: number;
    total: number;
  }>;
  collection: BioRxivPaper[];
}

export class BioRxivDriver extends BaseDriver {
  private textExtractor: HtmlExtractor;
  private readonly bioRxivApiBase = "https://api.biorxiv.org";
  private readonly medRxivApiBase = "https://api.medrxiv.org";

  // bioRxiv/medRxiv subject categories
  private readonly bioRxivCategories = [
    {
      id: "animal-behavior-and-cognition",
      name: "Animal Behavior and Cognition",
      description: "Studies of animal behavior and cognitive processes",
    },
    {
      id: "biochemistry",
      name: "Biochemistry",
      description: "Biochemical research and molecular biology",
    },
    {
      id: "bioengineering",
      name: "Bioengineering",
      description: "Biological engineering and biotechnology",
    },
    {
      id: "bioinformatics",
      name: "Bioinformatics",
      description: "Computational biology and data analysis",
    },
    {
      id: "biophysics",
      name: "Biophysics",
      description: "Physical principles in biological systems",
    },
    {
      id: "cancer-biology",
      name: "Cancer Biology",
      description: "Cancer research and oncology",
    },
    {
      id: "cell-biology",
      name: "Cell Biology",
      description: "Cellular processes and mechanisms",
    },
    {
      id: "developmental-biology",
      name: "Developmental Biology",
      description: "Organism development and growth",
    },
    {
      id: "ecology",
      name: "Ecology",
      description: "Ecological studies and environmental biology",
    },
    {
      id: "evolutionary-biology",
      name: "Evolutionary Biology",
      description: "Evolution and phylogenetics",
    },
    {
      id: "genetics",
      name: "Genetics",
      description: "Genetic studies and genomics",
    },
    {
      id: "genomics",
      name: "Genomics",
      description: "Genome-wide studies and analysis",
    },
    {
      id: "immunology",
      name: "Immunology",
      description: "Immune system research",
    },
    {
      id: "microbiology",
      name: "Microbiology",
      description: "Studies of microorganisms",
    },
    {
      id: "molecular-biology",
      name: "Molecular Biology",
      description: "Molecular mechanisms and processes",
    },
    {
      id: "neuroscience",
      name: "Neuroscience",
      description: "Nervous system and brain research",
    },
    {
      id: "paleontology",
      name: "Paleontology",
      description: "Fossil studies and ancient life",
    },
    {
      id: "pathology",
      name: "Pathology",
      description: "Disease mechanisms and pathology",
    },
    {
      id: "pharmacology-and-toxicology",
      name: "Pharmacology and Toxicology",
      description: "Drug action and toxicity studies",
    },
    {
      id: "physiology",
      name: "Physiology",
      description: "Physiological processes and function",
    },
    {
      id: "plant-biology",
      name: "Plant Biology",
      description: "Plant science and botany",
    },
    {
      id: "scientific-communication-and-education",
      name: "Scientific Communication and Education",
      description: "Science communication and pedagogy",
    },
    {
      id: "synthetic-biology",
      name: "Synthetic Biology",
      description: "Engineering biological systems",
    },
    {
      id: "systems-biology",
      name: "Systems Biology",
      description: "Systems-level biological analysis",
    },
    {
      id: "zoology",
      name: "Zoology",
      description: "Animal biology and zoological studies",
    },
  ];

  private readonly medRxivCategories = [
    {
      id: "addiction-medicine",
      name: "Addiction Medicine",
      description: "Substance abuse and addiction treatment",
    },
    {
      id: "allergy-and-immunology",
      name: "Allergy and Immunology",
      description: "Allergic diseases and immunological disorders",
    },
    {
      id: "anesthesia",
      name: "Anesthesia",
      description: "Anesthesiology and pain management",
    },
    {
      id: "cardiovascular-medicine",
      name: "Cardiovascular Medicine",
      description: "Heart and vascular diseases",
    },
    {
      id: "dermatology",
      name: "Dermatology",
      description: "Skin diseases and dermatological conditions",
    },
    {
      id: "emergency-medicine",
      name: "Emergency Medicine",
      description: "Emergency care and acute medicine",
    },
    {
      id: "endocrinology",
      name: "Endocrinology",
      description: "Hormonal and metabolic disorders",
    },
    {
      id: "epidemiology",
      name: "Epidemiology",
      description: "Disease patterns and public health",
    },
    {
      id: "gastroenterology",
      name: "Gastroenterology",
      description: "Digestive system diseases",
    },
    {
      id: "genetic-and-genomic-medicine",
      name: "Genetic and Genomic Medicine",
      description: "Medical genetics and genomics",
    },
    {
      id: "geriatric-medicine",
      name: "Geriatric Medicine",
      description: "Elderly care and age-related conditions",
    },
    {
      id: "health-economics",
      name: "Health Economics",
      description: "Healthcare economics and policy",
    },
    {
      id: "health-informatics",
      name: "Health Informatics",
      description: "Medical informatics and digital health",
    },
    {
      id: "health-policy",
      name: "Health Policy",
      description: "Healthcare policy and systems",
    },
    {
      id: "hematology",
      name: "Hematology",
      description: "Blood disorders and hematological diseases",
    },
    {
      id: "infectious-diseases",
      name: "Infectious Diseases",
      description: "Microbial infections and treatments",
    },
    {
      id: "intensive-care-medicine",
      name: "Intensive Care Medicine",
      description: "Critical care and intensive medicine",
    },
    {
      id: "medical-education",
      name: "Medical Education",
      description: "Medical training and education",
    },
    {
      id: "medical-ethics",
      name: "Medical Ethics",
      description: "Bioethics and medical ethics",
    },
    {
      id: "nephrology",
      name: "Nephrology",
      description: "Kidney diseases and renal medicine",
    },
    {
      id: "neurology",
      name: "Neurology",
      description: "Neurological diseases and disorders",
    },
    {
      id: "nursing",
      name: "Nursing",
      description: "Nursing practice and research",
    },
    {
      id: "nutrition",
      name: "Nutrition",
      description: "Nutritional science and dietetics",
    },
    {
      id: "obstetrics-and-gynecology",
      name: "Obstetrics and Gynecology",
      description: "Women's health and reproductive medicine",
    },
    {
      id: "occupational-and-environmental-health",
      name: "Occupational and Environmental Health",
      description: "Workplace and environmental health",
    },
    {
      id: "oncology",
      name: "Oncology",
      description: "Cancer medicine and treatment",
    },
    {
      id: "ophthalmology",
      name: "Ophthalmology",
      description: "Eye diseases and vision disorders",
    },
    {
      id: "orthopedics",
      name: "Orthopedics",
      description: "Musculoskeletal disorders and surgery",
    },
    {
      id: "otolaryngology",
      name: "Otolaryngology",
      description: "Ear, nose, and throat diseases",
    },
    {
      id: "pain-medicine",
      name: "Pain Medicine",
      description: "Pain management and treatment",
    },
    {
      id: "palliative-medicine",
      name: "Palliative Medicine",
      description: "End-of-life care and comfort medicine",
    },
    {
      id: "pathology",
      name: "Pathology",
      description: "Disease diagnosis and pathological studies",
    },
    {
      id: "pediatrics",
      name: "Pediatrics",
      description: "Children's health and pediatric medicine",
    },
    {
      id: "pharmacology-and-therapeutics",
      name: "Pharmacology and Therapeutics",
      description: "Drug therapy and pharmacological studies",
    },
    {
      id: "plastic-surgery",
      name: "Plastic Surgery",
      description: "Reconstructive and cosmetic surgery",
    },
    {
      id: "primary-care-research",
      name: "Primary Care Research",
      description: "Primary healthcare and family medicine",
    },
    {
      id: "psychiatry-and-clinical-psychology",
      name: "Psychiatry and Clinical Psychology",
      description: "Mental health and psychological disorders",
    },
    {
      id: "public-and-global-health",
      name: "Public and Global Health",
      description: "Population health and global health issues",
    },
    {
      id: "pulmonology",
      name: "Pulmonology",
      description: "Lung diseases and respiratory medicine",
    },
    {
      id: "radiology-and-imaging",
      name: "Radiology and Imaging",
      description: "Medical imaging and radiology",
    },
    {
      id: "rehabilitation-medicine-and-physical-therapy",
      name: "Rehabilitation Medicine and Physical Therapy",
      description: "Physical rehabilitation and therapy",
    },
    {
      id: "rheumatology",
      name: "Rheumatology",
      description: "Autoimmune and inflammatory diseases",
    },
    {
      id: "sports-medicine",
      name: "Sports Medicine",
      description: "Athletic injuries and sports health",
    },
    {
      id: "surgery",
      name: "Surgery",
      description: "Surgical procedures and techniques",
    },
    {
      id: "transplantation",
      name: "Transplantation",
      description: "Organ transplantation and immunosuppression",
    },
    {
      id: "urology",
      name: "Urology",
      description: "Urinary system and male reproductive health",
    },
  ];

  constructor(rateLimiter: RateLimiter) {
    super(rateLimiter, "biorxiv");
    this.textExtractor = new HtmlExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG);
  }

  /**
   * List bioRxiv/medRxiv categories
   */
  async listCategories(): Promise<Category[]> {
    logInfo("Fetching bioRxiv/medRxiv categories");

    // Combine bioRxiv and medRxiv categories with server prefix
    const allCategories = [
      ...this.bioRxivCategories.map((cat) => ({
        ...cat,
        id: `biorxiv:${cat.id}`,
        description: `[bioRxiv] ${cat.description}`,
      })),
      ...this.medRxivCategories.map((cat) => ({
        ...cat,
        id: `medrxiv:${cat.id}`,
        description: `[medRxiv] ${cat.description}`,
      })),
    ];

    return allCategories;
  }

  /**
   * Fetch latest papers from bioRxiv/medRxiv for a given category
   */
  async fetchLatest(category: string, count: number): Promise<PaperMetadata[]> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching latest bioRxiv/medRxiv papers", {
        retryAfter,
        category,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching latest bioRxiv/medRxiv papers", { category, count });

      // Parse category to determine server and subject
      const { server, subject } = this.parseCategory(category);

      // Calculate date range for recent papers (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const fromDate = startDate.toISOString().split("T")[0];
      const toDate = endDate.toISOString().split("T")[0];

      // Build API URL
      const apiBase =
        server === "medrxiv" ? this.medRxivApiBase : this.bioRxivApiBase;
      const url = `${apiBase}/details/${server}/${fromDate}/${toDate}`;

      const response = await axios.get<BioRxivResponse>(url, {
        params: {
          server: server,
          format: "json",
        },
        timeout: 15000,
        headers: {
          "User-Agent":
            "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); bioRxiv-client",
        },
      });

      if (!response.data || !response.data.collection) {
        logWarn("bioRxiv/medRxiv API returned unexpected response format", {
          category,
          server,
          responseData: response.data,
        });
        return [];
      }

      let papers = response.data.collection;

      // Filter by category if specific subject provided
      if (subject !== "all") {
        papers = papers.filter(
          (paper) =>
            paper.category &&
            paper.category.toLowerCase().includes(subject.toLowerCase()),
        );
      }

      // Sort by date (newest first) and limit count
      papers = papers
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, Math.min(count, 100));

      if (papers.length === 0) {
        logWarn("No bioRxiv/medRxiv papers found for category", {
          category,
          server,
          subject,
        });
        return [];
      }

      // Convert to PaperMetadata format (metadata only)
      const validPapers = papers.filter((paper) => paper.title && paper.doi);
      const paperMetadata = await Promise.all(
        validPapers.map((paper) => this.convertPaperToMetadata(paper, false)),
      );

      logInfo("Successfully fetched bioRxiv/medRxiv latest papers", {
        count: paperMetadata.length,
        category,
        server,
      });

      return paperMetadata;
    } catch (error) {
      logError("Failed to fetch latest bioRxiv/medRxiv papers", {
        error: error instanceof Error ? error.message : error,
        category,
        count,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          throw new Error("Rate limited by bioRxiv/medRxiv API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("bioRxiv/medRxiv API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Fetch content for a specific bioRxiv/medRxiv paper by DOI
   */
  async fetchContent(id: string): Promise<PaperMetadata> {
    if (!this.checkRateLimit()) {
      const retryAfter = this.getRetryAfter();
      logWarn("Rate limited when fetching bioRxiv/medRxiv paper content", {
        retryAfter,
        id,
      });
      throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
    }

    try {
      logInfo("Fetching bioRxiv/medRxiv paper content", { id });

      // Try to determine server from DOI pattern or use both
      const servers = this.getServersForDOI(id);

      for (const server of servers) {
        try {
          const apiBase =
            server === "medrxiv" ? this.medRxivApiBase : this.bioRxivApiBase;
          const url = `${apiBase}/details/doi/${id}`;

          const response = await axios.get<BioRxivResponse>(url, {
            params: {
              server: server,
              format: "json",
            },
            timeout: 15000,
            headers: {
              "User-Agent":
                "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); bioRxiv-client",
            },
          });

          if (
            response.data &&
            response.data.collection &&
            response.data.collection.length > 0
          ) {
            const paper = response.data.collection[0];

            // Convert to paper format with full text extraction
            const paperMetadata = await this.convertPaperToMetadata(
              paper,
              true,
            );

            logInfo("Successfully fetched bioRxiv/medRxiv paper content", {
              id,
              title: paperMetadata.title,
              server,
            });

            return paperMetadata;
          }
        } catch (serverError) {
          logWarn(`Failed to fetch from ${server}`, {
            id,
            server,
            error:
              serverError instanceof Error ? serverError.message : serverError,
          });
          continue;
        }
      }

      throw new Error(`Paper with DOI ${id} not found on bioRxiv or medRxiv`);
    } catch (error) {
      logError("Failed to fetch bioRxiv/medRxiv paper content", {
        error: error instanceof Error ? error.message : error,
        id,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new Error(`Paper with DOI ${id} not found on bioRxiv/medRxiv`);
        }
        if (error.response?.status === 429) {
          throw new Error("Rate limited by bioRxiv/medRxiv API");
        }
        if (error.response?.status && error.response.status >= 500) {
          throw new Error("bioRxiv/medRxiv API server error");
        }
      }

      throw error;
    }
  }

  /**
   * Convert bioRxiv/medRxiv paper to PaperMetadata format
   */
  private async convertPaperToMetadata(
    paper: BioRxivPaper,
    includeText: boolean = false,
  ): Promise<PaperMetadata> {
    // Parse authors string into array
    const authors = paper.authors
      .split(/[,;]|and\s/)
      .map((author) => author.trim())
      .filter((author) => author.length > 0);

    // Format date to ISO format
    const date = paper.date || new Date().toISOString().split("T")[0];

    // Construct URLs
    const server =
      paper.server || (paper.doi.includes("medrxiv") ? "medrxiv" : "biorxiv");
    const paperUrl = `https://www.${server}.org/content/10.1101/${paper.doi}`;
    const pdfUrl = `${paperUrl}.full.pdf`;

    // Create base paper object
    const paperMetadata: PaperMetadata = {
      id: paper.doi,
      title: paper.title || "Untitled",
      authors,
      date,
      pdf_url: pdfUrl,
      text: "", // Always include text field, empty for metadata-only
    };

    // Only extract text if requested (for fetch_content)
    if (includeText) {
      let textTruncated = false;
      let textExtractionFailed = false;

      try {
        // Strategy 1: Try to extract from paper HTML page
        if (this.checkRateLimit()) {
          try {
            const extractionResult =
              await this.textExtractor.extractText(paperUrl);
            if (extractionResult.extractionSuccess) {
              paperMetadata.text = extractionResult.text;
              textTruncated = extractionResult.truncated;
              logInfo("Text extraction successful from bioRxiv/medRxiv HTML", {
                id: paper.doi,
                server,
                textLength: paperMetadata.text.length,
                truncated: textTruncated,
              });
            } else {
              throw new Error("HTML extraction failed");
            }
          } catch (htmlError) {
            // Strategy 2: Use abstract as fallback
            if (paper.abstract && paper.abstract.length > 0) {
              paperMetadata.text = `Abstract: ${paper.abstract}`;
              logInfo(
                "Using abstract as text content for bioRxiv/medRxiv paper",
                {
                  id: paper.doi,
                  server,
                  textLength: paperMetadata.text.length,
                },
              );
            } else {
              textExtractionFailed = true;
              logWarn(
                "All text extraction strategies failed for bioRxiv/medRxiv paper",
                {
                  id: paper.doi,
                  server,
                  htmlError:
                    htmlError instanceof Error ? htmlError.message : htmlError,
                },
              );
            }
          }
        } else {
          textExtractionFailed = true;
          logWarn("Rate limited for text extraction", { id: paper.doi });
        }
      } catch (error) {
        textExtractionFailed = true;
        logError("Error during text extraction for bioRxiv/medRxiv paper", {
          id: paper.doi,
          server,
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
   * Parse category string to determine server and subject
   */
  private parseCategory(category: string): {
    server: "biorxiv" | "medrxiv";
    subject: string;
  } {
    const trimmed = category.toLowerCase().trim();

    if (trimmed.startsWith("biorxiv:")) {
      return { server: "biorxiv", subject: trimmed.replace("biorxiv:", "") };
    } else if (trimmed.startsWith("medrxiv:")) {
      return { server: "medrxiv", subject: trimmed.replace("medrxiv:", "") };
    } else if (trimmed === "biology" || trimmed === "biorxiv") {
      return { server: "biorxiv", subject: "all" };
    } else if (trimmed === "medicine" || trimmed === "medrxiv") {
      return { server: "medrxiv", subject: "all" };
    } else {
      // Default to bioRxiv for general biology terms
      return { server: "biorxiv", subject: trimmed };
    }
  }

  /**
   * Determine which servers to try based on DOI pattern
   */
  private getServersForDOI(doi: string): ("biorxiv" | "medrxiv")[] {
    const lowerDoi = doi.toLowerCase();

    if (lowerDoi.includes("medrxiv")) {
      return ["medrxiv"];
    } else if (lowerDoi.includes("biorxiv")) {
      return ["biorxiv"];
    } else {
      // Try both servers if unclear
      return ["biorxiv", "medrxiv"];
    }
  }
}
