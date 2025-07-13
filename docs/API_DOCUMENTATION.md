# API Documentation - Scientific Papers MCP Server

This document provides comprehensive API documentation for all 6 source drivers and their capabilities.

## Table of Contents

1. [Driver Architecture](#driver-architecture)
2. [arXiv Driver](#arxiv-driver)
3. [OpenAlex Driver](#openalex-driver)
4. [PMC Driver](#pmc-driver)
5. [Europe PMC Driver](#europe-pmc-driver)
6. [bioRxiv/medRxiv Driver](#biorxivmedrxiv-driver)
7. [CORE Driver](#core-driver)
8. [DOI Resolver](#doi-resolver)
9. [Text Extraction](#text-extraction)
10. [Rate Limiting](#rate-limiting)
11. [Error Handling](#error-handling)

## Driver Architecture

All drivers implement the `BaseDriver` interface providing consistent methods:

```typescript
interface BaseDriver {
  listCategories(): Promise<Category[]>;
  fetchLatest(category: string, count: number): Promise<PaperMetadata[]>;
  fetchContent(id: string): Promise<PaperMetadata>;
}
```

### Common Types

```typescript
interface Category {
  id: string;
  name: string;
  description?: string;
}

interface PaperMetadata {
  id: string;
  title: string;
  authors: string[];
  date: string; // ISO format YYYY-MM-DD
  pdf_url?: string;
  text: string;
  textTruncated?: boolean;
  textExtractionFailed?: boolean;
}
```

## arXiv Driver

### Overview
Provides access to arXiv's repository of scientific preprints and papers, primarily in STEM fields.

### API Endpoints
- **Base URL**: `https://export.arxiv.org/api/query`
- **Rate Limit**: 5 requests per minute
- **Protocol**: RSS/Atom XML

### Categories

```typescript
const ARXIV_CATEGORIES = [
  { id: 'cs.AI', name: 'Artificial Intelligence' },
  { id: 'cs.LG', name: 'Machine Learning' },
  { id: 'cs.CL', name: 'Computation and Language' },
  { id: 'cs.CV', name: 'Computer Vision and Pattern Recognition' },
  { id: 'cs.RO', name: 'Robotics' },
  { id: 'physics.gen-ph', name: 'General Physics' },
  { id: 'math.CO', name: 'Combinatorics' },
  { id: 'stat.ML', name: 'Machine Learning (Statistics)' }
];
```

### Methods

#### `listCategories()`
Returns predefined arXiv categories.

**Returns**: `Promise<Category[]>`

#### `fetchLatest(category: string, count: number)`
Fetches recent papers from arXiv by category.

**Parameters**:
- `category`: arXiv category (e.g., "cs.AI", "physics.gen-ph")
- `count`: Number of papers (1-200)

**Query Format**:
```
search_query=cat:{category}&sortBy=submittedDate&sortOrder=descending&max_results={count}
```

**Returns**: `Promise<PaperMetadata[]>`

#### `fetchContent(id: string)`
Fetches specific paper with full text extraction.

**Parameters**:
- `id`: arXiv ID (e.g., "2401.12345", "cs/0601001", "1234.5678v2")

**Text Extraction Sources**:
1. `https://arxiv.org/html/{id}` (primary)
2. `https://ar5iv.labs.arxiv.org/html/{id}` (fallback)

**Returns**: `Promise<PaperMetadata>`

### ID Formats
- **New format**: `YYMM.NNNNN[vN]` (e.g., "2401.12345", "2401.12345v2")
- **Old format**: `subject-class/YYMMnnn` (e.g., "cs/0601001", "math.GT/0309136")

### Example Usage
```javascript
const driver = new ArxivDriver(rateLimiter);

// List categories
const categories = await driver.listCategories();

// Fetch latest AI papers
const papers = await driver.fetchLatest('cs.AI', 10);

// Get specific paper content
const paper = await driver.fetchContent('2401.12345');
```

## OpenAlex Driver

### Overview
Provides access to OpenAlex's comprehensive database of scholarly works with rich citation data.

### API Endpoints
- **Base URL**: `https://api.openalex.org`
- **Rate Limit**: 10 requests per minute
- **Protocol**: REST JSON API

### Enhanced Features
- **DOI Resolution**: Integrated fallback chain for full-text access
- **Citation Data**: Rich bibliometric information
- **Concept Mapping**: Hierarchical subject classification
- **Institution Data**: Author affiliation information

### Methods

#### `listCategories()`
Fetches top-level concepts from OpenAlex.

**API Call**: `GET /concepts?filter=level:0&per-page=50`

**Returns**: `Promise<Category[]>`

#### `fetchLatest(category: string, count: number)`
Fetches recent papers by concept.

**Parameters**:
- `category`: Concept name (e.g., "artificial intelligence") or ID (e.g., "C41008148")
- `count`: Number of papers (1-200)

**API Call**: `GET /works?filter=concepts.display_name:{category}&sort=publication_date:desc`

**Returns**: `Promise<PaperMetadata[]>`

#### `fetchContent(id: string)`
Fetches specific paper with enhanced text extraction.

**Parameters**:
- `id`: OpenAlex Work ID (e.g., "W2741809807") or numeric (2741809807)

**Text Extraction Strategy**:
1. HTML sources from `best_oa_location`
2. DOI resolver fallback chain
3. Alternative location URLs

**Returns**: `Promise<PaperMetadata>`

### DOI Resolution Integration
The OpenAlex driver includes advanced DOI resolution:
1. **Unpaywall API**: Free full-text sources
2. **Crossref API**: Publisher metadata and DOIs
3. **Semantic Scholar**: Alternative access URLs

### Example Usage
```javascript
const driver = new OpenAlexDriver(rateLimiter);

// Search by concept name
const papers = await driver.fetchLatest('machine learning', 5);

// Search by concept ID
const aiPapers = await driver.fetchLatest('C41008148', 10);

// Get paper with full text
const paper = await driver.fetchContent('W2741809807');
```

## PMC Driver

### Overview
Provides access to PubMed Central's collection of biomedical and life science literature.

### API Endpoints
- **Base URL**: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`
- **Rate Limit**: 3 requests per second
- **Protocol**: E-utilities XML API

### Categories

```typescript
const PMC_CATEGORIES = [
  { id: 'immunology', name: 'Immunology' },
  { id: 'genetics', name: 'Genetics' },
  { id: 'neuroscience', name: 'Neuroscience' },
  { id: 'cancer', name: 'Cancer Research' },
  { id: 'cardiology', name: 'Cardiology' },
  { id: 'infectious_diseases', name: 'Infectious Diseases' },
  { id: 'pharmacology', name: 'Pharmacology' },
  { id: 'biochemistry', name: 'Biochemistry' },
  { id: 'cell_biology', name: 'Cell Biology' },
  { id: 'molecular_biology', name: 'Molecular Biology' },
  { id: 'microbiology', name: 'Microbiology' },
  { id: 'pathology', name: 'Pathology' }
];
```

### Methods

#### `listCategories()`
Returns predefined biomedical categories with MeSH term mapping.

#### `fetchLatest(category: string, count: number)`
Searches PMC using E-utilities with MeSH terms.

**API Calls**:
1. `esearch.fcgi` - Search for PMC IDs
2. `esummary.fcgi` - Get metadata summaries

**Parameters**:
- `category`: Biomedical category (e.g., "immunology", "genetics")
- `count`: Number of papers (1-100)

#### `fetchContent(id: string)`
Fetches specific PMC paper with text extraction.

**Parameters**:
- `id`: PMC ID (e.g., "PMC8245678") or PMID (e.g., "12345678")

**Text Extraction**:
1. PMC full-text XML when available
2. HTML extraction from PMC website
3. Abstract fallback

### MeSH Term Mapping
Categories are mapped to Medical Subject Headings (MeSH) for precise search:

```typescript
const meshMapping = {
  'immunology': 'immunology[MeSH Terms] OR immune system[MeSH Terms]',
  'genetics': 'genetics[MeSH Terms] OR genomics[MeSH Terms]',
  'neuroscience': 'neurosciences[MeSH Terms] OR neurology[MeSH Terms]'
};
```

### Example Usage
```javascript
const driver = new PMCDriver(rateLimiter);

// Fetch latest immunology papers
const papers = await driver.fetchLatest('immunology', 5);

// Get specific PMC paper
const paper = await driver.fetchContent('PMC8245678');
```

## Europe PMC Driver

### Overview
Provides access to Europe PMC's extensive collection of life science literature.

### API Endpoints
- **Base URL**: `https://www.ebi.ac.uk/europepmc/webservices/rest`
- **Rate Limit**: 10 requests per minute
- **Protocol**: REST JSON API

### Categories

```typescript
const EUROPEPMC_CATEGORIES = [
  { id: 'life_sciences', name: 'Life Sciences' },
  { id: 'medicine', name: 'Medicine' },
  { id: 'biology', name: 'Biology' },
  { id: 'biochemistry', name: 'Biochemistry' },
  { id: 'genetics', name: 'Genetics' },
  { id: 'molecular_biology', name: 'Molecular Biology' },
  { id: 'cell_biology', name: 'Cell Biology' },
  { id: 'neuroscience', name: 'Neuroscience' },
  { id: 'immunology', name: 'Immunology' },
  { id: 'cancer', name: 'Cancer Research' },
  { id: 'pharmacology', name: 'Pharmacology' },
  { id: 'bioinformatics', name: 'Bioinformatics' },
  { id: 'structural_biology', name: 'Structural Biology' },
  { id: 'ecology', name: 'Ecology' }
];
```

### Methods

#### `fetchLatest(category: string, count: number)`
Searches Europe PMC with full-text filtering.

**API Call**: `GET /search`

**Query Format**:
```
query={searchQuery} AND has_fulltext:y&format=json&pageSize={count}&sort=date desc
```

**Parameters**:
- `category`: Life science category
- `count`: Number of papers (1-100)

#### `fetchContent(id: string)`
Fetches specific paper with multi-strategy text extraction.

**Parameters**:
- `id`: PMC ID, PMID, or DOI

**Text Extraction Strategies**:
1. Europe PMC landing page extraction
2. Full-text URL extraction
3. Publisher website fallback

### MESH Query Mapping
Advanced search queries using MESH terms:

```typescript
const categoryMapping = {
  'life_sciences': '(MESH:"Life Sciences" OR "life science*")',
  'medicine': '(MESH:"Medicine" OR "medical" OR "clinical")',
  'biology': '(MESH:"Biology" OR "biological science*")',
  'cancer': '(MESH:"Neoplasms" OR "cancer" OR "oncology" OR "tumor")'
};
```

### Example Usage
```javascript
const driver = new EuropePMCDriver(rateLimiter);

// Search biology papers
const papers = await driver.fetchLatest('biology', 10);

// Get paper with full text
const paper = await driver.fetchContent('PMC8245678');
```

## bioRxiv/medRxiv Driver

### Overview
Provides access to bioRxiv and medRxiv preprint servers for biology and medical research.

### API Endpoints
- **bioRxiv**: `https://api.biorxiv.org`
- **medRxiv**: `https://api.medrxiv.org`
- **Rate Limit**: 5 requests per minute
- **Protocol**: JSON API

### Categories

The driver supports 68 total categories:
- **bioRxiv**: 25 categories (biology-focused)
- **medRxiv**: 43 categories (medical-focused)

#### bioRxiv Categories (Sample)
```typescript
const bioRxivCategories = [
  { id: 'biorxiv:animal-behavior-and-cognition', name: 'Animal Behavior and Cognition' },
  { id: 'biorxiv:biochemistry', name: 'Biochemistry' },
  { id: 'biorxiv:bioinformatics', name: 'Bioinformatics' },
  { id: 'biorxiv:neuroscience', name: 'Neuroscience' },
  { id: 'biorxiv:cell-biology', name: 'Cell Biology' }
];
```

#### medRxiv Categories (Sample)
```typescript
const medRxivCategories = [
  { id: 'medrxiv:cardiology', name: 'Cardiovascular Medicine' },
  { id: 'medrxiv:psychiatry', name: 'Psychiatry and Clinical Psychology' },
  { id: 'medrxiv:infectious-diseases', name: 'Infectious Diseases' },
  { id: 'medrxiv:epidemiology', name: 'Epidemiology' }
];
```

### Methods

#### `listCategories()`
Returns combined categories from both servers with prefixes.

#### `fetchLatest(category: string, count: number)`
Fetches recent preprints from bioRxiv or medRxiv.

**Parameters**:
- `category`: Prefixed category (e.g., "biorxiv:neuroscience", "medrxiv:cardiology")
- `count`: Number of papers (1-100)

**API Call**: `GET /details/{server}/{fromDate}/{toDate}`

**Date Range**: Last 30 days from current date

#### `fetchContent(id: string)`
Fetches specific preprint with text extraction.

**Parameters**:
- `id`: DOI (e.g., "10.1101/2021.01.01.425001") or partial ("2021.01.01.425001")

**Text Extraction**:
1. HTML extraction from paper landing page
2. Abstract fallback when full text unavailable

### Server Detection
Automatic server detection based on category or DOI:

```typescript
function parseCategory(category: string): { server: string; subject: string } {
  if (category.startsWith('biorxiv:')) return { server: 'biorxiv', subject: category.replace('biorxiv:', '') };
  if (category.startsWith('medrxiv:')) return { server: 'medrxiv', subject: category.replace('medrxiv:', '') };
  // Fallback logic for unprefi
```

### Example Usage
```javascript
const driver = new BioRxivDriver(rateLimiter);

// List all categories (both servers)
const categories = await driver.listCategories();

// Fetch bioRxiv neuroscience papers
const papers = await driver.fetchLatest('biorxiv:neuroscience', 5);

// Fetch medRxiv cardiology papers
const medPapers = await driver.fetchLatest('medrxiv:cardiology', 3);

// Get specific preprint
const paper = await driver.fetchContent('10.1101/2021.01.01.425001');
```

## CORE Driver

### Overview
Provides access to CORE's massive collection of open access research papers across all disciplines.

### API Endpoints
- **Base URL**: `https://api.core.ac.uk/v3`
- **Rate Limit**: 10 requests per minute (public), higher with API key
- **Protocol**: REST JSON API
- **Authentication**: Optional API key for enhanced access

### Categories

```typescript
const CORE_CATEGORIES = [
  { id: 'computer_science', name: 'Computer Science' },
  { id: 'mathematics', name: 'Mathematics' },
  { id: 'physics', name: 'Physics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'biology', name: 'Biology' },
  { id: 'medicine', name: 'Medicine' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'social_sciences', name: 'Social Sciences' },
  { id: 'economics', name: 'Economics' },
  { id: 'psychology', name: 'Psychology' },
  { id: 'education', name: 'Education' },
  { id: 'linguistics', name: 'Linguistics' },
  { id: 'philosophy', name: 'Philosophy' },
  { id: 'history', name: 'History' },
  { id: 'geography', name: 'Geography' },
  { id: 'law', name: 'Law' },
  { id: 'arts', name: 'Arts' },
  { id: 'agriculture', name: 'Agriculture' },
  { id: 'environmental_science', name: 'Environmental Science' },
  { id: 'political_science', name: 'Political Science' }
];
```

### Authentication
Optional API key for enhanced rate limits:

```bash
export CORE_API_KEY="your-api-key"
```

### Methods

#### `fetchLatest(category: string, count: number)`
Searches CORE database with subject filtering.

**API Call**: `POST /search/works`

**Request Body**:
```json
{
  "q": "subjects:(\"computer science\" OR \"computing\")",
  "limit": 10,
  "offset": 0,
  "sort": "publishedDate:desc",
  "exclude_without_fulltext": true
}
```

#### `fetchContent(id: string)`
Fetches specific CORE paper.

**Parameters**:
- `id`: CORE numeric ID (e.g., "12345678")

**API Call**: `GET /works/{id}`

**Text Extraction Strategies**:
1. Abstract content (always available)
2. PDF download URL extraction
3. Source repository URL extraction

### Subject Query Mapping
Advanced subject search with boolean operators:

```typescript
const categoryMapping = {
  'computer_science': 'subjects:("computer science" OR "computing" OR "artificial intelligence")',
  'mathematics': 'subjects:("mathematics" OR "mathematical" OR "statistics")',
  'physics': 'subjects:("physics" OR "astronomy" OR "astrophysics")'
};
```

### Example Usage
```javascript
// With API key
process.env.CORE_API_KEY = "your-api-key";

const driver = new CoreDriver(rateLimiter);

// Search computer science papers
const papers = await driver.fetchLatest('computer_science', 10);

// Get specific paper
const paper = await driver.fetchContent('12345678');
```

## DOI Resolver

### Overview
Advanced DOI resolution system with multi-provider fallback chain for enhanced full-text access.

### Architecture
```typescript
class DOIResolver {
  private cache: LRUCache<DOIResolutionResult>;
  private unpaywallLimiter: RateLimiter;
  private crossrefLimiter: RateLimiter;
  private s2agLimiter: RateLimiter;
}
```

### Fallback Chain
1. **Unpaywall API** (`https://api.unpaywall.org`)
   - Free full-text sources
   - OA (Open Access) detection
   - Repository URLs

2. **Crossref API** (`https://api.crossref.org`)
   - Publisher metadata
   - DOI validation
   - Alternative identifiers

3. **Semantic Scholar Academic Graph** (`https://api.semanticscholar.org`)
   - Alternative access URLs
   - Citation data
   - PDF availability

### Caching
- **LRU Cache**: 24-hour TTL with 1000 entry capacity
- **Cache Key**: DOI string
- **Cache Value**: Resolution result with URLs and metadata

### Rate Limiting
- **Unpaywall**: 5 requests per minute
- **Crossref**: 50 requests per second (polite pool)
- **Semantic Scholar**: 100 requests per second

### Methods

#### `resolveDOI(doi: string): Promise<DOIResolutionResult>`
Resolves DOI through fallback chain.

**Returns**:
```typescript
interface DOIResolutionResult {
  doi: string;
  isOpenAccess: boolean;
  urls: Array<{
    url: string;
    type: 'pdf' | 'html' | 'landing';
    source: string;
  }>;
  resolverPath: string[];
  cached: boolean;
}
```

### Example Usage
```javascript
const resolver = new DOIResolver();

const result = await resolver.resolveDOI('10.1038/nature12373');
console.log(result.urls); // Available access URLs
console.log(result.resolverPath); // ['unpaywall'] or ['unpaywall', 'crossref']
```

## Text Extraction

### Overview
Comprehensive text extraction system with source-specific strategies and intelligent fallback mechanisms.

### Architecture
```typescript
class HtmlExtractor {
  constructor(config: TextExtractionConfig);
  extractText(url: string): Promise<ExtractionResult>;
}
```

### Configuration
```typescript
interface TextExtractionConfig {
  maxTextLength: number;        // 6MB limit
  enableArxivFallback: boolean; // ar5iv.labs.arxiv.org fallback
  enableOpenAlexExtraction: boolean;
  cleaningOptions: {
    removeExtraWhitespace: boolean;
    removeSpecialChars: boolean;
    normalizeLineBreaks: boolean;
  };
}
```

### Text Cleaning Pipeline
1. **HTML Parsing**: Cheerio-based DOM parsing
2. **Content Selection**: Academic paper-specific selectors
3. **Noise Removal**: Navigation, ads, headers, footers
4. **Text Normalization**: Whitespace and formatting cleanup
5. **Size Management**: Truncation at word boundaries

### Academic Content Selectors
```typescript
const ACADEMIC_SELECTORS = [
  'article',
  '.article-content',
  '.paper-content',
  '.abstract',
  '.main-content',
  '#main-content',
  '.content'
];
```

### Extraction Results
```typescript
interface ExtractionResult {
  text: string;
  extractionSuccess: boolean;
  truncated: boolean;
  originalLength: number;
  source: string;
}
```

### Source-Specific Strategies

#### arXiv
- **Primary**: `https://arxiv.org/html/{id}`
- **Fallback**: `https://ar5iv.labs.arxiv.org/html/{id}`
- **Content Type**: LaTeX-rendered HTML
- **Success Rate**: ~90%

#### OpenAlex
- **Strategy**: DOI resolver integration
- **Content Type**: Publisher HTML
- **Fallback**: Alternative location URLs

#### PMC/Europe PMC
- **Strategy**: Direct API + HTML extraction
- **Content Type**: XML/HTML medical literature
- **Quality**: High (specialized medical content)

#### bioRxiv/medRxiv
- **Strategy**: Landing page extraction
- **Fallback**: Abstract content
- **Content Type**: Preprint HTML

#### CORE
- **Strategy**: Multi-source (PDF, HTML, repositories)
- **Fallback**: Abstract + source URLs
- **Content Type**: Mixed (academic repositories)

## Rate Limiting

### Overview
Token bucket algorithm implementation with per-source rate limiting to ensure respectful API usage.

### Architecture
```typescript
class RateLimiter {
  private buckets: Map<string, TokenBucket>;
  constructor(limits?: RateLimitConfig);
}
```

### Configuration
```typescript
const DEFAULT_RATE_LIMITS = {
  arxiv: { maxTokens: 5, refillRate: 5 / 60 },      // 5 req/min
  openalex: { maxTokens: 10, refillRate: 10 / 60 }, // 10 req/min
  pmc: { maxTokens: 3, refillRate: 3 / 1 },         // 3 req/sec
  europepmc: { maxTokens: 10, refillRate: 10 / 60 }, // 10 req/min
  biorxiv: { maxTokens: 5, refillRate: 5 / 60 },    // 5 req/min
  core: { maxTokens: 10, refillRate: 10 / 60 }      // 10 req/min
};
```

### Token Bucket Algorithm
- **Tokens**: Available request quota
- **Refill Rate**: Tokens added per time unit
- **Max Capacity**: Maximum token storage
- **Consumption**: 1 token per API request

### Methods

#### `checkLimit(source: string): boolean`
Checks if request is allowed and consumes token.

#### `getRetryAfter(source: string): number`
Returns seconds until next token is available.

### Usage Pattern
```typescript
if (!rateLimiter.checkLimit('arxiv')) {
  const retryAfter = rateLimiter.getRetryAfter('arxiv');
  throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

## Error Handling

### Error Classification

#### Network Errors
- **Timeout**: Request exceeded time limit
- **Connection**: Network connectivity issues
- **DNS**: Domain resolution failures

#### API Errors
- **Authentication**: Invalid or missing API keys
- **Authorization**: Insufficient permissions
- **Rate Limiting**: Quota exceeded
- **Not Found**: Invalid paper IDs or endpoints
- **Server Error**: API service unavailable

#### Validation Errors
- **Invalid Parameters**: Malformed input data
- **Missing Required**: Required parameters not provided
- **Format Errors**: Invalid date or ID formats

#### Text Extraction Errors
- **Parsing Failures**: HTML parsing issues
- **Content Not Found**: No extractable text content
- **Size Limits**: Content exceeds size limits

### Error Response Format
```typescript
interface ErrorResponse {
  error: string;
  code: string;
  source: string;
  details?: Record<string, any>;
  suggestions?: string[];
}
```

### Common Error Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| `RATE_LIMITED` | Request rate exceeded | Too many concurrent requests |
| `INVALID_ID` | Paper ID format invalid | Wrong ID format for source |
| `NOT_FOUND` | Paper not found | Paper doesn't exist or moved |
| `EXTRACTION_FAILED` | Text extraction failed | Content not available as HTML |
| `NETWORK_ERROR` | Network request failed | Connectivity or timeout issues |
| `AUTH_ERROR` | Authentication failed | Invalid or missing API key |
| `VALIDATION_ERROR` | Parameter validation failed | Invalid or missing parameters |

### Retry Strategies

#### Exponential Backoff
```typescript
const backoffDelays = [1000, 2000, 4000, 8000]; // milliseconds
```

#### Rate Limit Handling
```typescript
if (error.code === 'RATE_LIMITED') {
  const retryAfter = parseRetryAfter(error.headers);
  await delay(retryAfter * 1000);
  return retry();
}
```

#### Fallback Strategies
```typescript
if (error.code === 'EXTRACTION_FAILED') {
  // Try alternative sources or return metadata only
  return { ...metadata, text: '', textExtractionFailed: true };
}
```

### Error Handling Best Practices

1. **Graceful Degradation**: Always return available data
2. **Informative Messages**: Provide actionable error information
3. **Retry Logic**: Implement appropriate retry strategies
4. **Fallback Sources**: Use alternative sources when available
5. **User Guidance**: Suggest alternative approaches

### Example Error Handling
```javascript
try {
  const paper = await driver.fetchContent(id);
  return paper;
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error.code === 'NOT_FOUND') {
    console.log(`Paper ${id} not found. Try searching by title or keywords.`);
  } else if (error.code === 'EXTRACTION_FAILED') {
    console.log('Full text unavailable, but metadata is complete.');
  }
  throw error;
}
```

---

This comprehensive API documentation covers all aspects of the Scientific Papers MCP Server, providing developers with detailed information for integration and troubleshooting.