import { ExtractionConfig } from './base-extractor.js';
export declare class TextCleaner {
    private config;
    constructor(config: ExtractionConfig['cleaningOptions']);
    cleanText(text: string): string;
    private normalizeWhitespace;
    private normalizeLineBreaks;
    private removeSpecialCharacters;
    /**
     * Clean HTML content by removing navigation, sidebar, and other non-content elements
     */
    cleanHtmlContent(html: string): string;
    /**
     * Extract text content from specific academic paper sections
     */
    extractAcademicContent(html: string): string;
}
