#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listCategories } from "./tools/list-categories.js";
import { fetchLatest } from "./tools/fetch-latest.js";
import { fetchTopCited } from "./tools/fetch-top-cited.js";
import { fetchContent } from "./tools/fetch-content.js";
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
    version: "0.1.27",
  });

  // Add list_categories tool
  server.tool("list_categories", 
    {
      source: z.enum(["arxiv", "openalex"]).describe("The data source to fetch categories from: 'arxiv' for arXiv categories (e.g., cs.AI, physics.gen-ph) or 'openalex' for OpenAlex concepts (e.g., C41008148 for Computer Science)")
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
      source: z.enum(["arxiv", "openalex"]).describe("Data source: 'arxiv' for arXiv papers (sorted by submission date) or 'openalex' for OpenAlex papers (sorted by publication date)"),
      category: z.string().describe("Category or concept to search for. For arXiv: use category codes like 'cs.AI', 'physics.gen-ph'. For OpenAlex: use concept IDs like 'C41008148' or names like 'machine learning'. Call list_categories first to see available options."),
      count: z.number().min(1).max(200).default(50).describe("Number of papers to fetch (default: 50, max: 200). Start with smaller numbers (5-10) for initial exploration.")
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
      concept: z.string().describe("Research concept or field to search for. Can be a concept name like 'machine learning', 'artificial intelligence', 'quantum computing' or an OpenAlex concept ID like 'C41008148'. Use list_categories with source='openalex' to explore available concepts."),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date in YYYY-MM-DD format (e.g., '2024-01-01'). Only papers published on or after this date will be included. Use recent dates (last 1-2 years) to find current influential work."),
      count: z.number().min(1).max(200).default(50).describe("Number of papers to fetch (default: 50, max: 200). Start with 10-20 for initial exploration of top papers.")
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
      source: z.enum(["arxiv", "openalex"]).describe("Data source where the paper is located: 'arxiv' for arXiv papers or 'openalex' for OpenAlex papers"),
      paper_id: z.string().describe("Paper ID from the respective source. For arXiv: use format like '2506.21552' (without 'v' version suffix). For OpenAlex: use Work ID like 'W2741809807' (with or without 'https://openalex.org/' prefix). Get these IDs from fetch_latest or fetch_top_cited results.")
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