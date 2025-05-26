import { BaseExtractor, TextExtractionResult, ExtractionConfig } from './base-extractor.js';
export declare class HtmlExtractor extends BaseExtractor {
    private textCleaner;
    constructor(config: ExtractionConfig);
    extractText(url: string): Promise<TextExtractionResult>;
    private extractArxivText;
    private extractOpenAlexText;
    private fetchHtml;
    private processArxivHtml;
    private processOpenAlexHtml;
    private extractArxivId;
}
