/**
 * DOI Resolver Module - Week 2 Implementation
 *
 * Provides a fallback chain: Unpaywall → Crossref → Semantic Scholar Academic Graph (S2AG)
 * Implements 24h LRU cache and rate limiting for external APIs
 */

import axios from "axios";
import { logInfo, logError, logWarn } from "../core/logger.js";

export interface DOIResolutionResult {
  doi: string;
  fullTextUrl?: string;
  pdfUrl?: string;
  landingPageUrl?: string;
  source: "unpaywall" | "crossref" | "s2ag" | "none";
  isOpenAccess: boolean;
  license?: string;
  resolverPath: string;
  cached: boolean;
}

interface UnpaywallResponse {
  doi: string;
  is_oa: boolean;
  best_oa_location?: {
    url_for_landing_page?: string;
    url_for_pdf?: string;
    license?: string;
    host_type?: string;
  };
  oa_locations?: Array<{
    url_for_landing_page?: string;
    url_for_pdf?: string;
    license?: string;
    host_type?: string;
  }>;
}

interface CrossrefWork {
  DOI: string;
  URL?: string;
  link?: Array<{
    URL: string;
    "content-type": string;
    "content-version": string;
    "intended-application": string;
  }>;
  license?: Array<{
    URL: string;
    start: any;
    "delay-in-days"?: number;
    "content-version": string;
  }>;
}

interface CrossrefResponse {
  status: string;
  message: CrossrefWork;
}

interface S2AGResponse {
  paperId: string;
  externalIds?: {
    DOI?: string;
  };
  openAccessPdf?: {
    url: string;
    status: string;
  };
  url?: string;
  isOpenAccess?: boolean;
}

/**
 * Simple LRU Cache implementation for DOI resolution results
 */
class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, { value: T; timestamp: number }>;
  private ttl: number; // Time to live in milliseconds

  constructor(capacity: number, ttlHours: number = 24) {
    this.capacity = capacity;
    this.cache = new Map();
    this.ttl = ttlHours * 60 * 60 * 1000; // Convert hours to milliseconds
  }

  get(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: string, value: T): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Remove oldest if at capacity
    else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export class DOIResolver {
  private cache: LRUCache<DOIResolutionResult>;
  private requestCounts: Map<string, { count: number; resetTime: number }>;
  private readonly UNPAYWALL_RATE_LIMIT = 100000; // 100k requests per day
  private readonly CROSSREF_RATE_LIMIT = 50; // 50 requests per second
  private readonly S2AG_RATE_LIMIT = 100; // 100 requests per minute

  constructor(cacheSize: number = 10000, cacheTtlHours: number = 24) {
    this.cache = new LRUCache<DOIResolutionResult>(cacheSize, cacheTtlHours);
    this.requestCounts = new Map();
  }

  /**
   * Main DOI resolution method with fallback chain
   */
  async resolveDOI(doi: string): Promise<DOIResolutionResult> {
    const normalizedDoi = this.normalizeDOI(doi);

    logInfo("Starting DOI resolution", { doi: normalizedDoi });

    // Check cache first
    const cached = this.cache.get(normalizedDoi);
    if (cached) {
      logInfo("DOI resolution cache hit", {
        doi: normalizedDoi,
        source: cached.source,
      });
      return { ...cached, cached: true };
    }

    let resolverPath = "";

    // Step 1: Try Unpaywall (best for open access detection)
    try {
      if (this.checkRateLimit("unpaywall")) {
        resolverPath += "unpaywall";
        const unpaywallResult = await this.resolveWithUnpaywall(normalizedDoi);
        if (unpaywallResult.fullTextUrl || unpaywallResult.pdfUrl) {
          const result = { ...unpaywallResult, resolverPath, cached: false };
          this.cache.set(normalizedDoi, result);
          return result;
        }
      } else {
        logWarn("Unpaywall rate limit exceeded, skipping", {
          doi: normalizedDoi,
        });
      }
    } catch (error) {
      logWarn("Unpaywall resolution failed", {
        doi: normalizedDoi,
        error: error instanceof Error ? error.message : error,
      });
    }

    // Step 2: Try Crossref (good for DOI metadata and links)
    try {
      if (this.checkRateLimit("crossref")) {
        resolverPath += resolverPath ? ",crossref" : "crossref";
        const crossrefResult = await this.resolveWithCrossref(normalizedDoi);
        if (crossrefResult.fullTextUrl || crossrefResult.landingPageUrl) {
          const result = { ...crossrefResult, resolverPath, cached: false };
          this.cache.set(normalizedDoi, result);
          return result;
        }
      } else {
        logWarn("Crossref rate limit exceeded, skipping", {
          doi: normalizedDoi,
        });
      }
    } catch (error) {
      logWarn("Crossref resolution failed", {
        doi: normalizedDoi,
        error: error instanceof Error ? error.message : error,
      });
    }

    // Step 3: Try Semantic Scholar Academic Graph (S2AG)
    try {
      if (this.checkRateLimit("s2ag")) {
        resolverPath += resolverPath ? ",s2ag" : "s2ag";
        const s2agResult = await this.resolveWithS2AG(normalizedDoi);
        if (s2agResult.fullTextUrl || s2agResult.pdfUrl) {
          const result = { ...s2agResult, resolverPath, cached: false };
          this.cache.set(normalizedDoi, result);
          return result;
        }
      } else {
        logWarn("S2AG rate limit exceeded, skipping", { doi: normalizedDoi });
      }
    } catch (error) {
      logWarn("S2AG resolution failed", {
        doi: normalizedDoi,
        error: error instanceof Error ? error.message : error,
      });
    }

    // No resolution found
    const noResult: DOIResolutionResult = {
      doi: normalizedDoi,
      source: "none",
      isOpenAccess: false,
      resolverPath: resolverPath || "no_attempts",
      cached: false,
    };

    this.cache.set(normalizedDoi, noResult);
    logInfo("DOI resolution failed across all sources", {
      doi: normalizedDoi,
      resolverPath,
    });

    return noResult;
  }

  /**
   * Resolve DOI using Unpaywall API
   */
  private async resolveWithUnpaywall(
    doi: string,
  ): Promise<DOIResolutionResult> {
    const url = `https://api.unpaywall.org/v2/${doi}?email=contact@sciharvestermcp.org`;

    const response = await axios.get<UnpaywallResponse>(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); DOI-resolver",
      },
    });

    const data = response.data;

    let fullTextUrl: string | undefined;
    let pdfUrl: string | undefined;
    let license: string | undefined;

    // Check best OA location first
    if (data.best_oa_location) {
      pdfUrl = data.best_oa_location.url_for_pdf;
      fullTextUrl = data.best_oa_location.url_for_landing_page || pdfUrl;
      license = data.best_oa_location.license;
    }

    // Fallback to any OA location if no best location
    if (!fullTextUrl && data.oa_locations && data.oa_locations.length > 0) {
      const firstLocation = data.oa_locations[0];
      pdfUrl = firstLocation.url_for_pdf;
      fullTextUrl = firstLocation.url_for_landing_page || pdfUrl;
      license = firstLocation.license;
    }

    this.incrementRequestCount("unpaywall");

    return {
      doi,
      fullTextUrl,
      pdfUrl,
      source: "unpaywall",
      isOpenAccess: data.is_oa,
      license,
      resolverPath: "unpaywall",
      cached: false,
    };
  }

  /**
   * Resolve DOI using Crossref API
   */
  private async resolveWithCrossref(doi: string): Promise<DOIResolutionResult> {
    const url = `https://api.crossref.org/works/${doi}`;

    const response = await axios.get<CrossrefResponse>(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); DOI-resolver",
      },
    });

    const work = response.data.message;

    let fullTextUrl = work.URL;
    let landingPageUrl = work.URL;
    let license: string | undefined;

    // Check for direct links to full text
    if (work.link && work.link.length > 0) {
      const fullTextLink = work.link.find(
        (link) =>
          link["intended-application"] === "text-mining" ||
          link["content-type"] === "application/pdf",
      );
      if (fullTextLink) {
        fullTextUrl = fullTextLink.URL;
      }
    }

    // Check license information
    if (work.license && work.license.length > 0) {
      license = work.license[0].URL;
    }

    this.incrementRequestCount("crossref");

    return {
      doi,
      fullTextUrl,
      landingPageUrl,
      source: "crossref",
      isOpenAccess: Boolean(license), // Assume open access if license is available
      license,
      resolverPath: "crossref",
      cached: false,
    };
  }

  /**
   * Resolve DOI using Semantic Scholar Academic Graph (S2AG)
   */
  private async resolveWithS2AG(doi: string): Promise<DOIResolutionResult> {
    const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${doi}`;

    const response = await axios.get<S2AGResponse>(url, {
      timeout: 10000,
      params: {
        fields: "paperId,externalIds,openAccessPdf,url,isOpenAccess",
      },
      headers: {
        "User-Agent":
          "SciHarvester-MCP/0.1.27 (mailto:contact@sciharvestermcp.org); DOI-resolver",
      },
    });

    const data = response.data;

    const pdfUrl = data.openAccessPdf?.url;
    const fullTextUrl = pdfUrl || data.url;
    const isOpenAccess = data.isOpenAccess || Boolean(data.openAccessPdf);

    this.incrementRequestCount("s2ag");

    return {
      doi,
      fullTextUrl,
      pdfUrl,
      source: "s2ag",
      isOpenAccess,
      resolverPath: "s2ag",
      cached: false,
    };
  }

  /**
   * Normalize DOI format
   */
  private normalizeDOI(doi: string): string {
    // Remove common prefixes and normalize
    return doi
      .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "")
      .replace(/^doi:/, "")
      .toLowerCase()
      .trim();
  }

  /**
   * Simple rate limiting check
   */
  private checkRateLimit(service: string): boolean {
    const now = Date.now();
    const counts = this.requestCounts.get(service);

    if (!counts) {
      this.requestCounts.set(service, { count: 0, resetTime: now + 60000 });
      return true;
    }

    // Reset counter if time window has passed
    if (now > counts.resetTime) {
      this.requestCounts.set(service, { count: 0, resetTime: now + 60000 });
      return true;
    }

    // Check service-specific limits
    switch (service) {
      case "unpaywall":
        return counts.count < this.UNPAYWALL_RATE_LIMIT / (24 * 60); // Per minute approximation
      case "crossref":
        return counts.count < this.CROSSREF_RATE_LIMIT;
      case "s2ag":
        return counts.count < this.S2AG_RATE_LIMIT;
      default:
        return true;
    }
  }

  /**
   * Increment request count for rate limiting
   */
  private incrementRequestCount(service: string): void {
    const counts = this.requestCounts.get(service);
    if (counts) {
      counts.count++;
    } else {
      this.requestCounts.set(service, {
        count: 1,
        resetTime: Date.now() + 60000,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; capacity: number } {
    return {
      size: this.cache.size(),
      capacity: 10000, // Default capacity
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logInfo("DOI resolver cache cleared");
  }
}
