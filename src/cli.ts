#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { listCategories } from './tools/list-categories.js';
import { fetchLatest } from './tools/fetch-latest.js';
import { fetchTopCited } from './tools/fetch-top-cited.js';
import { fetchContent } from './tools/fetch-content.js';
import { searchPapers } from './tools/search-papers.js';
import { RateLimiter } from './core/rate-limiter.js';
import { logInfo, logError } from './core/logger.js';

interface CLIOptions {
  command: string;
  source?: string;
  category?: string;
  concept?: string;
  since?: string;
  id?: string;
  query?: string;
  field?: string;
  sortBy?: string;
  count?: number;
  showText?: boolean;
  textPreview?: number;
  help?: boolean;
}

// Create a single rate limiter instance for CLI usage
const rateLimiter = new RateLimiter();

/**
 * Helper function to display text content with optional preview
 */
function displayTextContent(paper: any, showText: boolean, textPreview?: number) {
  // Show text extraction warnings if any
  if (paper.textExtractionFailed) {
    console.log(`   ⚠️  Text extraction failed`);
  }
  if (paper.textTruncated) {
    console.log(`   ⚠️  Text was truncated due to size limits`);
  }

  // Show text content if requested
  if (showText && paper.text) {
    const textToShow = textPreview && paper.text.length > textPreview 
      ? paper.text.substring(0, textPreview) + '...'
      : paper.text;
    
    console.log(`   📝 Text Content (${paper.text.length} characters):`);
    console.log(`   ${textToShow.split('\n').join('\n   ')}`);
  
  } else {
    console.log(`   📝 No text content available`);
  }
}

function printUsage() {
  console.log(`
Usage: latest-science-mcp <command> [options]

Commands:
  list-categories     List available categories from a source
  fetch-latest        Fetch latest papers from a source and category
  fetch-top-cited     Fetch top cited papers from OpenAlex for a concept since a date
  fetch-content       Fetch full metadata for a specific paper by ID
  search-papers       Search papers from a source with query and field filtering

Options:
  --source <source>     Data source: arxiv, openalex, pmc, europepmc, biorxiv, core
  --category <category> Category or concept to search for
  --concept <concept>   Concept or field to search for (OpenAlex only)
  --since <date>        Start date in YYYY-MM-DD format
  --id <id>             Paper ID (arXiv ID like '2401.12345' or OpenAlex Work ID)
  --query <query>       Search query (max 1500 characters)
  --field <field>       Search field: all, title, abstract, author, fulltext
  --sort-by <sort>      Sort order: relevance, date, citations (availability varies)
  --count <number>      Number of papers to fetch (default: 50, max: 200)
  --show-text           Show text content of the paper
  --text-preview <num>  Number of characters to preview in text content
  --help, -h            Show this help message

Examples:
  latest-science-mcp list-categories --source=arxiv
  latest-science-mcp list-categories --source=openalex
  latest-science-mcp fetch-latest --source=arxiv --category=cs.AI --count=10
  latest-science-mcp fetch-latest --source=openalex --category="artificial intelligence" --count=5
  latest-science-mcp fetch-top-cited --concept="machine learning" --since=2024-01-01 --count=20
  latest-science-mcp fetch-content --source=arxiv --id=2401.12345
  latest-science-mcp fetch-content --source=openalex --id=W2741809807
  latest-science-mcp search-papers --source=arxiv --query="neural networks" --field=title --count=10
  latest-science-mcp search-papers --source=openalex --query="machine learning" --field=all --sort-by=citations
`);
}

async function runCLI() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        source: {
          type: 'string',
          short: 's'
        },
        category: {
          type: 'string',
          short: 'c'
        },
        concept: {
          type: 'string'
        },
        since: {
          type: 'string'
        },
        id: {
          type: 'string'
        },
        query: {
          type: 'string',
          short: 'q'
        },
        field: {
          type: 'string',
          short: 'f'
        },
        sortBy: {
          type: 'string'
        },
        count: {
          type: 'string'
        },
        showText: {
          type: 'boolean',
          short: 't'
        },
        textPreview: {
          type: 'string'
        },
        help: {
          type: 'boolean',
          short: 'h'
        }
      },
      allowPositionals: true
    });

    const options: CLIOptions = {
      command: positionals[0] || '',
      source: values.source,
      category: values.category,
      concept: values.concept,
      since: values.since,
      id: values.id,
      query: values.query,
      field: values.field,
      sortBy: values.sortBy,
      count: values.count ? parseInt(values.count, 10) : undefined,
      showText: values.showText,
      textPreview: values.textPreview ? parseInt(values.textPreview, 10) : undefined,
      help: values.help
    };

    if (options.help || !options.command) {
      printUsage();
      return;
    }

    switch (options.command) {
      case 'list-categories':
        await handleListCategories(options);
        break;
      case 'fetch-latest':
        await handleFetchLatest(options);
        break;
      case 'fetch-top-cited':
        await handleFetchTopCited(options);
        break;
      case 'fetch-content':
        await handleFetchContent(options);
        break;
      case 'search-papers':
        await handleSearchPapers(options);
        break;
      default:
        console.error(`Unknown command: ${options.command}`);
        printUsage();
        process.exit(1);
    }

  } catch (error) {
    logError('CLI error', { error: error instanceof Error ? error.message : error });
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleListCategories(options: CLIOptions) {
  if (!options.source) {
    console.error('Error: --source is required for list-categories command');
    console.error('Valid sources: arxiv, openalex, pmc, europepmc, biorxiv, core');
    process.exit(1);
  }

  if (options.source !== 'arxiv' && options.source !== 'openalex' && options.source !== 'pmc' && options.source !== 'europepmc' && options.source !== 'biorxiv' && options.source !== 'core') {
    console.error(`Error: Invalid source "${options.source}". Valid sources: arxiv, openalex, pmc, europepmc, biorxiv, core`);
    process.exit(1);
  }

  logInfo('CLI command called', { command: 'list-categories', source: options.source });

  try {
    const result = await listCategories({ source: options.source });
    
    console.log(`\nFound ${result.categories.length} categories from ${result.source}:\n`);
    
    result.categories.forEach(category => {
      console.log(`📖 ${category.id}: ${category.name}`);
      if (category.description) {
        console.log(`   ${category.description}`);
      }
      console.log('');
    });

  } catch (error) {
    logError('Failed to list categories', { 
      source: options.source,
      error: error instanceof Error ? error.message : error 
    });
    console.error(`Error fetching categories from ${options.source}:`, 
      error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleFetchLatest(options: CLIOptions) {
  if (!options.source) {
    console.error('Error: --source is required for fetch-latest command');
    console.error('Valid sources: arxiv, openalex, pmc, europepmc, biorxiv, core');
    process.exit(1);
  }

  if (!options.category) {
    console.error('Error: --category is required for fetch-latest command');
    process.exit(1);
  }

  if (options.source !== 'arxiv' && options.source !== 'openalex' && options.source !== 'pmc' && options.source !== 'europepmc' && options.source !== 'biorxiv' && options.source !== 'core') {
    console.error(`Error: Invalid source "${options.source}". Valid sources: arxiv, openalex, pmc, europepmc, biorxiv, core`);
    process.exit(1);
  }

  const count = options.count || 50;

  logInfo('CLI command called', { command: 'fetch-latest', source: options.source, category: options.category, count });

  try {
    const result = await fetchLatest({
      source: options.source,
      category: options.category,
      count
    }, rateLimiter);
    
    console.log(`\nFound ${result.content.length} latest papers from ${options.source} in category "${options.category}":\n`);
    
    result.content.forEach((paper, index) => {
      console.log(`📄 ${index + 1}. ${paper.title}`);
      console.log(`   ID: ${paper.id}`);
      console.log(`   Authors: ${paper.authors.join(', ')}`);
      console.log(`   Date: ${paper.date}`);
      if (paper.pdf_url) {
        console.log(`   PDF: ${paper.pdf_url}`);
      }
      
      displayTextContent(paper, options.showText || false, options.textPreview);
      console.log('');
    });

  } catch (error) {
    logError('Failed to fetch latest papers', { 
      source: options.source,
      category: options.category,
      error: error instanceof Error ? error.message : error 
    });
    console.error(`Error fetching latest papers:`, 
      error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleFetchTopCited(options: CLIOptions) {
  if (!options.concept) {
    console.error('Error: --concept is required for fetch-top-cited command');
    process.exit(1);
  }

  if (!options.since) {
    console.error('Error: --since is required for fetch-top-cited command');
    console.error('Format: YYYY-MM-DD (e.g., 2024-01-01)');
    process.exit(1);
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.since)) {
    console.error('Error: --since must be in YYYY-MM-DD format');
    process.exit(1);
  }

  const count = options.count || 50;

  logInfo('CLI command called', { command: 'fetch-top-cited', concept: options.concept, since: options.since, count });

  try {
    const result = await fetchTopCited({
      concept: options.concept,
      since: options.since,
      count
    }, rateLimiter);
    
    console.log(`\nFound ${result.content.length} top cited papers for concept "${options.concept}" since ${options.since}:\n`);
    
    result.content.forEach((paper, index) => {
      console.log(`🏆 ${index + 1}. ${paper.title}`);
      console.log(`   ID: ${paper.id}`);
      console.log(`   Authors: ${paper.authors.join(', ')}`);
      console.log(`   Date: ${paper.date}`);
      if (paper.pdf_url) {
        console.log(`   PDF: ${paper.pdf_url}`);
      }
      
      displayTextContent(paper, options.showText || false, options.textPreview);
      console.log('');
    });

  } catch (error) {
    logError('Failed to fetch top cited papers', { 
      concept: options.concept,
      since: options.since,
      error: error instanceof Error ? error.message : error 
    });
    console.error(`Error fetching top cited papers:`, 
      error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleFetchContent(options: CLIOptions) {
  if (!options.source) {
    console.error('Error: --source is required for fetch-content command');
    console.error('Valid sources: arxiv, openalex, pmc, europepmc, biorxiv, core');
    process.exit(1);
  }

  if (!options.id) {
    console.error('Error: --id is required for fetch-content command');
    console.error('Examples: 2401.12345 (arXiv), W2741809807 (OpenAlex)');
    process.exit(1);
  }

  if (options.source !== 'arxiv' && options.source !== 'openalex' && options.source !== 'pmc' && options.source !== 'europepmc' && options.source !== 'biorxiv' && options.source !== 'core') {
    console.error(`Error: Invalid source "${options.source}". Valid sources: arxiv, openalex, pmc, europepmc, biorxiv, core`);
    process.exit(1);
  }

  logInfo('CLI command called', { command: 'fetch-content', source: options.source, id: options.id });

  try {
    const result = await fetchContent({
      source: options.source,
      id: options.id
    }, rateLimiter);
    
    const paper = result.content;
    
    console.log(`\nPaper details from ${options.source}:\n`);
    console.log(`📄 Title: ${paper.title}`);
    console.log(`🆔 ID: ${paper.id}`);
    console.log(`👥 Authors: ${paper.authors.join(', ')}`);
    console.log(`📅 Date: ${paper.date}`);
    if (paper.pdf_url) {
      console.log(`   🔗 PDF: ${paper.pdf_url}`);
    }
    console.log('');

    displayTextContent(paper, true, options.textPreview);

  } catch (error) {
    logError('Failed to fetch paper content', { 
      source: options.source,
      id: options.id,
      error: error instanceof Error ? error.message : error 
    });
    console.error(`Error fetching paper content:`, 
      error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function handleSearchPapers(options: CLIOptions) {
  if (!options.source) {
    console.error('Error: --source is required for search-papers command');
    console.error('Valid sources: arxiv, openalex, europepmc, core');
    process.exit(1);
  }

  if (!options.query) {
    console.error('Error: --query is required for search-papers command');
    console.error('Example: --query="machine learning"');
    process.exit(1);
  }

  if (options.source !== 'arxiv' && options.source !== 'openalex' && options.source !== 'europepmc' && options.source !== 'core') {
    console.error(`Error: Invalid source "${options.source}". Valid sources: arxiv, openalex, europepmc, core`);
    process.exit(1);
  }

  const field = options.field || 'all';
  const sortBy = options.sortBy || 'relevance';
  const count = options.count || 50;

  // Validate field
  const validFields = ['all', 'title', 'abstract', 'author', 'fulltext'];
  if (!validFields.includes(field)) {
    console.error(`Error: Invalid field "${field}". Valid fields: ${validFields.join(', ')}`);
    process.exit(1);
  }

  // Validate sortBy
  const validSortBy = ['relevance', 'date', 'citations'];
  if (!validSortBy.includes(sortBy)) {
    console.error(`Error: Invalid sort order "${sortBy}". Valid options: ${validSortBy.join(', ')}`);
    process.exit(1);
  }

  logInfo('CLI command called', { command: 'search-papers', source: options.source, query: options.query, field, sortBy, count });

  try {
    const result = await searchPapers({
      source: options.source as 'arxiv' | 'openalex' | 'europepmc' | 'core',
      query: options.query,
      field: field as 'all' | 'title' | 'abstract' | 'author' | 'fulltext',
      sortBy: sortBy as 'relevance' | 'date' | 'citations',
      count
    }, rateLimiter);
    
    console.log(`\nFound ${result.content.length} papers from ${options.source} for query "${options.query}" in ${field} field:\n`);
    
    result.content.forEach((paper, index) => {
      console.log(`🔍 ${index + 1}. ${paper.title}`);
      console.log(`   ID: ${paper.id}`);
      console.log(`   Authors: ${paper.authors.join(', ')}`);
      console.log(`   Date: ${paper.date}`);
      if (paper.pdf_url) {
        console.log(`   PDF: ${paper.pdf_url}`);
      }
      
      displayTextContent(paper, options.showText || false, options.textPreview);
      console.log('');
    });

  } catch (error) {
    logError('Failed to search papers', { 
      source: options.source,
      query: options.query,
      field,
      sortBy,
      error: error instanceof Error ? error.message : error 
    });
    console.error(`Error searching papers:`, 
      error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Export runCLI for conditional execution from server.ts
export { runCLI }; 