# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build and Development
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run dev` - Start TypeScript compiler in watch mode
- `npm start` - Run the built MCP server
- `npm run cli` - Run the CLI interface

### Testing and Quality
- `npm test` - Run tests with vitest
- `npm run test:run` - Run tests once (non-watch mode)
- `npm run lint` - Lint TypeScript files with ESLint
- `npm run format` - Format code with Prettier

### CLI Testing Commands
```bash
# Test category listing
node dist/cli.js list-categories --source=arxiv
node dist/cli.js list-categories --source=openalex

# Test paper fetching
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=3
node dist/cli.js fetch-top-cited --concept="machine learning" --since=2024-01-01 --count=5
node dist/cli.js fetch-content --source=arxiv --id=2401.12345
```

### MCP Server Testing
- `node test-mcp.js` - Test MCP server functionality
- `node debug-mcp.js` - Debug MCP server with enhanced logging

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that provides LLMs with access to scientific papers from arXiv and OpenAlex APIs. The codebase follows a **dual-interface pattern**: the same core logic powers both MCP server mode (for AI tools) and CLI mode (for humans).

### Core Architecture Patterns

**Driver Pattern**: `src/drivers/` - Source-specific implementations
- `BaseDriver` - Abstract base class defining common interface
- `ArxivDriver` - Handles arXiv API interactions and paper fetching
- `OpenAlexDriver` - Handles OpenAlex API interactions and concept searches

**Extractor Pattern**: `src/extractors/` - Text extraction pipeline
- `BaseExtractor` - Common extraction interface with size limits (6MB)
- `HtmlExtractor` - HTML parsing and cleaning using cheerio
- `TextCleaner` - Whitespace normalization and content cleaning

**Tool Pattern**: `src/tools/` - MCP tool implementations
- Each tool handles one MCP function (list_categories, fetch_latest, etc.)
- Tools coordinate between drivers, extractors, and rate limiting
- Consistent error handling and response formatting

### Key Services

**Rate Limiting**: `src/core/rate-limiter.ts`
- Token bucket algorithm per data source
- arXiv: 5 req/min, OpenAlex: 10 req/min
- Shared instance across all tools

**Logging**: `src/core/logger.ts`
- Winston-based structured logging
- Error, warn, info levels with contextual data

**Server Bootstrap**: `src/server.ts`
- Detects CLI vs MCP mode based on command line arguments
- Single entry point for both interfaces
- MCP protocol setup with stdio transport

### Data Flow

1. **MCP Client** → **server.ts** → **tools/** → **drivers/** → **external APIs**
2. **Text Extraction**: **drivers/** → **extractors/** → **cleaned text**
3. **Rate Limiting**: All API calls go through **rate-limiter.ts**
4. **Response**: Structured JSON with metadata + full text content

### Important Implementation Details

**Flexible ID Handling**: The `fetch_content` tool accepts both string and numeric IDs, auto-normalizing OpenAlex Work IDs (e.g., `2741809807` → `"W2741809807"`)

**Text Size Management**: 
- 6MB limit per paper to fit within 8MB MCP response limits
- Automatic truncation at word boundaries with `textTruncated` flag
- Graceful degradation: always returns metadata even if text extraction fails

**Dual Source Strategy**:
- arXiv: Fast metadata + HTML text extraction from arxiv.org with ar5iv.labs fallback
- OpenAlex: Rich citation data + selective HTML extraction from publisher sources

**Error Resilience**: Each component includes comprehensive error handling with specific error messages and retry guidance

## Configuration Files

- `tsconfig.json` - TypeScript configuration with ESM modules
- `mcpconfig.json` - MCP server testing configuration
- `debug-config.json` - Debug logging configuration

## Testing Strategy

The project uses **vitest** for unit testing. When writing tests:
- Test both successful and error cases for drivers
- Mock external API calls using nock
- Verify rate limiting behavior
- Test text extraction with sample HTML content

## MCP Protocol Integration

When debugging MCP integration issues:
- Check `stdio` transport setup in server.ts:225-235
- Verify tool schemas match MCP client expectations
- Use `logInfo`/`logError` for server-side debugging
- Test with `npx @srbhptl39/mcp-superassistant-proxy@latest --config ./mcpconfig.json`