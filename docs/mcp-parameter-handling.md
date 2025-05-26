# MCP Server Parameter Handling: Common Issues and Solutions

## Overview

This document outlines a critical issue encountered during MCP server development where tool parameters were not being passed correctly to tool handler functions, along with the solution and best practices.

## The Problem

### Symptoms
- MCP server builds successfully
- Tools are listed correctly via `tools/list`
- Tool calls fail with `undefined` parameters
- Parameters appear correct in client requests but are `undefined` in server handlers

### Example Error
```bash
# Client sends this correctly:
{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_categories", "arguments": {"source": "arxiv"}}}

# But server receives undefined:
DEBUG - Full params object: {"signal": {}, "requestId": "..."}
# No arguments property available
```

## Root Cause

The issue was caused by **incorrect parameter access patterns** in MCP tool handlers. We were trying to access parameters using the wrong object structure.

### What We Tried (Incorrectly)

1. **Manual JSON Schema with setRequestHandler**:
```typescript
// ❌ WRONG - This is not the correct MCP SDK pattern
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { arguments: args } = request.params;
  const source = args.source; // This would work but is overly complex
});
```

2. **Accessing params.arguments**:
```typescript
// ❌ WRONG - arguments property doesn't exist
async (params) => {
  const source = params.arguments?.source; // undefined
}
```

3. **Direct params access without understanding the SDK**:
```typescript
// ❌ WRONG - params structure misunderstood
async (params) => {
  const source = params.source; // undefined
}
```

## The Solution

### Correct Implementation using server.tool()

The MCP SDK provides a high-level `server.tool()` method that handles parameter validation and extraction automatically:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Your Server",
  version: "1.0.0",
});

// ✅ CORRECT - Use server.tool() with Zod schemas
server.tool("list_categories", 
  {
    source: z.enum(["arxiv", "openalex"]).describe("The data source to fetch categories from")
  },
  async ({ source }) => {  // Parameters are destructured directly here
    try {
      // source is now properly typed and available
      const result = await listCategories({ source });
      
      return {
        content: [
          {
            type: "text",
            text: `Found categories from ${source}`
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
```

### Key Points of the Correct Solution

1. **Use `server.tool()`**: This is the preferred high-level API
2. **Zod schemas for validation**: Define parameters using Zod schemas with descriptions
3. **Direct parameter destructuring**: Parameters are available directly in the handler function
4. **Automatic validation**: The SDK handles parameter validation automatically
5. **Type safety**: Zod provides compile-time and runtime type checking

## Best Practices

### 1. Tool Definition Structure
```typescript
server.tool(
  "tool_name",                    // Tool name (kebab-case recommended)
  {                              // Parameter schema (Zod object)
    param1: z.string().describe("Description for LLMs"),
    param2: z.number().min(1).max(100).default(50),
    param3: z.enum(["option1", "option2"])
  },
  async ({ param1, param2, param3 }) => {  // Handler with destructured params
    // Implementation
  }
);
```

### 2. Parameter Validation
```typescript
// ✅ Use Zod for validation and descriptions
{
  source: z.enum(["arxiv", "openalex"]).describe("Valid sources are: 'arxiv', 'openalex'"),
  count: z.number().min(1).max(200).default(50).describe("Number of items (1-200)"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format")
}
```

### 3. Error Handling
```typescript
async ({ param1, param2 }) => {
  try {
    const result = await yourFunction({ param1, param2 });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}
```

### 4. Helpful Error Messages
```typescript
// ✅ Provide clear error messages with valid options
z.enum(["arxiv", "openalex"]).describe("Valid sources are: 'arxiv', 'openalex'. Received: '{value}'")
```

## Testing Your Implementation

### 1. Build Test
```bash
npm run build
```

### 2. Tool Listing Test
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/server.js
```

### 3. Tool Call Test
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "your_tool", "arguments": {"param": "value"}}}' | node dist/server.js
```

## Debugging Tips

### 1. Add Debug Logging
```typescript
async ({ source, category }) => {
  console.error('DEBUG - Received parameters:', { source, category });
  // ... rest of implementation
}
```

### 2. Check MCP SDK Version
Ensure you're using a compatible version:
```json
{
  "@modelcontextprotocol/sdk": "^1.12.0"
}
```

### 3. Verify Parameter Access
If parameters are undefined, check:
- Are you using `server.tool()` method?
- Is parameter destructuring correct?
- Are Zod schemas properly defined?

## Common Mistakes to Avoid

1. **Don't use manual JSON Schema with setRequestHandler** for simple tools
2. **Don't access params.arguments** - parameters are available directly
3. **Don't forget error handling** - always wrap tool logic in try-catch
4. **Don't skip parameter validation** - use Zod schemas for type safety
5. **Don't forget descriptions** - they help LLMs understand how to use tools

## SDK API Reference

### High-Level API (Recommended)
```typescript
server.tool(name, schema, handler)
```

### Low-Level API (Advanced use cases)
```typescript
server.setRequestHandler(RequestSchema, handler)
```

For most use cases, stick with the high-level `server.tool()` API as demonstrated in this document.

## Related Documentation

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Tools Documentation](https://modelcontextprotocol.io/docs/concepts/tools)
- [Zod Documentation](https://zod.dev/)

## Conclusion

The key to successful MCP server development is understanding the SDK's parameter handling mechanism. Use the high-level `server.tool()` API with Zod schemas for the best developer experience and automatic parameter validation. 