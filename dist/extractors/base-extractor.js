export class BaseExtractor {
    config;
    constructor(config) {
        this.config = config;
    }
    createFailedResult() {
        return {
            text: '',
            truncated: false,
            extractionSuccess: false,
            source: 'failed'
        };
    }
    checkTextLength(text) {
        if (text.length <= this.config.maxTextLength) {
            return { text, truncated: false };
        }
        const truncatedText = text.substring(0, this.config.maxTextLength);
        // Try to cut at word boundary
        const lastSpaceIndex = truncatedText.lastIndexOf(' ');
        const finalText = lastSpaceIndex > this.config.maxTextLength * 0.9
            ? truncatedText.substring(0, lastSpaceIndex)
            : truncatedText;
        return { text: finalText, truncated: true };
    }
}
//# sourceMappingURL=base-extractor.js.map