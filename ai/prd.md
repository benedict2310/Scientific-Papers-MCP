# Product Requirements Document

**Project Name:** MCP Server – Scientific‑Paper Harvester & Text‑Search
**Owner:** R\&D (You)
**Draft Date:** 23 May 2025

---

## 1 — Revised MVP Scope

### 1.1 Tools exposed through MCP

| Tool              | Parameters                                                      | Behaviour                                                      |                                                                                               |
| ----------------- | --------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `fetch_latest`    | `{ source:"arxiv"                                              | "openalex", category:string, count:number (default 50) }`   | Return newest *N* papers for the category as `{ id, title, authors, date, pdf_url }[]` (metadata only). |
| `fetch_top_cited` | `{ concept:string, since:ISO‑date, count:number (default 50) }` | OpenAlex query sorted by `cited_by_count`, same return schema (metadata only). |                                                                                               |
| `list_categories` | `{ source:"arxiv"                                              | "openalex" }`                                                 | Return cached list of subject codes / concept IDs.                                            |
| `fetch_content`   | `{ source:"arxiv"                                              | "openalex", id:string }`                                     | Return full metadata and **text** for the specific paper.                                     |

### 1.2 Extraction pipeline

* **arXiv** → `https://arxiv.org/html/<id>` (fallback `ar5iv`) → strip HTML → plain text.
* **OpenAlex** → if `primary_location.source_type=="html"` fetch & strip; **if only a PDF is available the record is skipped in the MVP** (PDF extraction to be added post‑MVP using a JS‑only library such as `pdfjs-dist`).
* On any failure the item is skipped (not fatal).

### 1.3 No persistent store

Data is streamed back in the MCP response; in‑memory cache only for a single call.

### 1.4 Packaging

Published on npm. One‑liner:

```bash
npx @futurelab/latest-science-mcp
```

This spins up the Stdio MCP server under the hood, allowing LLMs to access the cited tools. Target runtime: **Node.js 20 LTS** (ESM).

---

## 2 — Functional Requirements

| ID      | Requirement                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **F‑1** | `fetch_latest`/`fetch_top_cited` must deliver metadata for ≥ 90 % of OA items or return a PartialSuccess warning.                    |
| **F‑2** | `fetch_content` must return text if obtainable; if the item is pay‑walled or fails extraction it returns a `NotAvailable` error. |
| **F‑3** | Respect max 5 req/s per host; exponential back‑off on 429/503.                                                                   |
| **F‑4** | Response payload ≤ 8 MB to fit within LLM context budgets.                                                                       |
| **F‑5** | CLI parity: every MCP tool callable through CLI for offline tests.                                                               |

\------- | ------------------------------------------------------------------------------------------------------------- |
\| **F‑1** | `fetch_latest`/`fetch_top_cited` must deliver text for ≥ 90 % of OA items or return a PartialSuccess warning. |
\| **F‑2** | Respect max 5 req/s per host; exponential back‑off on 429/503.                                                |
\| **F‑3** | Response payload ≤ 8 MB to fit within LLM context budgets.                                                    |
\| **F‑4** | CLI parity: every MCP tool callable through CLI for offline tests.                                            |

---

## 3 — Public MCP Interface (TypeScript sketch)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { $1, fetchContent } from "./lib/drivers.js";

const server = new McpServer({ name: "SciHarvester", version: "0.1.0" });

server.tool("fetch_latest", {
  source: z.enum(["arxiv", "openalex"]),
  category: z.string(),
  count: z.number().min(1)
}, async ({ source, category, count }) => ({
  content: await fetchLatest(source, category, count)
}));

server.tool("fetch_top_cited", {
  concept: z.string(),
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().min(1)
}, async ({ concept, since, count }) => ({
  content: await fetchTopCited(concept, since, count)
}));

server.tool("list_categories", {
  source: z.enum(["arxiv", "openalex"])
}, async ({ source }) => ({
  content: [{ type: "json", json: await listCategories(source) }]
}));

server.tool("fetch_content", {
  source: z.enum(["arxiv", "openalex"]),
  id: z.string()
}, async ({ source, id }) => ({
  content: await fetchContent(source, id)
}));

await server.connect(new StdioServerTransport());
```

---

## 4 — Testing Strategy

| Layer             | Framework & libs | Offline technique                              |
| ----------------- | ---------------- | ---------------------------------------------- |
| Unit              | vitest / jest    | **nock** to replay fixtures for all HTTP calls |
| Integration (CLI) | jest + execa     | nock fixtures; assert JSON schema with zod     |
| MCP contract      | MCP SDK harness  | Feed CALL\_TOOL messages via stdin/stdout      |
| CI                | GitHub Actions   | Block real net; `npm test` must pass           |

Fixtures stored under `__fixtures__/` include one Atom entry + HTML, one OpenAlex Work + HTML, one small OA PDF.

---

## 5 — Milestones (10‑day sprint)

| Day | Deliverable                                        |
| --- | -------------------------------------------------- |
| 1‑2 | repo scaffold, fixtures captured                   |
| 3‑4 | arXiv driver + extractor + tests                   |
| 5‑6 | OpenAlex driver + top‑cited query + extractor      |
| 7   | CLI wrappers + MCP tool wires                      |
| 8   | Integration tests green                            |
| 9   | Docs & examples                                    |
| 10  | Publish `0.1.0-beta` to npm; smoke‑test with `npx` |

---

## 6 — Resolved Clarifications

1. **Node version** – target **Node 20 LTS** with ESM (`"type":"module"`).
2. **PDF extractor** – **not included** in MVP; post‑MVP will adopt a **JS‑only** extractor (e.g. `pdfjs-dist`).
3. **Result count** – default suggestion **50**, but the caller may request more; no enforced hard maximum in the API.
