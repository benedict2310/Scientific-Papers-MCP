// API Endpoints
export const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';
export const OPENALEX_API_BASE = 'https://api.openalex.org';

// Rate limiting defaults
export const DEFAULT_RATE_LIMITS = {
  arxiv: {
    maxTokens: 5,
    refillRate: 5 / 60, // 5 requests per minute as per arXiv guidelines
  },
  openalex: {
    maxTokens: 10,
    refillRate: 10 / 1, // 10 requests per second as per OpenAlex API limits (polite pool)
  },
} as const;

// Default parameters
export const DEFAULT_PAPER_COUNT = 50;
export const MAX_PAPER_COUNT = 200;
export const MAX_RESPONSE_SIZE = 8 * 1024 * 1024; // 8MB

// Text extraction configuration
export const DEFAULT_TEXT_EXTRACTION_CONFIG = {
  maxTextLength: 6 * 1024 * 1024, // 6MB to leave room for metadata in 8MB response
  enableArxivFallback: true,
  enableOpenAlexExtraction: true,
  cleaningOptions: {
    removeExtraWhitespace: true,
    removeSpecialChars: false, // Keep special chars for scientific content
    normalizeLineBreaks: true,
  },
} as const;

// HTML extraction endpoints
export const ARXIV_HTML_BASE = 'https://arxiv.org/html';
export const AR5IV_HTML_BASE = 'https://ar5iv.labs.arxiv.org/html';

// arXiv categories (commonly used ones for initial implementation)
export const ARXIV_CATEGORIES = [
  { id: 'cs.AI', name: 'Artificial Intelligence', description: 'Covers all areas of AI except Vision, Robotics, Machine Learning, Multiagent Systems, and Computation and Language' },
  { id: 'cs.LG', name: 'Machine Learning', description: 'Papers on all aspects of machine learning research' },
  { id: 'cs.CL', name: 'Computation and Language', description: 'Covers natural language processing, computational linguistics, and related areas' },
  { id: 'cs.CV', name: 'Computer Vision and Pattern Recognition', description: 'Covers image processing, computer vision, pattern recognition, and scene understanding' },
  { id: 'cs.RO', name: 'Robotics', description: 'Roughly includes material in ACM Subject Class I.2.9' },
  { id: 'physics.gen-ph', name: 'General Physics', description: 'Description coming soon' },
  { id: 'math.CO', name: 'Combinatorics', description: 'Discrete mathematics, graph theory, enumeration, algebraic combinatorics' },
  { id: 'stat.ML', name: 'Machine Learning (Statistics)', description: 'Machine learning papers with a statistics focus' },
] as const; 