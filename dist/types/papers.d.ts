export interface PaperMetadata {
    id: string;
    title: string;
    authors: string[];
    date: string;
    pdf_url?: string;
    text: string;
    textTruncated?: boolean;
    textExtractionFailed?: boolean;
}
export interface CategoryList {
    source: 'arxiv' | 'openalex';
    categories: Category[];
}
export interface Category {
    id: string;
    name: string;
    description?: string;
}
export interface FetchLatestRequest {
    source: 'arxiv' | 'openalex';
    category: string;
    count: number;
}
export interface FetchTopCitedRequest {
    concept: string;
    since: string;
    count: number;
}
export interface FetchContentRequest {
    source: 'arxiv' | 'openalex';
    id: string;
}
export interface ToolResponse<T> {
    content: T;
    warnings?: string[];
    errors?: string[];
}
