# MCP Server Troubleshooting Guide

## Common Issues and Solutions

### 1. Parameters are `undefined` in Tool Handlers

**Symptoms:**
- Tool calls return errors about missing parameters
- Parameters show as `undefined` in debug logs
- Client sends correct parameters but server doesn't receive them

**Solution:**
See [MCP Parameter Handling Guide](./mcp-parameter-handling.md) for detailed solution.

**Quick Fix:**
```typescript
// ✅ Use this pattern
server.tool("tool_name", 
  { param: z.string() },
  async ({ param }) => { /* param is available here */ }
);

// ❌ Not this
async (params) => {
  const param = params.arguments?.param; // undefined
}
```

### 2. Build Succeeds but Server Doesn't Start

**Symptoms:**
- `npm run build` completes successfully
- Server process starts but doesn't respond to requests
- No error messages in logs

**Debugging Steps:**

1. **Check for TypeScript compilation errors:**
```bash
npm run build 2>&1 | grep -i error
```

2. **Test basic server connectivity:**
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test"}}}' | node dist/server.js
```

3. **Verify tool listing:**
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/server.js
```

### 3. Import/Export Issues

**Symptoms:**
- `Cannot find module` errors
- `TypeError: X is not a function` errors
- Build fails with module resolution errors

**Common Causes & Solutions:**

1. **Missing `.js` extensions in imports:**
```typescript
// ✅ Correct
import { listCategories } from "./tools/list-categories.js";

// ❌ Wrong
import { listCategories } from "./tools/list-categories";
```

2. **Incorrect module exports:**
```typescript
// ✅ In tool files - use named exports
export async function listCategories() { /* ... */ }

// ✅ In server.ts - use named imports
import { listCategories } from "./tools/list-categories.js";
```

3. **Check tsconfig.json module settings:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node"
  }
}
```

### 4. Rate Limiting Issues

**Symptoms:**
- 429 errors from APIs
- Slow or failed requests
- API quota exceeded messages

**Solutions:**

1. **Implement proper rate limiting:**
```typescript
import { RateLimiter } from "./core/rate-limiter.js";

const rateLimiter = new RateLimiter();
// Use rateLimiter in API calls
```

2. **Add delays between requests:**
```typescript
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
```

3. **Implement retry logic:**
```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 5. Text Extraction Failures

**Symptoms:**
- Papers returned without text content
- Text extraction timeout errors
- HTML parsing errors

**Debugging:**

1. **Check network connectivity:**
```bash
curl -I "https://arxiv.org/abs/2401.12345"
```

2. **Verify HTML extractor configuration:**
```typescript
// Check constants.ts
export const TEXT_EXTRACTION = {
  MAX_SIZE_BYTES: 6 * 1024 * 1024, // 6MB
  TIMEOUT_MS: 30000, // 30 seconds
  // ...
};
```

3. **Test individual components:**
```typescript
import { HtmlExtractor } from "./extractors/html-extractor.js";

const extractor = new HtmlExtractor();
const result = await extractor.extractText("https://example.com");
console.log(result);
```

### 6. Logging Issues

**Symptoms:**
- No log output
- Logs not formatted correctly
- Missing log information

**Solutions:**

1. **Verify logger setup:**
```typescript
import { logInfo, logError } from "./core/logger.js";

// Ensure logger is properly configured
logInfo('Server starting', { version: '1.0.0' });
```

2. **Check log levels:**
```bash
# Set environment variable for debug logging
LOG_LEVEL=debug node dist/server.js
```

3. **Add structured logging:**
```typescript
logInfo('Tool called', { 
  tool: 'fetch_latest', 
  source, 
  category, 
  count,
  timestamp: new Date().toISOString()
});
```

### 7. Memory Issues

**Symptoms:**
- Server crashes with out-of-memory errors
- Slow performance with large texts
- High memory usage

**Solutions:**

1. **Implement text size limits:**
```typescript
const MAX_TEXT_SIZE = 6 * 1024 * 1024; // 6MB
if (text.length > MAX_TEXT_SIZE) {
  text = text.substring(0, MAX_TEXT_SIZE);
  metadata.textTruncated = true;
}
```

2. **Stream large content:**
```typescript
// Instead of loading entire content into memory
const stream = response.body;
// Process chunks
```

3. **Garbage collection hints:**
```typescript
// After processing large objects
largeObject = null;
if (global.gc) global.gc();
```

## Debugging Workflow

### Step 1: Verify Basic Functionality
```bash
# 1. Build
npm run build

# 2. Test server starts
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test"}}}' | timeout 5 node dist/server.js

# 3. List tools
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | timeout 5 node dist/server.js
```

### Step 2: Test Individual Tools
```bash
# Test each tool with minimal parameters
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "list_categories", "arguments": {"source": "arxiv"}}}' | timeout 10 node dist/server.js
```

### Step 3: Enable Debug Logging
```typescript
// Add debug logging to tool handlers
async ({ source }) => {
  console.error('DEBUG:', { source, timestamp: new Date().toISOString() });
  // ... rest of implementation
}
```

### Step 4: Isolate the Problem
- Test individual functions outside of MCP context
- Use unit tests for core functionality
- Test with minimal data sets first

## Getting Help

### Include This Information:
1. **MCP SDK version:** Check `package.json`
2. **Node.js version:** `node --version`
3. **Error messages:** Full stack traces
4. **Test commands:** What commands reproduce the issue
5. **Environment:** OS, shell, any special setup

### Useful Commands for Diagnostics:
```bash
# Check versions
node --version
npm list @modelcontextprotocol/sdk

# Test JSON-RPC communication
echo '{"jsonrpc": "2.0", "id": 1, "method": "ping"}' | node dist/server.js

# Verbose logging
LOG_LEVEL=debug node dist/server.js

# Memory usage
node --max-old-space-size=4096 dist/server.js
```

## Prevention

### 1. Use TypeScript Strictly
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 2. Implement Comprehensive Error Handling
```typescript
try {
  // Tool implementation
} catch (error) {
  logError('Tool error', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  
  return {
    isError: true,
    content: [{ type: "text", text: "Internal error occurred" }]
  };
}
```

### 3. Add Input Validation
```typescript
// Use Zod for comprehensive validation
const schema = z.object({
  source: z.enum(["arxiv", "openalex"]),
  count: z.number().min(1).max(200).default(50)
});
```

### 4. Test Early and Often
```bash
# Run tests after each change
npm run build && npm test
```

Remember: When in doubt, start with the simplest possible implementation and gradually add complexity. 