# NPX Execution Issue Resolution

## Problem Statement

The MCP server package failed to initialize properly when executed via `npx` in AI tools like Claude Desktop. The server would show CLI help output instead of starting in MCP server mode.

## Root Cause Analysis

### Issue
The package had **dual functionality** (CLI + MCP server) but **no detection logic** to determine execution mode:

```typescript
// BEFORE: Always ran CLI logic
runCLI(); // Auto-executed regardless of context
```

### Symptoms
- `npx @futurelab-studio/latest-science-mcp` → CLI help output
- Expected: MCP server waiting for JSON-RPC input
- Actual: Process exit after showing usage instructions

### Technical Root Cause
1. **Single Entry Point**: Both CLI and MCP server used same `dist/server.js` binary
2. **No Context Detection**: No logic to differentiate between:
   - CLI usage: `npx package-name command --options`
   - MCP usage: `npx package-name` (no arguments, expects stdin/stdout)

## Solution Implemented

### 1. Smart Mode Detection
Added execution context detection in `src/server.ts`:

```typescript
// Detect execution mode based on command line arguments
const args = process.argv.slice(2);
const shouldRunCLI = args.length > 0;

if (shouldRunCLI) {
  // CLI mode: arguments provided
  import('./cli.js').then(cliModule => cliModule.runCLI());
} else {
  // MCP server mode: no arguments (AI tool usage)
  startMCPServer();
}
```

### 2. CLI Module Refactoring
Modified `src/cli.ts`:

```typescript
// BEFORE: Auto-execution
runCLI(); 

// AFTER: Conditional execution
export { runCLI }; // Export for conditional execution
```

### 3. Enhanced Build Configuration
Updated `package.json`:
- Ensured executable permissions: `"build": "tsc && chmod +x dist/server.js"`
- Lowered Node.js requirement: `>=18.0.0` for broader compatibility

## Verification Results

### Local Testing ✅
- **CLI Mode**: `node dist/server.js --help` → Shows CLI interface
- **MCP Mode**: `echo '{"jsonrpc":"2.0",...}' | node dist/server.js` → Starts MCP server

### NPX Testing ✅
- **CLI Usage**: `npx package-name list-categories --source=arxiv` → CLI execution
- **MCP Usage**: `npx package-name` → MCP server mode for AI tools

## Technical Impact

### Before Fix
```bash
$ npx @futurelab-studio/latest-science-mcp
Usage: latest-science-mcp <command> [options]... # Wrong!
```

### After Fix
```bash
$ npx @futurelab-studio/latest-science-mcp
# Waits for JSON-RPC input (correct MCP server behavior)

$ npx @futurelab-studio/latest-science-mcp --help  
Usage: latest-science-mcp <command> [options]... # Correct CLI behavior
```

## Key Learnings

1. **Dual-Purpose Binaries**: Need explicit context detection logic
2. **AI Tool Integration**: AI tools expect MCP servers to start without arguments
3. **NPX Behavior**: Arguments determine execution context for hybrid packages
4. **Testing Strategy**: Must test both execution modes independently

## Published Resolution

- **Fixed Version**: `0.1.20`
- **Status**: Production ready for AI tool integration
- **Configuration**: Works with standard MCP client configurations 