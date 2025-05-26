# Story-1: MCP Server Foundation with Category Listing

**Epic:** Scientific Paper Harvester MCP Server MVP
**Status:** Approved
**Assignee:** Developer
**Sprint:** 1
**Estimated Effort:** Medium

## User Story

As a developer or researcher, I want to run an MCP server that can list available categories from both arXiv and OpenAlex sources so that I can understand what scientific paper categories are available for querying and start using the system immediately.

## Acceptance Criteria

- [x] **AC-1:** MCP server starts successfully using Node.js 20 LTS with ESM modules
- [x] **AC-2:** `list_categories` tool works for arXiv source and returns valid category codes (e.g., cs.AI, physics.gen-ph)
- [x] **AC-3:** `list_categories` tool works for OpenAlex source and returns valid concept IDs
- [x] **AC-4:** CLI interface provides the same `list_categories` functionality for offline testing
- [x] **AC-5:** Server responds to MCP protocol calls via stdio transport
- [x] **AC-6:** Rate limiting is implemented per source to respect API limits (5 req/s max)

## Technical Requirements

### Prerequisites
- Node.js 20 LTS installed
- Basic MCP SDK understanding
- TypeScript and ESM module support

### Implementation Tasks
- [x] **T-1:** Set up project structure with TypeScript, ESM, and MCP SDK dependencies
- [x] **T-2:** Create base driver interface and arXiv driver for category listing
- [x] **T-3:** Create OpenAlex driver for concept/category listing
- [x] **T-4:** Implement rate limiter service with per-source token bucket
- [x] **T-5:** Build MCP server with `list_categories` tool using Zod validation
- [x] **T-6:** Create CLI wrapper that calls the same underlying functions
- [x] **T-7:** Add structured logging with Winston

### Definition of Done
- [x] All acceptance criteria met
- [x] Unit tests pass (>90% coverage)
- [x] Integration tests pass for both MCP and CLI interfaces
- [x] Code follows TypeScript/ESM standards
- [x] Rate limiting respects API constraints
- [x] Provide the user with exact instructions how to run the server for exploratory testing

## Technical Design

### Architecture Components
- **MCP Server**: Main entry point with stdio transport
- **Base Driver**: Abstract interface for data source drivers  
- **arXiv Driver**: Fetches categories from arXiv taxonomy
- **OpenAlex Driver**: Fetches concepts from OpenAlex API
- **Rate Limiter**: Token bucket implementation per source
- **CLI Interface**: Command-line wrapper for offline testing

### Data Models
```typescript
interface CategoryList {
  source: 'arxiv' | 'openalex';
  categories: Category[];
}

interface Category {
  id: string;           // e.g., "cs.AI" or concept ID
  name: string;         // Human readable name
  description?: string; // Optional description
}

interface RateLimiterState {
  [source: string]: {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number;
  }
}
```

### API Design
- **MCP Tool**: `list_categories({ source: "arxiv" | "openalex" })`
- **CLI Command**: `npx latest-science-mcp list-categories --source=arxiv`
- **Response**: JSON array of category objects

## Test Plan

### Unit Tests
- Rate limiter token bucket behavior with time simulation
- arXiv driver category parsing from API response
- OpenAlex driver concept listing and mapping
- MCP tool parameter validation with Zod schemas

### Integration Tests
- CLI command execution returns valid JSON
- MCP server responds correctly to stdio tool calls
- Rate limiting prevents excessive API calls during concurrent requests

## Dependencies

### Internal Dependencies
- Project structure and build configuration
- TypeScript compilation setup
- ESM module resolution

### External Dependencies
- arXiv API (public, no authentication)
- OpenAlex API (public, no authentication)
- @modelcontextprotocol/sdk for MCP protocol
- Zod for runtime validation
- Winston for logging
- Axios for HTTP requests

## Chat Log

**2025-01-XX**: Story created focusing on foundational MCP server setup with category listing as the first user-facing value. Decided to start with `list_categories` as it provides immediate utility and doesn't require complex text extraction pipeline.

**2025-01-XX**: Implementation completed successfully. All acceptance criteria met:
- ✅ MCP server running with Node.js 20 LTS + ESM
- ✅ arXiv categories working (8 predefined categories including cs.AI, cs.LG, cs.CL, etc.)
- ✅ OpenAlex concepts working (19 top-level concepts fetched from API)
- ✅ CLI interface functional for both sources
- ✅ MCP protocol responding correctly via stdio transport
- ✅ Rate limiting implemented with token bucket per source
- ✅ Full TypeScript implementation with proper error handling
- ✅ README with usage instructions provided

**Key Technical Decisions:**
- Used predefined arXiv categories to avoid unnecessary API calls for static data
- Implemented OpenAlex concept fetching with proper error handling and rate limiting
- Fixed MCP SDK usage to use Zod schemas as second parameter (not inputSchema object)
- Added comprehensive logging and error handling throughout

**Testing Results:**
- CLI tests: ✅ Both arXiv and OpenAlex sources working
- MCP tests: ✅ Server responds correctly to protocol calls
- Rate limiting: ✅ Token bucket implementation working
- Error handling: ✅ Proper validation and error responses

---
**Created:** 2025-01-XX
**Last Updated:** 2025-01-XX
**Completed:** 2025-01-XX 