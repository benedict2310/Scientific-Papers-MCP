// arXiv Entry to Internal Format
export interface ArxivEntry {
  id: string;           // "2401.12345"
  title: string;
  authors: Author[];
  published: string;
  pdf_url: string;
  html_url?: string;
}

export interface Author {
  name: string;
  affiliation?: string;
}

// OpenAlex Work to Internal Format  
export interface OpenAlexWork {
  id: string;           // "W2741809807"
  title: string;
  authorships: Authorship[];
  publication_date: string;
  primary_location: {
    landing_page_url?: string;
    pdf_url?: string;
    source_type: string;
  };
}

export interface Authorship {
  author: {
    display_name: string;
    id?: string;
  };
  institutions: Array<{
    display_name: string;
    id?: string;
  }>;
}

// Rate limiter state
export interface RateLimiterState {
  [source: string]: {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number; // tokens per second
  };
} 