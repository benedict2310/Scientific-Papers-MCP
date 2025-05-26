import { ExtractionConfig } from './base-extractor.js';

export class TextCleaner {
  private config: ExtractionConfig['cleaningOptions'];

  constructor(config: ExtractionConfig['cleaningOptions']) {
    this.config = config;
  }

  cleanText(text: string): string {
    let cleaned = text;

    if (this.config.removeExtraWhitespace) {
      cleaned = this.normalizeWhitespace(cleaned);
    }

    if (this.config.normalizeLineBreaks) {
      cleaned = this.normalizeLineBreaks(cleaned);
    }

    if (this.config.removeSpecialChars) {
      cleaned = this.removeSpecialCharacters(cleaned);
    }

    return cleaned.trim();
  }

  private normalizeWhitespace(text: string): string {
    // Replace multiple spaces with single space
    // Replace tabs with spaces
    // Remove trailing whitespace from lines
    return text
      .replace(/\t/g, ' ')                    // Replace tabs with spaces
      .replace(/ +/g, ' ')                    // Multiple spaces to single space
      .replace(/^[ \t]+|[ \t]+$/gm, '');      // Remove leading/trailing whitespace per line
  }

  private normalizeLineBreaks(text: string): string {
    // Normalize line breaks and ensure proper paragraph structure
    return text
      .replace(/\r\n/g, '\n')                 // Windows to Unix line endings
      .replace(/\r/g, '\n')                   // Mac to Unix line endings
      .replace(/\n{3,}/g, '\n\n')             // Multiple line breaks to double
      .replace(/\n\s*\n/g, '\n\n');           // Clean up whitespace between paragraphs
  }

  private removeSpecialCharacters(text: string): string {
    // Remove common HTML artifacts and special characters that don't add value
    return text
      .replace(/[^\w\s\.,;:!?()[\]{}"'-]/g, '') // Keep basic punctuation
      .replace(/\s+/g, ' ');                    // Clean up any multiple spaces created
  }

  /**
   * Clean HTML content by removing navigation, sidebar, and other non-content elements
   */
  cleanHtmlContent(html: string): string {
    // Remove common non-content sections
    return html
      .replace(/<nav[^>]*>.*?<\/nav>/gis, '')           // Navigation
      .replace(/<header[^>]*>.*?<\/header>/gis, '')     // Headers
      .replace(/<footer[^>]*>.*?<\/footer>/gis, '')     // Footers
      .replace(/<aside[^>]*>.*?<\/aside>/gis, '')       // Sidebars
      .replace(/<div[^>]*class[^>]*sidebar[^>]*>.*?<\/div>/gis, '') // Sidebar divs
      .replace(/<div[^>]*class[^>]*nav[^>]*>.*?<\/div>/gis, '')     // Navigation divs
      .replace(/<script[^>]*>.*?<\/script>/gis, '')     // Scripts
      .replace(/<style[^>]*>.*?<\/style>/gis, '')       // Styles
      .replace(/<!--.*?-->/gis, '');                    // Comments
  }

  /**
   * Extract text content from specific academic paper sections
   */
  extractAcademicContent(html: string): string {
    // Look for common academic paper selectors
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.paper-content',
      '.article-body',
      '.content',
      'main',
      '#content',
      '.ltx_document'  // LaTeX-specific for arXiv papers
    ];

    // This is a simplified version - the actual HTML parsing will be done with cheerio
    return this.cleanHtmlContent(html);
  }
} 