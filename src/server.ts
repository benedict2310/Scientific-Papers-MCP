#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listCategories } from "./tools/list-categories.js";
import { fetchLatest } from "./tools/fetch-latest.js";
import { fetchTopCited } from "./tools/fetch-top-cited.js";
import { fetchContent } from "./tools/fetch-content.js";
import { searchPapers } from "./tools/search-papers.js";
import { RateLimiter } from "./core/rate-limiter.js";
import { logInfo, logError } from "./core/logger.js";

// Detect if we should run in CLI mode or MCP server mode
// CLI mode: when command line arguments are provided
// MCP server mode: when no arguments (AI tools will use stdin/stdout)
const args = process.argv.slice(2);
const shouldRunCLI = args.length > 0;

if (shouldRunCLI) {
  // Import and run CLI
  import('./cli.js').then(cliModule => {
    cliModule.runCLI();
  }).catch(error => {
    logError('Failed to load CLI module', { error: error.message });
    process.exit(1);
  });
} else {
  // Run MCP server
  startMCPServer();
}

async function startMCPServer() {
  // Create a single rate limiter instance for the whole application
  let globalRateLimiter: RateLimiter | null = null;

  function getRateLimiter(): RateLimiter {
    if (!globalRateLimiter) {
      globalRateLimiter = new RateLimiter();
    }
    return globalRateLimiter;
  }

  const server = new McpServer({
    name: "SciHarvester",
    version: "0.1.30",
    description: `
      🔬 SciHarvester: Advanced Scientific Literature Access System
      
      A comprehensive MCP server providing LLMs with real-time access to 6 major academic databases:
      arXiv, OpenAlex, PMC, Europe PMC, bioRxiv/medRxiv, and CORE.
      
      📊 CAPABILITIES:
      • Browse categories and research fields across all sources
      • Fetch latest papers with full metadata and text content  
      • Find highly cited influential papers by research concept
      • Retrieve complete paper content including full text when available
      
      🎯 OPTIMAL USAGE PATTERNS:
      1. Start with list_categories to explore available fields
      2. Use fetch_latest for current research in specific areas
      3. Use fetch_top_cited to find influential papers in a field
      4. Use fetch_content to get full text and detailed analysis
      
      ⚡ PERFORMANCE NOTES:
      • Rate limited to protect source APIs
      • arXiv and OpenAlex are fastest for large queries
      • PMC sources provide highest quality full-text content
      • Start with small counts (5-10) and increase as needed
      
      🔍 RESEARCH WORKFLOW:
      Literature Review → Category Exploration → Latest Papers → Influential Papers → Full Content
    `,
  });

  // Add list_categories tool
  server.tool("list_categories", 
    {
      source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]).describe(`
        Data source to fetch categories from:
        • 'arxiv' - arXiv.org preprint categories (physics, computer science, mathematics, etc.)
        • 'openalex' - OpenAlex research concepts (AI, machine learning, quantum computing, etc.) 
        • 'pmc' - PubMed Central biomedical categories (medicine, biology, neuroscience, etc.)
        • 'europepmc' - Europe PMC life sciences categories (similar to PMC but European focus)
        • 'biorxiv' - bioRxiv/medRxiv preprint categories (biology, medicine preprints)
        • 'core' - CORE academic paper repository categories (multidisciplinary)
        
        USAGE TIP: Always call this first to understand available categories before using fetch_latest.
      `)
    },
    async ({ source }) => {
      try {
        logInfo('MCP tool called', { tool: 'list_categories', source });
        
        // Call the tool function
        const result = await listCategories({ source });
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${result.categories.length} categories from ${result.source}:`
            },
            {
              type: "text", 
              text: JSON.stringify(result.categories, null, 2)
            }
          ]
        };
      } catch (error) {
        logError('Error in list_categories tool', { 
          error: error instanceof Error ? error.message : error,
          source 
        });
        
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

  // Add fetch_latest tool
  server.tool("fetch_latest",
    {
      source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]).describe(`
        Data source to fetch latest papers from:
        • 'arxiv' - arXiv.org preprints (physics, CS, math, etc.) - Very fast, comprehensive
        • 'openalex' - OpenAlex academic papers (all fields) - Massive database, good metadata
        • 'pmc' - PubMed Central (biomedical) - Full-text open access, high quality
        • 'europepmc' - Europe PMC (life sciences) - European biomedical literature
        • 'biorxiv' - bioRxiv/medRxiv preprints - Latest biology/medicine preprints
        • 'core' - CORE repository (multidisciplinary) - Global academic papers
        
        PERFORMANCE TIPS: 
        - arXiv and OpenAlex are fastest for large queries
        - PMC sources provide full-text content but slower
        - Use smaller counts (5-10) initially to test categories
      `),
      category: z.string().describe(`
        Category or field to search within the chosen source:
        
        CATEGORY FORMATS BY SOURCE:
        • arXiv: Use codes like 'cs.AI', 'physics.quan-ph', 'math.NT'
        • OpenAlex: Use concept names like 'machine learning', 'quantum computing' or IDs like 'C41008148'
        • PMC: Use names like 'medicine', 'biology', 'neuroscience', 'oncology'
        • Europe PMC: Similar to PMC - 'medicine', 'genetics', 'immunology'
        • bioRxiv: Use 'biology', 'neuroscience', 'bioinformatics', 'genetics'
        • CORE: Use broad terms like 'computer science', 'engineering', 'medicine'
        
        IMPORTANT: Call list_categories first to see exact available options for your chosen source.
      `),
      count: z.number().min(1).max(200).default(50).describe(`
        Number of papers to fetch (1-200, default: 50).
        
        RECOMMENDED COUNTS:
        • Initial exploration: 5-10 papers
        • Research survey: 20-50 papers  
        • Comprehensive analysis: 50-100 papers
        • Large dataset: 100-200 papers
        
        NOTE: Larger counts take longer and may hit rate limits. Start small and increase as needed.
      `)
    },
    async ({ source, category, count = 50 }) => {
      try {
        logInfo('MCP tool called', { tool: 'fetch_latest', source, category, count });
        
        const rateLimiter = getRateLimiter();
        const result = await fetchLatest({ source, category, count }, rateLimiter);
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${result.content.length} latest papers from ${source} in category "${category}":`
            },
            {
              type: "text",
              text: JSON.stringify(result.content, null, 2)
            }
          ]
        };
      } catch (error) {
        logError('Error in fetch_latest tool', { 
          error: error instanceof Error ? error.message : error,
          source, category, count 
        });
        
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

  // Add fetch_top_cited tool  
  server.tool("fetch_top_cited",
    {
      concept: z.string().describe(`
        Research concept or field to search for highly cited papers.
        
        CONCEPT FORMATS:
        • Natural language: 'machine learning', 'artificial intelligence', 'quantum computing', 'cancer treatment'
        • OpenAlex concept IDs: 'C41008148' (for specific concepts)
        • Interdisciplinary terms: 'computational biology', 'materials science', 'climate change'
        
        EXAMPLES BY FIELD:
        • AI/CS: 'deep learning', 'natural language processing', 'computer vision'
        • Medicine: 'immunotherapy', 'precision medicine', 'covid-19'  
        • Physics: 'quantum computing', 'gravitational waves', 'dark matter'
        • Biology: 'crispr', 'gene therapy', 'synthetic biology'
        
        TIP: Use list_categories with source='openalex' to explore available research concepts.
      `),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(`
        Start date in YYYY-MM-DD format (e.g., '2024-01-01').
        Only papers published on or after this date will be included.
        
        DATE STRATEGY RECOMMENDATIONS:
        • Current hot topics: Use last 6-12 months (e.g., '2024-06-01')
        • Established fields: Use last 2-3 years (e.g., '2022-01-01') 
        • Breakthrough research: Use last 5 years (e.g., '2020-01-01')
        • Historical analysis: Use older dates as needed
        
        NOTE: More recent dates = fewer but more current papers. Older dates = more papers but less current.
      `),
      count: z.number().min(1).max(200).default(50).describe(`
        Number of top cited papers to fetch (1-200, default: 50).
        
        RECOMMENDED COUNTS BY USE CASE:
        • Quick overview: 5-10 papers (most influential recent work)
        • Literature review: 20-50 papers (comprehensive survey)
        • Meta-analysis: 50-100 papers (extensive research base)
        • Complete survey: 100-200 papers (exhaustive coverage)
        
        NOTE: Results are ranked by citation count, so you get the most influential papers first.
      `)
    },
    async ({ concept, since, count = 50 }) => {
      try {
        logInfo('MCP tool called', { tool: 'fetch_top_cited', concept, since, count });
        
        const rateLimiter = getRateLimiter();
        const result = await fetchTopCited({ concept, since, count }, rateLimiter);
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${result.content.length} top cited papers for concept "${concept}" since ${since}:`
            },
            {
              type: "text",
              text: JSON.stringify(result.content, null, 2)
            }
          ]
        };
      } catch (error) {
        logError('Error in fetch_top_cited tool', { 
          error: error instanceof Error ? error.message : error,
          concept, since, count 
        });
        
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

  // Add fetch_content tool
  server.tool("fetch_content",
    {
      source: z.enum(["arxiv", "openalex", "pmc", "europepmc", "biorxiv", "core"]).describe(`
        Data source where the target paper is located:
        • 'arxiv' - arXiv.org preprints (fast, full-text available)
        • 'openalex' - OpenAlex academic database (metadata + abstracts)  
        • 'pmc' - PubMed Central (full-text biomedical papers, slower but comprehensive)
        • 'europepmc' - Europe PMC (full-text life sciences papers)
        • 'biorxiv' - bioRxiv/medRxiv preprints (biology/medicine preprints)
        • 'core' - CORE repository (academic papers, variable text availability)
        
        CONTENT AVAILABILITY:
        - arXiv, PMC, Europe PMC: Usually provide full paper text
        - OpenAlex: Provides abstracts and rich metadata
        - bioRxiv, CORE: Variable full-text availability
      `),
      paper_id: z.string().describe(`
        Paper ID from the respective source (obtain from fetch_latest or fetch_top_cited results):
        
        ID FORMATS BY SOURCE:
        • arXiv: '2506.21552', '1234.5678v2' (arXiv ID format)
        • OpenAlex: 'W2741809807' (Work ID starting with 'W')
        • PMC: 'PMC1234567' or '1234567' (PMC ID with or without prefix)
        • Europe PMC: 'PMC1234567', 'PMID:12345678', or DOI
        • bioRxiv: DOI format like '10.1101/2024.01.01.123456'
        • CORE: Usually numeric ID or DOI
        
        IMPORTANT: 
        - Copy exact IDs from previous fetch_latest/fetch_top_cited results
        - Don't modify ID formats - use them exactly as provided
        - For PMC, both 'PMC1234567' and '1234567' formats work
        
        USAGE WORKFLOW:
        1. Use fetch_latest or fetch_top_cited to find papers
        2. Copy the 'id' field from results  
        3. Use that exact ID with matching source in fetch_content
      `)
    },
    async ({ source, paper_id }) => {
              try {
          logInfo('MCP tool called', { tool: 'fetch_content', source, id: paper_id });
          
          const rateLimiter = getRateLimiter();
          const result = await fetchContent({ source, id: paper_id }, rateLimiter);
        
        return {
          content: [
            {
              type: "text",
              text: `Retrieved paper "${result.content.title}" from ${source}:`
            },
            {
              type: "text",
              text: JSON.stringify(result.content, null, 2)
            }
          ]
        };
      } catch (error) {
        logError('Error in fetch_content tool', { 
          error: error instanceof Error ? error.message : error,
          source, id: paper_id 
        });
        
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

  // Add search_papers tool
  server.tool("search_papers",
    {
      source: z.enum(["arxiv", "openalex", "europepmc", "core"]).describe(`
        Data source to search within:
        • 'arxiv' - arXiv.org preprints (physics, CS, math, etc.) - Fast, comprehensive search
        • 'openalex' - OpenAlex academic papers (all fields) - Massive database, good search capabilities
        • 'europepmc' - Europe PMC (life sciences) - Biomedical literature with full-text search
        • 'core' - CORE repository (multidisciplinary) - Global academic papers with advanced search
        
        SEARCH CAPABILITIES BY SOURCE:
        - arXiv: Title, abstract, author, and general search with Boolean operators
        - OpenAlex: Title, abstract, author, fulltext, and general search with relevance scoring
        - Europe PMC: Title, abstract, author, fulltext search with MeSH terms
        - CORE: Title, abstract, author, fulltext search with advanced query language
      `),
      query: z.string().min(1).max(1500).describe(`
        Search query (max 1500 characters).
        
        SEARCH STRATEGIES:
        • Keywords: 'machine learning', 'climate change', 'quantum computing'
        • Phrases: Use quotes for exact phrases: '"artificial intelligence"'
        • Boolean: 'deep learning AND neural networks' (arXiv supports this)
        • Specific terms: 'CRISPR gene editing', 'COVID-19 treatment'
        
        FIELD-SPECIFIC EXAMPLES:
        • Author search: 'John Smith', 'Smith J'
        • Title search: 'attention mechanisms', 'transformer architecture'
        • Abstract search: 'reinforcement learning applications'
        • Full-text search: 'methodology AND results'
        
        TIP: Start with simple keywords and refine based on results.
      `),
      field: z.enum(["all", "title", "abstract", "author", "fulltext"]).optional().default("all").describe(`
        Search field to focus on (default: 'all'):
        • 'all' - Search across all fields (recommended for discovery)
        • 'title' - Search only in paper titles (precise, focused results)
        • 'abstract' - Search only in abstracts (good for content-based discovery)
        • 'author' - Search by author names (find papers by specific researchers)
        • 'fulltext' - Search full paper text (comprehensive but slower)
        
        USAGE RECOMMENDATIONS:
        • Discovery: Use 'all' for broad exploration
        • Precision: Use 'title' for specific topics  
        • Content: Use 'abstract' for thematic searches
        • Author tracking: Use 'author' for researcher-specific queries
        • Deep search: Use 'fulltext' for comprehensive content analysis
      `),
      count: z.number().min(1).max(200).default(50).describe(`
        Number of search results to return (1-200, default: 50).
        
        RECOMMENDED COUNTS:
        • Initial exploration: 5-10 results
        • Research survey: 20-50 results
        • Comprehensive analysis: 50-100 results
        • Large dataset: 100-200 results
        
        NOTE: Larger counts take longer and may hit rate limits. Start small and increase as needed.
      `),
      sortBy: z.enum(["relevance", "date", "citations"]).optional().default("relevance").describe(`
        Sort order for results (default: 'relevance'):
        • 'relevance' - Most relevant to query (best for discovery)
        • 'date' - Newest papers first (best for current research)
        • 'citations' - Most cited papers first (best for influential work)
        
        AVAILABILITY BY SOURCE:
        • arXiv: relevance, date (no citation sorting)
        • OpenAlex: relevance, date, citations (full support)
        • Europe PMC: relevance, date, citations (full support)
        • CORE: relevance, date (limited citation support)
        
        TIP: Use 'relevance' for exploration, 'date' for current topics, 'citations' for established fields.
      `)
    },
    async ({ source, query, field = "all", count = 50, sortBy = "relevance" }) => {
      try {
        logInfo('MCP tool called', { tool: 'search_papers', source, query, field, count, sortBy });
        
        const rateLimiter = getRateLimiter();
        const result = await searchPapers({ source, query, field, count, sortBy }, rateLimiter);
        
        return {
          content: [
            {
              type: "text",
              text: `Found ${result.content.length} papers from ${source} search for "${query}" in ${field} field, sorted by ${sortBy}:`
            },
            {
              type: "text",
              text: JSON.stringify(result.content, null, 2)
            }
          ]
        };
      } catch (error) {
        logError('Error in search_papers tool', { 
          error: error instanceof Error ? error.message : error,
          source, query, field, count, sortBy 
        });
        
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

  // Start the server
  async function main() {
    try {
      logInfo('Starting SciHarvester MCP Server...');
      
      // Create transport first
      const transport = new StdioServerTransport();
      logInfo('Transport created, connecting server...');
      
      // Connect server to transport
      await server.connect(transport);
      logInfo('Server connected successfully');
      
      // Handle graceful shutdown
      const handleShutdown = (signal: string) => {
        logInfo(`Received ${signal}, shutting down gracefully...`);
        process.exit(0);
      };
      
      process.on('SIGINT', () => handleShutdown('SIGINT'));
      process.on('SIGTERM', () => handleShutdown('SIGTERM'));
      process.on('SIGPIPE', () => handleShutdown('SIGPIPE'));
      
      logInfo('SciHarvester MCP Server is ready');

    } catch (error) {
      logError('Failed to start MCP server', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    }
  }

  // Handle unhandled rejections and exceptions
  process.on('unhandledRejection', (reason, promise) => {
    logError('Unhandled Rejection', { reason, promise });
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logError('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  // Start the server
  main().catch((error) => {
    logError('Fatal error in main', { 
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  });
}