# Story-2: Paper Fetching Tools (Metadata Only)

**Epic:** Scientific Paper Harvester MCP Server MVP
**Status:** Completed
**Assignee:** Developer
**Sprint:** 2
**Estimated Effort:** Medium

## User Story

As a developer or researcher, I want to fetch the latest papers from arXiv and OpenAlex, get top cited papers from OpenAlex, and retrieve metadata for specific papers so that I can access and query scientific literature metadata through the MCP server before adding text extraction capabilities.

## Acceptance Criteria

- [x] **AC-1:** `fetch_latest` tool works for arXiv source and returns papers with metadata (id, title, authors, date, pdf_url)
- [x] **AC-2:** `fetch_latest` tool works for OpenAlex source and returns papers with metadata
- [x] **AC-3:** `fetch_top_cited` tool works for OpenAlex and returns top cited papers sorted by citation count (metadata only)
- [x] **AC-4:** `fetch_content` tool retrieves full metadata for a specific paper by ID from both sources (no text yet)
- [x] **AC-5:** All tools respect rate limiting (5 req/s max per source) and handle errors gracefully
- [x] **AC-6:** CLI interface provides access to all three new tools for offline testing
- [x] **AC-7:** Response payloads are properly structured and validated with consistent schema
- [x] **AC-8:** Tools integrate seamlessly with existing MCP server from Story 1

## Technical Requirements

### Prerequisites
- Story 1 completed (MCP server foundation with list_categories)
- Node.js 20 LTS with ESM modules
- Existing rate limiter and driver architecture

### Implementation Tasks
- [x] **T-1:** Extend arXiv driver to support `fetch_latest` returning metadata from API search results
- [x] **T-2:** Extend OpenAlex driver to support `fetch_latest` and `fetch_top_cited` with metadata from API
- [x] **T-3:** Implement `fetch_content` tool for both arXiv and OpenAlex sources (metadata only)
- [x] **T-4:** Add MCP tool definitions with proper Zod validation for all three new tools
- [x] **T-5:** Implement response size monitoring framework for future text extraction
- [x] **T-6:** Extend CLI interface to support all three new tools with proper parameter handling
- [x] **T-7:** Add comprehensive error handling for API failures and rate limiting
- [x] **T-8:** Update documentation in README with usage examples for all new tools
- [x] **T-9:** Explorative testing by the user by running the server via `npx @srbhptl39/mcp-superassistant-proxy@latest --config ./mcpconfig.json`

### Definition of Done
- [x] All acceptance criteria met
- [x] Unit tests pass (>90% coverage) for all new tools and driver extensions
- [x] Integration tests pass for all tools via both MCP and CLI interfaces
- [x] Rate limiting works correctly for all tools
- [x] Response schemas are consistent and properly validated
- [x] Code follows TypeScript/ESM standards with proper error handling
- [x] Documentation in README updated with examples and usage instructions

## Technical Design

### Architecture Components
- **Enhanced Drivers**: Extended arXiv and OpenAlex drivers with new query methods
- **MCP Tools**: Three new tool implementations with Zod validation
- **Response Framework**: Foundation for future payload size monitoring
- **CLI Extensions**: Command-line access to all new tools

### Data Models
```typescript
interface PaperMetadata {
  id: string;
  title: string;
  authors: string[];
  date: string;      // ISO format
  pdf_url?: string;
  // text field will be added in Story 3
}

interface FetchLatestRequest {
  source: 'arxiv' | 'openalex';
  category: string;
  count: number;     // default 50
}

interface FetchTopCitedRequest {
  concept: string;
  since: string;     // ISO date format
  count: number;     // default 50
}

interface FetchContentRequest {
  source: 'arxiv' | 'openalex';
  id: string;
}
```

### API Design
- **MCP Tool**: `fetch_latest({ source, category, count })`
- **MCP Tool**: `fetch_top_cited({ concept, since, count })`
- **MCP Tool**: `fetch_content({ source, id })`
- **CLI Commands**: 
  - `npx latest-science-mcp fetch-latest --source=arxiv --category=cs.AI --count=10`
  - `npx latest-science-mcp fetch-top-cited --concept="artificial intelligence" --since=2024-01-01 --count=20`
  - `npx latest-science-mcp fetch-content --source=arxiv --id=2401.12345`

### Query Implementation
1. **arXiv fetch_latest**: Use arXiv API search endpoint with category filter and date sorting
2. **OpenAlex fetch_latest**: Use OpenAlex works endpoint with concept filter and publication_date sorting
3. **OpenAlex fetch_top_cited**: Use OpenAlex works endpoint with concept filter and cited_by_count sorting
4. **fetch_content**: Direct lookup by ID for both sources returning full metadata

## Test Plan

### Unit Tests
- arXiv driver fetch_latest with mocked API responses
- OpenAlex driver fetch_latest and fetch_top_cited with mocked responses
- fetch_content tool with both sources
- MCP tool parameter validation with Zod schemas
- Error handling for API failures and rate limiting

### Integration Tests
- CLI commands for all three tools return valid JSON
- MCP server responds correctly to all tool calls via stdio
- Rate limiting prevents excessive API calls during bulk operations
- End-to-end pipeline from MCP call to formatted metadata response

## Dependencies

### Internal Dependencies
- Story 1 foundation (MCP server, rate limiter, base drivers)
- Existing driver architecture and interfaces
- Rate limiting service

### External Dependencies
- arXiv API for search and individual paper lookup
- OpenAlex API for works search with concept and citation filtering
- Existing dependencies: axios, zod, winston

## Chat Log

**2025-01-XX**: Story 2 updated to focus specifically on metadata-only paper fetching tools. This provides a solid foundation for the three core tools (fetch_latest, fetch_top_cited, fetch_content) without the complexity of text extraction.

**Key Technical Decisions:**
- Implement all three tools but return metadata only (no text extraction yet)
- Build response size monitoring framework for future text integration
- Focus on robust API integration and error handling
- Ensure comprehensive CLI and MCP interfaces
- Prepare architecture for Story 3 text extraction integration

**Scope Reduction Benefits:**
- Delivers working tools immediately with clear value
- Reduces implementation risk by isolating text extraction complexity
- Allows thorough testing of tool interfaces before adding text processing
- Enables user feedback on core functionality before text features

**2025-05-23**: Story 2 implementation completed successfully. All acceptance criteria met:

**✅ Implementation Completed:**
- Extended BaseDriver with fetchLatest and fetchContent abstract methods
- Implemented ArxivDriver with XML parsing for arXiv API responses
- Implemented OpenAlexDriver with JSON parsing and concept filtering
- Created three new MCP tools: fetch_latest, fetch_top_cited, fetch_content
- Extended MCP server with proper Zod validation for all new tools
- Extended CLI with comprehensive command support and help text
- Updated README with complete documentation and examples

**✅ Testing Completed:**
- All CLI commands tested successfully:
  - `fetch-latest` works for both arXiv (cs.AI) and OpenAlex (concept IDs)
  - `fetch-top-cited` works with OpenAlex concept filtering and date ranges
  - `fetch-content` works for individual paper lookup by ID
- MCP server tested with proxy - all tools register and validate correctly
- Rate limiting implemented and working (5 req/min arXiv, 10 req/min OpenAlex)
- Error handling tested with invalid inputs (proper Zod validation errors)
- Exploratory testing completed with mcp-superassistant-proxy

**✅ Key Features Delivered:**
- Metadata-only paper fetching (id, title, authors, date, pdf_url)
- Robust API integration with both arXiv and OpenAlex
- Comprehensive error handling and input validation
- Rate limiting with proper retry-after messaging
- Dual interface (MCP + CLI) with consistent functionality
- Foundation ready for Story 3 text extraction integration

**Technical Notes:**
- OpenAlex works best with concept IDs (e.g., C41008148) rather than concept names
- arXiv XML parsing implemented with regex for MVP (can be enhanced with xml2js later)
- Response size monitoring framework in place for future text extraction
- All tools respect API rate limits and provide clear error messages

---
**Created:** 2025-01-XX
**Last Updated:** 2025-05-23
**Completed:** 2025-05-23 