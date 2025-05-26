export interface TextExtractionResult {
    text: string;
    truncated: boolean;
    extractionSuccess: boolean;
    source: 'arxiv-html' | 'ar5iv' | 'openalex-html' | 'failed';
}
export interface ExtractionConfig {
    maxTextLength: number;
    enableArxivFallback: boolean;
    enableOpenAlexExtraction: boolean;
    cleaningOptions: {
        removeExtraWhitespace: boolean;
        removeSpecialChars: boolean;
        normalizeLineBreaks: boolean;
    };
}
export declare abstract class BaseExtractor {
    protected config: ExtractionConfig;
    constructor(config: ExtractionConfig);
    abstract extractText(url: string): Promise<TextExtractionResult>;
    protected createFailedResult(): TextExtractionResult;
    protected checkTextLength(text: string): {
        text: string;
        truncated: boolean;
    };
}
