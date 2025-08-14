/**
 * MCP Server Integration Tests
 * 
 * Tests that the MCP server properly exposes and executes all tools
 * This ensures the server works correctly for MCP clients
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { TEST_CONSTANTS } from '../setup.js';

describe('MCP Server Integration', () => {
  let serverProcess: ChildProcess;
  let serverReady = false;
  let serverOutput: string[] = [];
  let serverErrors: string[] = [];

  // Start MCP server before tests
  beforeAll(async () => {
    console.log('🚀 Starting MCP server for integration tests...');
    
    const serverPath = join(process.cwd(), 'dist', 'server.js');
    
    // Start server in MCP mode (no command line args = MCP mode)
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    // Capture server output
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      serverOutput.push(output);
      console.log('📤 Server stdout:', output.trim());
    });

    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      serverErrors.push(error);
      console.log('📥 Server stderr:', error.trim());
    });

    serverProcess.on('error', (error) => {
      console.error('❌ Server process error:', error);
    });

    // Give server time to start
    await testUtils.delay(2000);
    serverReady = true;
  }, TEST_CONSTANTS.SLOW_TIMEOUT);

  // Clean up server after tests
  afterAll(() => {
    if (serverProcess && !serverProcess.killed) {
      console.log('🛑 Stopping MCP server...');
      serverProcess.kill('SIGTERM');
      
      // Force kill if needed
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  });

  test('MCP server starts without errors', () => {
    expect(serverReady).toBe(true);
    expect(serverProcess).toBeDefined();
    expect(serverProcess.killed).toBe(false);
    
    // Check that no critical errors occurred
    const criticalErrors = serverErrors.filter(error => 
      error.includes('Error') || error.includes('ENOENT') || error.includes('Cannot')
    );
    
    if (criticalErrors.length > 0) {
      console.error('Critical server errors:', criticalErrors);
    }
    
    expect(criticalErrors.length).toBe(0);
  });

  test('MCP server responds to tool calls via stdio', async () => {
    if (!serverProcess || !serverProcess.stdin || !serverProcess.stdout) {
      throw new Error('Server process not properly initialized');
    }

    // Test list_categories tool via MCP protocol
    const listCategoriesRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_categories',
        arguments: {
          source: 'arxiv'
        }
      }
    };

    // Send request to server
    const requestStr = JSON.stringify(listCategoriesRequest) + '\n';
    console.log('📤 Sending MCP request:', requestStr.trim());
    
    serverProcess.stdin.write(requestStr);

    // Wait for response and capture it
    await testUtils.delay(3000);
    
    // Check if we got any output
    expect(serverOutput.length).toBeGreaterThan(0);
    
    // Look for JSON responses in the output
    const jsonResponses = serverOutput
      .join('')
      .split('\n')
      .filter(line => line.trim().startsWith('{'))
      .map(line => {
        try {
          return JSON.parse(line.trim());
        } catch {
          return null;
        }
      })
      .filter(obj => obj !== null);

    console.log('📥 Server JSON responses:', jsonResponses);
    
    // We should have received at least one JSON response
    expect(jsonResponses.length).toBeGreaterThan(0);
    
  }, TEST_CONSTANTS.SLOW_TIMEOUT);

  test('fetch_pdf_content tool is available via MCP', async () => {
    if (!serverProcess || !serverProcess.stdin) {
      throw new Error('Server process not properly initialized');
    }

    // Test the fetch_pdf_content tool
    const pdfRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'fetch_pdf_content',
        arguments: {
          url: 'https://arxiv.org/pdf/2305.11176.pdf',
          maxSizeMB: 10,
          maxPages: 20,
          confirmLargeFiles: false
        }
      }
    };

    const requestStr = JSON.stringify(pdfRequest) + '\n';
    console.log('📤 Testing PDF extraction via MCP:', requestStr.trim());
    
    // Clear previous output
    serverOutput.length = 0;
    
    serverProcess.stdin.write(requestStr);

    // Wait longer for PDF processing
    await testUtils.delay(15000);
    
    // Check the responses
    const responses = serverOutput.join('').split('\n')
      .filter(line => line.trim().startsWith('{'))
      .map(line => {
        try {
          return JSON.parse(line.trim());
        } catch {
          return null;
        }
      })
      .filter(obj => obj !== null);

    console.log('📥 PDF extraction responses:', responses);
    
    // We should have received a response
    expect(responses.length).toBeGreaterThan(0);
    
    // Look for a successful response
    const successResponse = responses.find(r => 
      r.id === 2 && 
      r.result && 
      typeof r.result === 'string' &&
      r.result.includes('Successfully extracted')
    );
    
    if (!successResponse) {
      // Look for error responses
      const errorResponse = responses.find(r => r.id === 2 && r.error);
      if (errorResponse) {
        console.error('❌ PDF extraction error:', errorResponse.error);
        throw new Error(`PDF extraction failed: ${errorResponse.error.message}`);
      }
      
      console.warn('⚠️ No clear success or error response found');
      console.log('All responses:', responses);
    }
    
    expect(successResponse).toBeDefined();
    
  }, 60000); // Longer timeout for PDF processing

  test('fetch_top_cited tool works via MCP', async () => {
    if (!serverProcess || !serverProcess.stdin) {
      throw new Error('Server process not properly initialized');
    }

    // Test the fetch_top_cited tool
    const topCitedRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'fetch_top_cited',
        arguments: {
          concept: 'machine learning',
          since: '2020-01-01',
          count: 3
        }
      }
    };

    const requestStr = JSON.stringify(topCitedRequest) + '\n';
    console.log('📤 Testing fetch_top_cited via MCP:', requestStr.trim());
    
    // Clear previous output
    serverOutput.length = 0;
    
    serverProcess.stdin.write(requestStr);

    // Wait for response
    await testUtils.delay(8000);
    
    const responses = serverOutput.join('').split('\n')
      .filter(line => line.trim().startsWith('{'))
      .map(line => {
        try {
          return JSON.parse(line.trim());
        } catch {
          return null;
        }
      })
      .filter(obj => obj !== null);

    console.log('📥 fetch_top_cited responses:', responses);
    
    // Look for successful response
    const successResponse = responses.find(r => 
      r.id === 4 && 
      r.result && 
      r.result.content && 
      Array.isArray(r.result.content) &&
      r.result.content.some((item: any) => item.type === 'text' && item.text.includes('Found'))
    );
    
    if (!successResponse) {
      const errorResponse = responses.find(r => r.id === 4 && r.error);
      if (errorResponse) {
        console.error('❌ fetch_top_cited error:', errorResponse.error);
        throw new Error(`fetch_top_cited failed: ${errorResponse.error.message}`);
      }
      
      console.warn('⚠️ No clear success response for fetch_top_cited');
      console.log('All responses:', responses);
    }
    
    expect(successResponse).toBeDefined();
    
  }, TEST_CONSTANTS.SLOW_TIMEOUT);

  test('search_papers tool works via MCP', async () => {
    if (!serverProcess || !serverProcess.stdin) {
      throw new Error('Server process not properly initialized');
    }

    // Test the search_papers tool
    const searchRequest = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'search_papers',
        arguments: {
          source: 'arxiv',
          query: 'transformer neural network',
          field: 'title',
          count: 3,
          sortBy: 'relevance'
        }
      }
    };

    const requestStr = JSON.stringify(searchRequest) + '\n';
    console.log('📤 Testing search_papers via MCP:', requestStr.trim());
    
    // Clear previous output
    serverOutput.length = 0;
    
    serverProcess.stdin.write(requestStr);

    // Wait for response
    await testUtils.delay(6000);
    
    const responses = serverOutput.join('').split('\n')
      .filter(line => line.trim().startsWith('{'))
      .map(line => {
        try {
          return JSON.parse(line.trim());
        } catch {
          return null;
        }
      })
      .filter(obj => obj !== null);

    console.log('📥 search_papers responses:', responses);
    
    // Look for successful response
    const successResponse = responses.find(r => 
      r.id === 5 && 
      r.result && 
      r.result.content && 
      Array.isArray(r.result.content) &&
      r.result.content.some((item: any) => item.type === 'text' && item.text.includes('Found'))
    );
    
    if (!successResponse) {
      const errorResponse = responses.find(r => r.id === 5 && r.error);
      if (errorResponse) {
        console.error('❌ search_papers error:', errorResponse.error);
        throw new Error(`search_papers failed: ${errorResponse.error.message}`);
      }
      
      console.warn('⚠️ No clear success response for search_papers');
      console.log('All responses:', responses);
    }
    
    expect(successResponse).toBeDefined();
    
  }, TEST_CONSTANTS.SLOW_TIMEOUT);

  test('all expected MCP tools are available', async () => {
    if (!serverProcess || !serverProcess.stdin) {
      throw new Error('Server process not properly initialized');
    }

    // Test tools/list to get available tools
    const toolsListRequest = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/list',
      params: {}
    };

    const requestStr = JSON.stringify(toolsListRequest) + '\n';
    console.log('📤 Requesting tools list:', requestStr.trim());
    
    // Clear previous output
    serverOutput.length = 0;
    
    serverProcess.stdin.write(requestStr);
    await testUtils.delay(2000);
    
    const responses = serverOutput.join('').split('\n')
      .filter(line => line.trim().startsWith('{'))
      .map(line => {
        try {
          return JSON.parse(line.trim());
        } catch {
          return null;
        }
      })
      .filter(obj => obj !== null);

    console.log('📥 Tools list responses:', responses);
    
    const toolsResponse = responses.find(r => r.id === 6 && r.result && r.result.tools);
    
    if (!toolsResponse) {
      console.error('❌ No tools list response found');
      console.log('All responses:', responses);
      throw new Error('Failed to get tools list from MCP server');
    }
    
    const tools = toolsResponse.result.tools;
    const toolNames = tools.map((tool: any) => tool.name);
    
    console.log('🔧 Available MCP tools:', toolNames);
    
    // Verify all expected tools are present
    const expectedTools = [
      'list_categories',
      'fetch_latest', 
      'fetch_content',
      'fetch_top_cited',
      'search_papers',
      'fetch_pdf_content'
    ];
    
    for (const expectedTool of expectedTools) {
      expect(toolNames).toContain(expectedTool);
    }
    
    // Verify tool schemas exist
    const fetchTopCitedTool = tools.find((tool: any) => tool.name === 'fetch_top_cited');
    expect(fetchTopCitedTool).toBeDefined();
    expect(fetchTopCitedTool.description).toBeDefined();
    expect(fetchTopCitedTool.inputSchema).toBeDefined();
    expect(fetchTopCitedTool.inputSchema.properties.concept).toBeDefined();
    expect(fetchTopCitedTool.inputSchema.properties.since).toBeDefined();
    
    const searchPapersTool = tools.find((tool: any) => tool.name === 'search_papers');
    expect(searchPapersTool).toBeDefined();
    expect(searchPapersTool.description).toBeDefined();
    expect(searchPapersTool.inputSchema).toBeDefined();
    expect(searchPapersTool.inputSchema.properties.source).toBeDefined();
    expect(searchPapersTool.inputSchema.properties.query).toBeDefined();
    
    const pdfTool = tools.find((tool: any) => tool.name === 'fetch_pdf_content');
    expect(pdfTool).toBeDefined();
    expect(pdfTool.description).toBeDefined();
    expect(pdfTool.inputSchema).toBeDefined();
    expect(pdfTool.inputSchema.properties.url).toBeDefined();
    
    console.log('✅ All expected tools are available with proper schemas');
    
  }, TEST_CONSTANTS.MEDIUM_TIMEOUT);
});