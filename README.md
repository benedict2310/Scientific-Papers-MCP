# Scientific Paper Harvester MCP Server

A comprehensive Model Context Protocol (MCP) server that provides LLMs with real-time access to scientific papers from **6 major academic sources**: arXiv, OpenAlex, PMC (PubMed Central), Europe PMC, bioRxiv/medRxiv, and CORE.

## 🚀 Features

### **Comprehensive Source Coverage**
- **arXiv**: Computer science, physics, mathematics preprints and papers
- **OpenAlex**: Open catalog of scholarly papers with citation data
- **PMC**: PubMed Central biomedical and life science literature
- **Europe PMC**: European life science literature database
- **bioRxiv/medRxiv**: Biology and medical preprint servers
- **CORE**: World's largest collection of open access research papers

### **Advanced Capabilities**
- **Paper Fetching**: Get latest papers from any source by category/concept
- **Full-Text Extraction**: Extract complete text content with intelligent fallback strategies
- **Citation Analysis**: Find top cited papers from OpenAlex since a specific date
- **Paper Lookup**: Retrieve full metadata for specific papers by ID
- **Category Discovery**: Browse available categories from all sources
- **Smart Rate Limiting**: Respectful API usage with per-source rate limiting
- **DOI Resolution**: Advanced DOI resolver with Unpaywall → Crossref → Semantic Scholar fallback
- **Dual Interface**: Both MCP protocol and CLI access
- **TypeScript**: Full type safety with ESM modules

## 📊 Coverage Statistics

- **Total Sources**: 6 academic databases
- **Category Coverage**: 100+ categories across all disciplines
- **Paper Access**: 200M+ papers with intelligent text extraction
- **Text Extraction Success**: >90% for supported paper types
- **Response Time**: <15 seconds average for paper fetching

## 🛠 Installation

```bash
npm install
npm run build
```

## 📋 MCP Client Configuration

To use this server with an MCP client (like Claude Desktop), add the following to your MCP client configuration:

### For published package (available on npm):

**Option 1: Using npx (recommended for AI tools like Claude)**

```json
{
  "mcpServers": {
    "scientific-papers": {
      "command": "npx",
      "args": [
        "-y",
        "@futurelab-studio/latest-science-mcp@latest"
      ]
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

## 📖 Usage

### CLI Interface

#### List Categories
```bash
# List arXiv categories
node dist/cli.js list-categories --source=arxiv

# List OpenAlex concepts
node dist/cli.js list-categories --source=openalex

# List PMC biomedical categories
node dist/cli.js list-categories --source=pmc

# List Europe PMC life science categories
node dist/cli.js list-categories --source=europepmc

# List bioRxiv/medRxiv categories (includes both servers)
node dist/cli.js list-categories --source=biorxiv

# List CORE academic categories
node dist/cli.js list-categories --source=core
```

#### Fetch Latest Papers
```bash
# Get latest AI papers from arXiv
node dist/cli.js fetch-latest --source=arxiv --category=cs.AI --count=10

# Get latest biology papers from bioRxiv
node dist/cli.js fetch-latest --source=biorxiv --category="biorxiv:biology" --count=5

# Get latest immunology papers from PMC
node dist/cli.js fetch-latest --source=pmc --category=immunology --count=3

# Get latest papers from CORE by subject
node dist/cli.js fetch-latest --source=core --category=computer_science --count=5

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

#### Fetch Specific Paper Content
```bash
# Get arXiv paper by ID
node dist/cli.js fetch-content --source=arxiv --id=2401.12345

# Get bioRxiv paper by DOI
node dist/cli.js fetch-content --source=biorxiv --id="10.1101/2021.01.01.425001"

# Get PMC paper by ID
node dist/cli.js fetch-content --source=pmc --id=PMC8245678

# Get CORE paper by ID
node dist/cli.js fetch-content --source=core --id=12345678

# Show text content with preview
node dist/cli.js fetch-content --source=arxiv --id=2401.12345 --show-text --text-preview=500
```

## 🔧 Available Tools

### `list_categories`

Lists available categories/concepts from any data source.

**Parameters:**
- `source`: `"arxiv"` | `"openalex"` | `"pmc"` | `"europepmc"` | `"biorxiv"` | `"core"`

**Returns:**
- Array of category objects with `id`, `name`, and optional `description`

**Examples:**
```json
{
  "name": "list_categories",
  "arguments": {
    "source": "biorxiv"
  }
}
```

### `fetch_latest`

Fetches the latest papers from any source for a given category with **metadata only** (no text extraction).

**Parameters:**
- `source`: `"arxiv"` | `"openalex"` | `"pmc"` | `"europepmc"` | `"biorxiv"` | `"core"`
- `category`: Category ID or concept name (varies by source)
- `count`: Number of papers to fetch (default: 50, max: 200)

**Category Examples by Source:**
- **arXiv**: `"cs.AI"`, `"physics.gen-ph"`, `"math.CO"`
- **OpenAlex**: `"artificial intelligence"`, `"machine learning"`, `"C41008148"`
- **PMC**: `"immunology"`, `"genetics"`, `"neuroscience"`
- **Europe PMC**: `"biology"`, `"medicine"`, `"cancer"`
- **bioRxiv/medRxiv**: `"biorxiv:neuroscience"`, `"medrxiv:psychiatry"`
- **CORE**: `"computer_science"`, `"mathematics"`, `"physics"`

**Returns:**
- Array of paper objects with metadata (id, title, authors, date, pdf_url)
- **Text field**: Empty string (`text: ""`) - use `fetch_content` for full text

### `fetch_top_cited`

Fetches the top cited papers from OpenAlex for a given concept since a specific date.

**Parameters:**
- `concept`: Concept name or OpenAlex concept ID
- `since`: Start date in YYYY-MM-DD format
- `count`: Number of papers to fetch (default: 50, max: 200)

### `fetch_content`

Fetches full metadata and text content for a specific paper by ID with **complete text extraction**.

**Parameters:**
- `source`: Any of the 6 supported sources
- `id`: Paper ID (format varies by source)

**ID Formats by Source:**
- **arXiv**: `"2401.12345"`, `"cs/0601001"`, `"1234.5678v2"`
- **OpenAlex**: `"W2741809807"` or numeric `2741809807`
- **PMC**: `"PMC8245678"` or `"12345678"`
- **Europe PMC**: `"PMC8245678"`, `"12345678"`, or DOI
- **bioRxiv/medRxiv**: `"10.1101/2021.01.01.425001"` or `"2021.01.01.425001"`
- **CORE**: Numeric ID like `"12345678"`

## 📄 Paper Metadata Format

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

## 🧠 Advanced Text Extraction

### Multi-Source Strategy
Each source has specialized text extraction approaches:

- **arXiv**: HTML from `arxiv.org/html` with `ar5iv.labs.arxiv.org` fallback
- **OpenAlex**: HTML sources with DOI resolver fallback chain
- **PMC**: E-utilities API with XML/HTML extraction
- **Europe PMC**: REST API with multiple URL strategies
- **bioRxiv/medRxiv**: Direct HTML extraction with abstract fallback
- **CORE**: PDF/HTML with source URL fallback

### DOI Resolution Chain
Advanced DOI resolver with multiple fallback strategies:
1. **Unpaywall** → Free full-text sources
2. **Crossref** → Publisher metadata and links
3. **Semantic Scholar Academic Graph** → Alternative access

### Performance & Reliability
- **Text Extraction Success**: >90% for HTML-available papers
- **Graceful Degradation**: Always returns metadata even if text extraction fails
- **Size Management**: 6MB text limit with intelligent truncation
- **Caching**: 24-hour LRU cache for DOI resolution

## 🔄 Rate Limiting

Respectful API usage with per-source rate limiting:
- **arXiv**: 5 requests per minute
- **OpenAlex**: 10 requests per minute
- **PMC**: 3 requests per second
- **Europe PMC**: 10 requests per minute
- **bioRxiv/medRxiv**: 5 requests per minute
- **CORE**: 10 requests per minute (public), higher with API key

### CORE API Configuration
For enhanced CORE access, set environment variable:
```bash
export CORE_API_KEY="your-api-key"
```

## 🧪 Testing

### Run Test Suite
```bash
# Run all tests
npm test

# Run integration tests
npm run test -- tests/integration

# Run end-to-end workflow tests
npm run test -- tests/e2e

# Run performance benchmarks
npm run test -- tests/integration/performance.test.ts
```

### Test Coverage
- **Integration Tests**: All 6 sources tested end-to-end
- **Performance Tests**: Response time and throughput benchmarks
- **Workflow Tests**: Real research scenarios across multiple sources
- **Unit Tests**: Core components and edge cases

## 🏗 Architecture

### **Modular Driver System**
- Clean separation between sources
- Consistent interface across all drivers
- Specialized text extraction per source

### **Advanced Features**
- **DOI Resolution**: Multi-provider fallback chain
- **Rate Limiting**: Token bucket algorithm per source
- **Text Processing**: HTML cleaning and normalization
- **Error Handling**: Structured responses with actionable suggestions
- **Caching**: Intelligent caching for DOI resolution

### **Technology Stack**
- **TypeScript + ESM**: Modern JavaScript with full type safety
- **Modular Design**: Clean separation of concerns
- **Graceful Degradation**: Always functional even with partial failures
- **Response Size Management**: Automatic truncation and warnings

## 📊 Source Comparison

| Source | Papers | Disciplines | Full-Text | Citation Data | Preprints |
|--------|--------|-------------|-----------|---------------|-----------|
| arXiv | 2.3M+ | STEM | HTML ✓ | Limited | ✓ |
| OpenAlex | 200M+ | All | Variable | ✓✓✓ | ✓ |
| PMC | 7M+ | Biomedical | XML/HTML ✓ | Limited | ✗ |
| Europe PMC | 40M+ | Life Sciences | HTML ✓ | Limited | ✓ |
| bioRxiv/medRxiv | 500K+ | Bio/Medical | HTML ✓ | Limited | ✓✓✓ |
| CORE | 200M+ | All | PDF/HTML ✓ | Limited | ✓ |

## 🔧 Development

### Build
```bash
npm run build
```

### Test Individual Sources
```bash
# Test specific sources
node dist/cli.js list-categories --source=arxiv
node dist/cli.js fetch-latest --source=biorxiv --category="biorxiv:biology" --count=3
node dist/cli.js fetch-content --source=core --id=12345678
```

### Performance Testing
```bash
# Run performance benchmarks
npm run test -- tests/integration/performance.test.ts

# Test memory usage
npm run test -- --reporter=verbose
```

## 🚨 Error Handling

Comprehensive error handling for all sources:
- Invalid paper IDs with format suggestions
- Rate limiting with retry-after information  
- API timeouts and server errors
- Missing authentication (CORE API key)
- Network connectivity issues
- Text extraction failures with fallback strategies

## 🔍 Troubleshooting

### Common Issues
- **Rate limiting**: Automatic retry with exponential backoff
- **Missing papers**: Try alternative sources for the same content
- **Text extraction failures**: Fallback to abstract or metadata
- **CORE API limits**: Set `CORE_API_KEY` environment variable

### Performance Optimization
- Use appropriate `count` parameters (smaller for faster responses)
- Cache results when possible
- Use `fetch_latest` for discovery, `fetch_content` for detailed reading

## 📝 License

MIT

---

**Ready to explore the world's scientific knowledge? Start with any of the 6 sources and discover papers across all academic disciplines!** 🔬📚