export declare const ARXIV_API_BASE = "https://export.arxiv.org/api/query";
export declare const OPENALEX_API_BASE = "https://api.openalex.org";
export declare const DEFAULT_RATE_LIMITS: {
    readonly arxiv: {
        readonly maxTokens: 5;
        readonly refillRate: number;
    };
    readonly openalex: {
        readonly maxTokens: 10;
        readonly refillRate: number;
    };
};
export declare const DEFAULT_PAPER_COUNT = 50;
export declare const MAX_PAPER_COUNT = 200;
export declare const MAX_RESPONSE_SIZE: number;
export declare const DEFAULT_TEXT_EXTRACTION_CONFIG: {
    readonly maxTextLength: number;
    readonly enableArxivFallback: true;
    readonly enableOpenAlexExtraction: true;
    readonly cleaningOptions: {
        readonly removeExtraWhitespace: true;
        readonly removeSpecialChars: false;
        readonly normalizeLineBreaks: true;
    };
};
export declare const ARXIV_HTML_BASE = "https://arxiv.org/html";
export declare const AR5IV_HTML_BASE = "https://ar5iv.labs.arxiv.org/html";
export declare const ARXIV_CATEGORIES: readonly [{
    readonly id: "cs.AI";
    readonly name: "Artificial Intelligence";
    readonly description: "Covers all areas of AI except Vision, Robotics, Machine Learning, Multiagent Systems, and Computation and Language";
}, {
    readonly id: "cs.LG";
    readonly name: "Machine Learning";
    readonly description: "Papers on all aspects of machine learning research";
}, {
    readonly id: "cs.CL";
    readonly name: "Computation and Language";
    readonly description: "Covers natural language processing, computational linguistics, and related areas";
}, {
    readonly id: "cs.CV";
    readonly name: "Computer Vision and Pattern Recognition";
    readonly description: "Covers image processing, computer vision, pattern recognition, and scene understanding";
}, {
    readonly id: "cs.RO";
    readonly name: "Robotics";
    readonly description: "Roughly includes material in ACM Subject Class I.2.9";
}, {
    readonly id: "physics.gen-ph";
    readonly name: "General Physics";
    readonly description: "Description coming soon";
}, {
    readonly id: "math.CO";
    readonly name: "Combinatorics";
    readonly description: "Discrete mathematics, graph theory, enumeration, algebraic combinatorics";
}, {
    readonly id: "stat.ML";
    readonly name: "Machine Learning (Statistics)";
    readonly description: "Machine learning papers with a statistics focus";
}];
