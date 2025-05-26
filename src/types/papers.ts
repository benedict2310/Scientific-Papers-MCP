export interface PaperMetadata {
  id: string;
  title: string;
  authors: string[];
  date: string;  // ISO format
  pdf_url?: string;
  text: string;  // Required in Story 3 - extracted clean text
  textTruncated?: boolean;   // Warning if text was truncated
  textExtractionFailed?: boolean;  // Warning if extraction failed
}

export interface CategoryList {
  source: 'arxiv' | 'openalex';
  categories: Category[];
}

export interface Category {
  id: string;           // e.g., "cs.AI" or concept ID
  name: string;         // Human readable name
  description?: string; // Optional description
}

// New types for Story 2 tools
export interface FetchLatestRequest {
  source: 'arxiv' | 'openalex';
  category: string;
  count: number;     // default 50
}

export interface FetchTopCitedRequest {
  concept: string;
  since: string;     // ISO date format
  count: number;     // default 50
}

export interface FetchContentRequest {
  source: 'arxiv' | 'openalex';
  id: string;
}

// Response wrapper for tools
export interface ToolResponse<T> {
  content: T;
  warnings?: string[];
  errors?: string[];
} 