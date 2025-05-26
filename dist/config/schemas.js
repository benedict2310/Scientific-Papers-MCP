import { z } from 'zod';
// Tool parameter schemas
export const ListCategoriesSchema = z.object({
    source: z.enum(['arxiv', 'openalex']),
});
export const FetchLatestSchema = z.object({
    source: z.enum(['arxiv', 'openalex']),
    category: z.string().min(1),
    count: z.number().min(1).max(200).default(50),
});
export const FetchTopCitedSchema = z.object({
    concept: z.string().min(1),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    count: z.number().min(1).max(200).default(50),
});
export const FetchContentSchema = z.object({
    source: z.enum(['arxiv', 'openalex']),
    id: z.string().min(1),
});
// CLI parameter schemas
export const CLIArgsSchema = z.object({
    command: z.enum(['list-categories', 'fetch-latest', 'fetch-top-cited', 'fetch-content']),
    source: z.enum(['arxiv', 'openalex']).optional(),
    category: z.string().optional(),
    concept: z.string().optional(),
    since: z.string().optional(),
    count: z.number().optional(),
    id: z.string().optional(),
});
//# sourceMappingURL=schemas.js.map