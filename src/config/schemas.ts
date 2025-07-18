import { z } from "zod";

// Tool parameter schemas
export const ListCategoriesSchema = z.object({
  source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]),
});

export const FetchLatestSchema = z.object({
  source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]),
  category: z.string().min(1),
  count: z.number().min(1).max(200).default(50),
});

export const FetchTopCitedSchema = z.object({
  concept: z.string().min(1),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().min(1).max(200).default(50),
});

export const FetchContentSchema = z.object({
  source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]),
  id: z.string().min(1),
});

// CLI parameter schemas
export const CLIArgsSchema = z.object({
  command: z.enum([
    "list-categories",
    "fetch-latest",
    "fetch-top-cited",
    "fetch-content",
  ]),
  source: z
    .enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"])
    .optional(),
  category: z.string().optional(),
  concept: z.string().optional(),
  since: z.string().optional(),
  count: z.number().optional(),
  id: z.string().optional(),
});

// Export types for TypeScript
export type ListCategoriesParams = z.infer<typeof ListCategoriesSchema>;
export type FetchLatestParams = z.infer<typeof FetchLatestSchema>;
export type FetchTopCitedParams = z.infer<typeof FetchTopCitedSchema>;
export type FetchContentParams = z.infer<typeof FetchContentSchema>;
export type CLIArgs = z.infer<typeof CLIArgsSchema>;
