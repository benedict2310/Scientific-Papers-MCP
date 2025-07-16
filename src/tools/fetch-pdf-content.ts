import { z } from "zod";
import { PdfExtractor, PdfMetadata, PdfExtractionProgress } from "../extractors/pdf-extractor.js";
import { DEFAULT_TEXT_EXTRACTION_CONFIG } from "../config/constants.js";
import { logInfo, logError, logWarn } from "../core/logger.js";

// Input validation schema
const FetchPdfContentSchema = z.object({
  url: z.string().url().describe("Direct URL to a PDF file"),
  maxSizeMB: z.number().min(1).max(100).default(50).describe("Maximum PDF size in MB"),
  maxPages: z.number().min(1).max(500).default(100).describe("Maximum pages to extract"),
  timeout: z.number().min(10).max(300).default(120).describe("Timeout in seconds"),
  confirmLargeFiles: z.boolean().default(true).describe("Require confirmation for large files"),
});

export type FetchPdfContentInput = z.infer<typeof FetchPdfContentSchema>;

export interface FetchPdfContentResult {
  success: boolean;
  text?: string;
  metadata?: {
    pageCount?: number;
    sizeBytes?: number;
    sizeMB?: number;
    extractionTime?: number;
    extractionSource: "pdf";
    textTruncated?: boolean;
    contextWarning?: string;
  };
  error?: string;
  requiresConfirmation?: boolean;
  confirmationDetails?: {
    url: string;
    sizeMB: number;
    estimatedPages?: number;
    contextImpact: "low" | "medium" | "high";
    recommendation: string;
  };
  cancelled?: boolean;
}

export class FetchPdfContentTool {
  private pdfExtractor: PdfExtractor;
  private activeExtractions = new Map<string, PdfExtractor>();

  constructor() {
    this.pdfExtractor = new PdfExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG, {
      maxSizeMB: 50,
      timeoutMs: 120000,
      maxPages: 100,
      requireConfirmation: true,
      interactive: true,
    });
  }

  async execute(input: FetchPdfContentInput): Promise<FetchPdfContentResult> {
    try {
      // Validate input
      const validatedInput = FetchPdfContentSchema.parse(input);
      
      logInfo("Starting PDF extraction", {
        url: validatedInput.url,
        maxSizeMB: validatedInput.maxSizeMB,
        maxPages: validatedInput.maxPages,
      });

      // Create extractor with custom options
      const extractor = new PdfExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG, {
        maxSizeMB: validatedInput.maxSizeMB,
        timeoutMs: validatedInput.timeout * 1000,
        maxPages: validatedInput.maxPages,
        requireConfirmation: validatedInput.confirmLargeFiles,
        interactive: true,
      });

      // Store active extraction for potential cancellation
      this.activeExtractions.set(validatedInput.url, extractor);

      const result = await extractor.extractText(
        validatedInput.url,
        (progress: PdfExtractionProgress) => {
          // Progress callback - in a real implementation, this would be sent to the client
          logInfo("PDF extraction progress", {
            url: validatedInput.url,
            phase: progress.phase,
            progress: progress.progress,
            message: progress.message,
          });
        },
        async (metadata: PdfMetadata) => {
          // Confirmation callback
          return await this.handleConfirmation(metadata);
        }
      );

      // Clean up active extraction
      this.activeExtractions.delete(validatedInput.url);

      if (!result.extractionSuccess) {
        if (result.metadata?.userCancelled) {
          return {
            success: false,
            cancelled: true,
            error: result.metadata.reason || "Extraction cancelled by user",
          };
        }

        return {
          success: false,
          error: "PDF extraction failed",
        };
      }

      // Successful extraction
      return {
        success: true,
        text: result.text,
        metadata: {
          pageCount: result.metadata?.pageCount,
          sizeBytes: result.metadata?.pdfSize ? result.metadata.pdfSize * 1024 * 1024 : undefined,
          sizeMB: result.metadata?.pdfSize,
          extractionTime: result.metadata?.extractionTime,
          extractionSource: "pdf",
          textTruncated: result.truncated,
          contextWarning: result.metadata?.contextWarning,
        },
      };
    } catch (error) {
      logError("PDF extraction tool error", {
        url: input.url,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during PDF extraction",
      };
    }
  }

  private async handleConfirmation(metadata: PdfMetadata): Promise<boolean> {
    // Determine context impact
    const contextImpact = this.assessContextImpact(metadata.sizeMB);
    
    logWarn("Large PDF detected, requiring user confirmation", {
      url: metadata.url,
      sizeMB: metadata.sizeMB,
      contextImpact,
    });

    // In a real MCP implementation, this would trigger a confirmation prompt
    // For now, we'll make a conservative decision based on size
    if (metadata.sizeMB > 30) {
      logWarn("PDF too large, automatically declining", {
        url: metadata.url,
        sizeMB: metadata.sizeMB,
      });
      return false;
    }

    // For medium-sized PDFs, we'll proceed with extraction
    logInfo("Medium-sized PDF, proceeding with extraction", {
      url: metadata.url,
      sizeMB: metadata.sizeMB,
    });
    return true;
  }

  private assessContextImpact(sizeMB: number): "low" | "medium" | "high" {
    if (sizeMB <= 10) return "low";
    if (sizeMB <= 25) return "medium";
    return "high";
  }

  public cancelExtraction(url: string): boolean {
    const extractor = this.activeExtractions.get(url);
    if (extractor) {
      extractor.cancel();
      this.activeExtractions.delete(url);
      logInfo("PDF extraction cancelled", { url });
      return true;
    }
    return false;
  }

  public getActiveExtractions(): string[] {
    return Array.from(this.activeExtractions.keys());
  }
}

export const fetchPdfContent = new FetchPdfContentTool();