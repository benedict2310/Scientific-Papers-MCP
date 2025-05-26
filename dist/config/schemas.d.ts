import { z } from 'zod';
export declare const ListCategoriesSchema: z.ZodObject<{
    source: z.ZodEnum<["arxiv", "openalex"]>;
}, "strip", z.ZodTypeAny, {
    source: "arxiv" | "openalex";
}, {
    source: "arxiv" | "openalex";
}>;
export declare const FetchLatestSchema: z.ZodObject<{
    source: z.ZodEnum<["arxiv", "openalex"]>;
    category: z.ZodString;
    count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    source: "arxiv" | "openalex";
    category: string;
    count: number;
}, {
    source: "arxiv" | "openalex";
    category: string;
    count?: number | undefined;
}>;
export declare const FetchTopCitedSchema: z.ZodObject<{
    concept: z.ZodString;
    since: z.ZodString;
    count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    count: number;
    concept: string;
    since: string;
}, {
    concept: string;
    since: string;
    count?: number | undefined;
}>;
export declare const FetchContentSchema: z.ZodObject<{
    source: z.ZodEnum<["arxiv", "openalex"]>;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: "arxiv" | "openalex";
    id: string;
}, {
    source: "arxiv" | "openalex";
    id: string;
}>;
export declare const CLIArgsSchema: z.ZodObject<{
    command: z.ZodEnum<["list-categories", "fetch-latest", "fetch-top-cited", "fetch-content"]>;
    source: z.ZodOptional<z.ZodEnum<["arxiv", "openalex"]>>;
    category: z.ZodOptional<z.ZodString>;
    concept: z.ZodOptional<z.ZodString>;
    since: z.ZodOptional<z.ZodString>;
    count: z.ZodOptional<z.ZodNumber>;
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    command: "list-categories" | "fetch-latest" | "fetch-top-cited" | "fetch-content";
    source?: "arxiv" | "openalex" | undefined;
    category?: string | undefined;
    count?: number | undefined;
    concept?: string | undefined;
    since?: string | undefined;
    id?: string | undefined;
}, {
    command: "list-categories" | "fetch-latest" | "fetch-top-cited" | "fetch-content";
    source?: "arxiv" | "openalex" | undefined;
    category?: string | undefined;
    count?: number | undefined;
    concept?: string | undefined;
    since?: string | undefined;
    id?: string | undefined;
}>;
export type ListCategoriesParams = z.infer<typeof ListCategoriesSchema>;
export type FetchLatestParams = z.infer<typeof FetchLatestSchema>;
export type FetchTopCitedParams = z.infer<typeof FetchTopCitedSchema>;
export type FetchContentParams = z.infer<typeof FetchContentSchema>;
export type CLIArgs = z.infer<typeof CLIArgsSchema>;
