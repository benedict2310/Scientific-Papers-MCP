import { PaperMetadata, CategoryList } from "./papers.js";

export interface ToolResponse {
  content: PaperMetadata[] | CategoryList | PaperMetadata;
  warnings?: string[];
  errors?: string[];
}

export interface MCPError {
  code:
    | "NotAvailable"
    | "PartialSuccess"
    | "RateLimited"
    | "SourceDown"
    | "InvalidQuery";
  message: string;
  suggestions?: string[];
  retryAfter?: number; // seconds
}
