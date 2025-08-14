import { z } from "zod";
import { PdfExtractor, PdfMetadata, PdfExtractionProgress } from "../extractors/pdf-extractor.js";
import { DEFAULT_TEXT_EXTRACTION_CONFIG } from "../config/constants.js";
import { logInfo, logError, logWarn } from "../core/logger.js";

// Input validation schema
export const fetchPdfContentSchema = z.object({
  url: z.string().url().describe("Direct URL to a PDF file"),
  maxSizeMB: z.number().min(1).max(100).default(50).describe("Maximum PDF size in MB"),
  maxPages: z.number().min(1).max(500).default(100).describe("Maximum pages to extract"),
  timeout: z.number().min(10).max(300).default(120).describe("Timeout in seconds"),
  confirmLargeFiles: z.boolean().default(false).describe("Require confirmation for large files"),
});

export type FetchPdfContentInput = z.infer<typeof fetchPdfContentSchema>;

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
  cancelled?: boolean;
}

/**
 * MCP tool: fetch_pdf_content
 * Extracts text content from PDF files via direct URL
 */
export async function fetchPdfContent(
  input: FetchPdfContentInput
): Promise<FetchPdfContentResult> {
  try {
    // Validate input
    const validatedInput = fetchPdfContentSchema.parse(input);
    
    logInfo("fetch_pdf_content tool called", {
      url: validatedInput.url,
      maxSizeMB: validatedInput.maxSizeMB,
      maxPages: validatedInput.maxPages,
      timeout: validatedInput.timeout,
      confirmLargeFiles: validatedInput.confirmLargeFiles,
    });

    // Create PDF extractor with specified configuration
    const extractor = new PdfExtractor(DEFAULT_TEXT_EXTRACTION_CONFIG, {
      maxSizeMB: validatedInput.maxSizeMB,
      timeoutMs: validatedInput.timeout * 1000,
      maxPages: validatedInput.maxPages,
      requireConfirmation: validatedInput.confirmLargeFiles,
      interactive: false, // Always non-interactive for MCP tools
    });

    // Extract text with progress and confirmation callbacks
    const result = await extractor.extractText(
      validatedInput.url,
      (progress: PdfExtractionProgress) => {
        // Progress callback for logging
        logInfo("PDF extraction progress", {
          url: validatedInput.url,
          phase: progress.phase,
          progress: progress.progress,
          message: progress.message,
        });
      },
      async (metadata: PdfMetadata) => {
        // Auto-confirmation callback based on size limits
        return handleAutoConfirmation(metadata, validatedInput.maxSizeMB);
      }
    );

    if (!result.extractionSuccess) {
      if (result.metadata?.userCancelled) {
        logWarn("PDF extraction cancelled", {
          url: validatedInput.url,
          reason: result.metadata.reason,
        });
        
        return {
          success: false,
          cancelled: true,
          error: result.metadata.reason || "PDF extraction cancelled",
        };
      }

      logError("PDF extraction failed", {
        url: validatedInput.url,
        error: result.metadata?.error || "Unknown extraction failure",
      });

      return {
        success: false,
        error: "PDF extraction failed",
      };
    }

    // Successful extraction
    logInfo("fetch_pdf_content completed successfully", {
      url: validatedInput.url,
      textLength: result.text?.length || 0,
      pageCount: result.metadata?.pageCount,
      sizeMB: result.metadata?.pdfSize,
      truncated: result.truncated,
    });

    return {
      success: true,
      text: result.text || "",
      metadata: {
        pageCount: result.metadata?.pageCount,
        sizeBytes: result.metadata?.pdfSize ? Math.round(result.metadata.pdfSize * 1024 * 1024) : undefined,
        sizeMB: result.metadata?.pdfSize,
        extractionTime: result.metadata?.extractionTime,
        extractionSource: "pdf",
        textTruncated: result.truncated,
        contextWarning: result.metadata?.contextWarning,
      },
    };
  } catch (error) {
    logError("fetch_pdf_content tool failed", {
      url: input.url,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during PDF extraction",
    };
  }
}

/**
 * Auto-confirmation handler for PDF extraction
 * Makes decision based on size limits without user interaction
 */
async function handleAutoConfirmation(
  metadata: PdfMetadata,
  maxSizeMB: number
): Promise<boolean> {
  const contextImpact = assessContextImpact(metadata.sizeMB);
  
  if (metadata.sizeMB > maxSizeMB) {
    logWarn("PDF exceeds size limit, declining extraction", {
      url: metadata.url,
      sizeMB: metadata.sizeMB,
      maxSizeMB,
      contextImpact,
    });
    return false;
  }

  // Auto-approve PDFs within size limits
  logInfo("PDF within size limits, proceeding with extraction", {
    url: metadata.url,
    sizeMB: metadata.sizeMB,
    contextImpact,
  });
  
  return true;
}

/**
 * Assess the context impact of a PDF based on its size
 */
function assessContextImpact(sizeMB: number): "low" | "medium" | "high" {
  if (sizeMB <= 10) return "low";
  if (sizeMB <= 25) return "medium";
  return "high";
}