# Scientific Paper Harvester MCP Server

A Model Context Protocol (MCP) server that provides LLMs with real-time access to scientific papers from arXiv and OpenAlex.

## Features

- **Paper Fetching**: Get latest papers from arXiv and OpenAlex by category/concept
- **Text Extraction**: Full text content extraction from HTML sources (arXiv and OpenAlex)
- **Citation Analysis**: Find top cited papers from OpenAlex since a specific date
- **Paper Lookup**: Retrieve full metadata for specific papers by ID
- **Category Listing**: Browse available categories from arXiv and OpenAlex
- **Rate Limiting**: Respectful API usage with per-source rate limiting (5 req/min arXiv, 10 req/min OpenAlex)
- **Dual Interface**: Both MCP protocol and CLI access
- **TypeScript**: Full type safety with ESM modules

## Installation

```bash
npm install
npm run build
```

## MCP Client Configuration

To use this server with an MCP client (like Claude Desktop), add the following to your MCP client configuration:

### For published package (available on npm):

**Option 1: Using npx (recommended for AI tools like Claude)**

```json
{
  "mcpServers": {
    "scientific-papers": {
      "command": "npx",
      "args": [
        "--yes",
        "@futurelab-studio/latest-science-mcp"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Option 2: Global installation**

```bash
npm install -g @futurelab-studio/latest-science-mcp
```

Then configure:

```json
{
  "mcpServers": {
    "scientific-papers": {
      "command": "latest-science-mcp"
    }
  }
}
```

**Option 3: For Windows/NVM users (if npx doesn't work)**

Find your global npm path:
```bash
npm root -g
```

Then use absolute paths:

```json
{
  "mcpServers": {
    "scientific-papers": {
      "command": "node",
      "args": [
        "C:/path/to/node_modules/@futurelab-studio/latest-science-mcp/dist/server.js"
      ]
    }
  }
}
```

### For local development:

```json
{
  "mcpServers": {
    "scientific-papers": {
      "command": "node",
      "args": [
        "dist/server.js"
      ],
      "cwd": "/path/to/your/MCP-tutorial"
    }
  }
}
```

**Note:** Replace `/path/to/your/MCP-tutorial` with the actual path to your project directory.

## Usage

### CLI Interface

#### List Categories
```bash
# List arXiv categories
node dist/cli.js list-categories --source=arxiv

# List OpenAlex concepts
node dist/cli.js list-categories --source=openalex
```

#### Fetch Latest Papers
```bash
# Get latest 10 AI papers from arXiv
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=10

# Get latest 5 computer science papers from OpenAlex
node dist/cli.js fetch-latest --source=openalex --category=C41008148 --count=5

# Search by concept name (OpenAlex)
node dist/cli.js fetch-latest --source=openalex --category="machine learning" --count=3
```

#### Fetch Top Cited Papers
```bash
# Get top 20 cited papers in machine learning since 2024
node dist/cli.js fetch-top-cited --concept="machine learning" --since=2024-01-01 --count=20

# Get top cited papers by concept ID
node dist/cli.js fetch-top-cited --concept=C41008148 --since=2023-06-01 --count=10
```

#### Fetch Specific Paper
```bash
# Get arXiv paper by ID
node dist/cli.js fetch-content --source=arxiv --id=2401.12345

# Get OpenAlex paper by Work ID
node dist/cli.js fetch-content --source=openalex --id=W2741809807

# Show text content with preview
node dist/cli.js fetch-content --source=arxiv --id=2401.12345 --show-text --text-preview=500

# Show full text content
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=2 --show-text
```

#### CLI Text Display Options
```bash
# Show text extraction status (default)
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=3

# Display full text content
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=2 --show-text

# Display text preview (first 500 characters)
node dist/cli.js fetch-content --source=arxiv --id=2401.12345 --show-text --text-preview=500
```

### MCP Server

Start the MCP server:
```bash
node dist/server.js
```

The server accepts MCP protocol calls via stdio transport.

## Available Tools

### `list_categories`

Lists available categories/concepts from a data source.

**Parameters:**
- `source`: `"arxiv"` or `"openalex"`

**Returns:**
- Array of category objects with `id`, `name`, and optional `description`

**Example:**
```json
{
  "name": "list_categories",
  "arguments": {
    "source": "arxiv"
  }
}
```

### `fetch_latest`

Fetches the latest papers from arXiv or OpenAlex for a given category with **metadata only** (no text extraction).

**Parameters:**
- `source`: `"arxiv"` or `"openalex"`
- `category`: Category ID (e.g., "cs.AI" for arXiv, "C41008148" for OpenAlex) or concept name
- `count`: Number of papers to fetch (default: 50, max: 200)

**Returns:**
- Array of paper objects with metadata (id, title, authors, date, pdf_url)
- **Text field**: Empty string (`text: ""`) - use `fetch_content` for full text

**Workflow:**
This tool is designed for browsing and discovery. Use it to find interesting papers, then call `fetch_content` for specific papers you want to read in full.

**Examples:**
```json
{
  "name": "fetch_latest",
  "arguments": {
    "source": "arxiv",
    "category": "cs.AI",
    "count": 10
  }
}
```

```json
{
  "name": "fetch_latest",
  "arguments": {
    "source": "openalex",
    "category": "artificial intelligence",
    "count": 5
  }
}
```

### `fetch_top_cited`

Fetches the top cited papers from OpenAlex for a given concept since a specific date with **metadata only** (no text extraction).

**Parameters:**
- `concept`: Concept name or OpenAlex concept ID (e.g., "machine learning", "C41008148")
- `since`: Start date in YYYY-MM-DD format
- `count`: Number of papers to fetch (default: 50, max: 200)

**Returns:**
- Array of paper objects sorted by citation count (descending) with metadata only
- **Text field**: Empty string (`text: ""`) - use `fetch_content` for full text

**Workflow:**
Use this to discover influential papers by citation count, then call `fetch_content` for papers you want to read.

**Example:**
```json
{
  "name": "fetch_top_cited",
  "arguments": {
    "concept": "machine learning",
    "since": "2024-01-01",
    "count": 20
  }
}
```

### `fetch_content`

Fetches full metadata and text content for a specific paper by ID from arXiv or OpenAlex with **complete text extraction**.

**Parameters:**
- `source`: `"arxiv"` or `"openalex"`
- `id`: Paper ID (arXiv ID like "2401.12345" or OpenAlex Work ID like "W2741809807")
  - **Flexible ID Format**: Accepts both strings and numbers
  - **Auto-normalization**: Numeric IDs are automatically converted to proper format (e.g., `2741809807` → `"W2741809807"` for OpenAlex)

**Returns:**
- Single paper object with full metadata and extracted text content

**Text Extraction:**
- **arXiv**: Extracts text from HTML version at `arxiv.org/html/{id}` with fallback to `ar5iv.labs.arxiv.org`
- **OpenAlex**: Extracts text from HTML sources when `source_type="html"` is available
- **Graceful degradation**: Returns metadata even if text extraction fails

**Examples:**
```json
{
  "name": "fetch_content",
  "arguments": {
    "source": "arxiv",
    "id": "2401.12345"
  }
}
```

```json
{
  "name": "fetch_content",
  "arguments": {
    "source": "openalex",
    "id": "W2741809807"
  }
}
```

```json
{
  "name": "fetch_content",
  "arguments": {
    "source": "openalex",
    "id": 2741809807
  }
}
```

## Paper Metadata Format

All tools return paper objects with the following structure:

```typescript
{
  id: string;                    // Paper ID
  title: string;                 // Paper title
  authors: string[];             // List of author names
  date: string;                  // Publication date (ISO format)
  pdf_url?: string;              // PDF URL (if available)
  text: string;                  // Extracted full text content
  textTruncated?: boolean;       // Warning: text was truncated due to size limits
  textExtractionFailed?: boolean; // Warning: text extraction failed
}
```

### Text Extraction Details

- **Text Content**: The `text` field contains the full extracted text from HTML sources
- **Size Limits**: Text is limited to 6MB to fit within 8MB response limits
- **Truncation**: When text exceeds limits, it's truncated at word boundaries with `textTruncated: true`
- **Extraction Failures**: When text extraction fails, `textExtractionFailed: true` is set and `text` is empty
- **Graceful Degradation**: Papers are always returned with metadata even if text extraction fails

## Development

### Build
```bash
npm run build
```

### Test
```bash
# Test CLI commands
node dist/cli.js list-categories --source=arxiv
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=3
node dist/cli.js fetch-top-cited --concept="artificial intelligence" --since=2024-01-01 --count=5
node dist/cli.js fetch-content --source=arxiv --id=2401.12345

# Test MCP server
node test-mcp.js
```

### Exploratory Testing

Test the MCP server with the proxy:
```bash
npx @srbhptl39/mcp-superassistant-proxy@latest --config ./mcpconfig.json
```

## Architecture

- **TypeScript + ESM**: Modern JavaScript with full type safety
- **Text Extraction Pipeline**: HTML parsing and cleaning using cheerio with fallback mechanisms
- **Rate Limiting**: Token bucket algorithm per data source (5 req/min arXiv, 10 req/min OpenAlex)
- **Modular Design**: Clean separation between drivers, extractors, tools, and core services
- **Error Handling**: Structured error responses with actionable suggestions
- **Graceful Degradation**: Always returns metadata even when text extraction fails
- **Response Size Management**: Automatic truncation and warnings for large content

## API Sources

- **arXiv**: Papers and categories from arXiv API
  - Search by category (e.g., cs.AI, physics.gen-ph)
  - Sorted by submission date (latest first)
  - Individual paper lookup by arXiv ID
  
- **OpenAlex**: Papers and concepts from OpenAlex API
  - Search by concept ID or name
  - Citation data and sorting by citation count
  - Individual paper lookup by Work ID
  - Rich metadata including author affiliations

## Text Extraction Sources

### arXiv Text Extraction
- **Primary Source**: `https://arxiv.org/html/{paper_id}` 
- **Fallback Source**: `https://ar5iv.labs.arxiv.org/html/{paper_id}` (when primary fails)
- **Content**: LaTeX-rendered HTML with mathematical formulas and structured content
- **Success Rate**: ~90% for papers with HTML versions available
- **Limitations**: Some older papers may not have HTML versions

### OpenAlex Text Extraction  
- **Source**: Papers with `primary_location.source_type == "html"`
- **Content**: Full-text HTML from publisher websites and repositories
- **Success Rate**: Varies by publisher and access policies
- **Limitations**: 
  - Only extracts from HTML sources (PDF extraction not included in MVP)
  - Depends on publisher providing HTML access
  - Some papers may be behind paywalls

### Text Processing
- **HTML Cleaning**: Removes navigation, headers, footers, and non-content elements
- **Text Normalization**: Standardizes whitespace, line breaks, and formatting
- **Content Extraction**: Focuses on main article content using academic paper selectors
- **Size Management**: Automatic truncation at 6MB with word boundary preservation

## Rate Limiting

The server implements respectful rate limiting:
- **arXiv**: 5 requests per minute (per arXiv guidelines)
- **OpenAlex**: 10 requests per minute (conservative limit)

Rate limits are enforced per source and shared across all tools.

## Error Handling

The server provides detailed error messages for common issues:
- Invalid paper IDs
- Rate limiting (with retry-after information)
- API timeouts and server errors
- Invalid date formats
- Missing required parameters

## Troubleshooting

### NPX Execution Issues in AI Tools

If the MCP server fails to start when using npx in AI tools like Claude:

1. **Use the recommended configuration** with `--yes` flag and `NODE_ENV`:
   ```json
   {
     "mcpServers": {
       "scientific-papers": {
         "command": "npx",
         "args": ["--yes", "@futurelab-studio/latest-science-mcp"],
         "env": { "NODE_ENV": "production" }
       }
     }
   }
   ```

2. **Alternative: Use absolute node path** (more reliable):
   ```json
   {
     "mcpServers": {
       "scientific-papers": {
         "command": "node",
         "args": ["-e", "import('@futurelab-studio/latest-science-mcp').then(m => m.default())"]
       }
     }
   }
   ```

3. **For persistent issues, use global installation**:
   ```bash
   npm install -g @futurelab-studio/latest-science-mcp
   ```
   Then configure:
   ```json
   {
     "mcpServers": {
       "scientific-papers": {
         "command": "latest-science-mcp"
       }
     }
   }
   ```

### Common Issues

- **"Command not found"**: Ensure npm/npx is in PATH
- **"Permission denied"**: Try global installation method
- **"Module not found"**: Clear npm cache with `npm cache clean --force`
- **Connection timeout**: Check network connectivity to npm registry

## License

MIT 