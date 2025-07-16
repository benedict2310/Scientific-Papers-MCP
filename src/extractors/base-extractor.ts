export interface TextExtractionResult {
  text: string;
  truncated: boolean;
  extractionSuccess: boolean;
  source: "arxiv-html" | "ar5iv" | "openalex-html" | "pdf" | "failed";
  metadata?: {
    [key: string]: any;
  };
}

export interface ExtractionConfig {
  maxTextLength: number; // For 8MB limit
  enableArxivFallback: boolean;
  enableOpenAlexExtraction: boolean;
  enablePdfExtraction: boolean;
  cleaningOptions: {
    removeExtraWhitespace: boolean;
    removeSpecialChars: boolean;
    normalizeLineBreaks: boolean;
  };
}

export abstract class BaseExtractor {
  protected config: ExtractionConfig;

  constructor(config: ExtractionConfig) {
    this.config = config;
  }

  abstract extractText(url: string): Promise<TextExtractionResult>;

  protected createFailedResult(): TextExtractionResult {
    return {
      text: "",
      truncated: false,
      extractionSuccess: false,
      source: "failed",
    };
  }

  protected checkTextLength(text: string): {
    text: string;
    truncated: boolean;
  } {
    if (text.length <= this.config.maxTextLength) {
      return { text, truncated: false };
    }

    const truncatedText = text.substring(0, this.config.maxTextLength);
    // Try to cut at word boundary
    const lastSpaceIndex = truncatedText.lastIndexOf(" ");
    const finalText =
      lastSpaceIndex > this.config.maxTextLength * 0.9
        ? truncatedText.substring(0, lastSpaceIndex)
        : truncatedText;

    return { text: finalText, truncated: true };
  }
}
