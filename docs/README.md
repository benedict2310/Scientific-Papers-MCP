# SciHarvester MCP Server Documentation

This directory contains documentation for developing and troubleshooting the SciHarvester MCP (Model Context Protocol) server.

## Documentation Index

### [MCP Parameter Handling Guide](./mcp-parameter-handling.md)
**Critical Read** - Detailed documentation about the most common MCP server development issue: incorrect parameter handling in tool functions.

**Key Topics:**
- Root cause of parameter access issues
- Correct implementation patterns using `server.tool()`
- Best practices for Zod schema validation
- Common mistakes to avoid
- Testing and debugging approaches

### [Token Efficiency Optimization](./token-efficiency-optimization.md)
**Architecture Guide** - Comprehensive documentation of the critical optimization that separates metadata browsing from full text extraction.

**Key Topics:**
- Problem analysis: 90% token waste in original design
- Solution implementation: metadata-first approach
- Technical details: code changes and interface design
- Performance impact: 99.7% token savings for browse operations
- User experience improvements and best practices

### [Troubleshooting Guide](./troubleshooting.md)
Comprehensive guide for diagnosing and fixing common MCP server issues.

**Covers:**
- Parameter handling problems
- Server startup issues
- Import/export problems
- Rate limiting challenges
- Text extraction failures
- Memory and performance issues
- Debugging workflow and tools

## Quick Reference

### Correct Tool Definition Pattern
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "SciHarvester", version: "0.1.0" });

server.tool("tool_name", 
  {
    param1: z.string().describe("Parameter description for LLMs"),
    param2: z.number().min(1).max(100).default(50)
  },
  async ({ param1, param2 }) => {
    // Parameters are available directly here
    return {
      content: [{ type: "text", text: "Result" }]
    };
  }
);
```

### Essential Testing Commands
```bash
# Build the project
npm run build

# Test tool listing
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/server.js

# Test tool execution
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_categories", "arguments": {"source": "arxiv"}}}' | node dist/server.js
```

### Common Errors and Quick Fixes

| Error | Quick Fix |
|-------|-----------|
| Parameters are `undefined` | Use `server.tool()` with Zod schemas and parameter destructuring |
| Import errors | Add `.js` extensions to all relative imports |
| Build fails | Check TypeScript configuration and dependencies |
| Rate limiting issues | Implement proper rate limiting with delays |
| Memory issues | Add size limits and proper cleanup |

## Development Workflow

1. **Start with the basics**: Use the correct `server.tool()` pattern
2. **Add validation**: Use Zod schemas for all parameters
3. **Implement error handling**: Wrap all tool logic in try-catch blocks
4. **Test incrementally**: Test each tool individually before integration
5. **Add logging**: Use structured logging for debugging
6. **Document changes**: Update documentation as you add features

## Architecture Overview

The SciHarvester MCP server consists of:

- **Server (`src/server.ts`)**: Main MCP server with tool definitions
- **Tools (`src/tools/`)**: Individual tool implementations
- **Drivers (`src/drivers/`)**: API integrations for arXiv and OpenAlex
- **Extractors (`src/extractors/`)**: Text extraction pipeline
- **Core (`src/core/`)**: Shared utilities (rate limiting, logging)

## Best Practices

### 1. Parameter Handling
- Always use `server.tool()` with Zod schemas
- Provide clear parameter descriptions for LLM understanding
- Implement proper validation and error messages

### 2. Error Handling
- Wrap all tool logic in try-catch blocks
- Return structured error responses
- Log errors with context for debugging

### 3. Performance
- Implement rate limiting for external APIs
- Add timeouts to prevent hanging requests
- Use appropriate memory limits for text processing

### 4. Testing
- Test each tool individually
- Use the provided test commands
- Test error conditions and edge cases

## Contributing

When adding new features or fixing issues:

1. Update relevant documentation
2. Add appropriate error handling
3. Include test cases
4. Follow the established patterns
5. Update this documentation index if needed

## Getting Help

If you encounter issues not covered in this documentation:

1. Check the [Troubleshooting Guide](./troubleshooting.md) first
2. Review the [Parameter Handling Guide](./mcp-parameter-handling.md) for common issues
3. Use the debugging commands provided in the guides
4. Include version information and error details when seeking help

## Version Compatibility

This documentation is written for:
- MCP SDK: `^1.12.0`
- Node.js: `>=18.0.0`
- TypeScript: `^5.0.0`

Check your versions if encountering compatibility issues:
```bash
node --version
npm list @modelcontextprotocol/sdk
npx tsc --version
``` 