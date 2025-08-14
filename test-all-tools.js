#!/usr/bin/env node

/**
 * Comprehensive MCP Tools Test Script
 * Tests all available MCP tools systematically
 */

import { spawn } from 'child_process';
import { join } from 'path';

console.log('🧪 Comprehensive MCP Tools Testing...\n');

const serverPath = join(process.cwd(), 'dist', 'server.js');
let testQueue = [];
let currentTest = 0;
let results = [];

// Define all test cases
const testCases = [
  // 1. list_categories tests
  {
    name: 'list_categories - arXiv',
    tool: 'list_categories',
    args: { source: 'arxiv' },
    timeout: 15000
  },
  {
    name: 'list_categories - OpenAlex',
    tool: 'list_categories', 
    args: { source: 'openalex' },
    timeout: 15000
  },
  {
    name: 'list_categories - PMC',
    tool: 'list_categories',
    args: { source: 'pmc' },
    timeout: 15000
  },
  {
    name: 'list_categories - Europe PMC',
    tool: 'list_categories',
    args: { source: 'europepmc' },
    timeout: 15000
  },
  {
    name: 'list_categories - bioRxiv',
    tool: 'list_categories',
    args: { source: 'biorxiv' },
    timeout: 15000
  },
  {
    name: 'list_categories - CORE',
    tool: 'list_categories',
    args: { source: 'core' },
    timeout: 15000
  },
  
  // 2. fetch_latest tests
  {
    name: 'fetch_latest - arXiv AI',
    tool: 'fetch_latest',
    args: { source: 'arxiv', category: 'cs.AI', count: 3 },
    timeout: 20000
  },
  {
    name: 'fetch_latest - OpenAlex ML',
    tool: 'fetch_latest',
    args: { source: 'openalex', category: 'C41008148', count: 3 },
    timeout: 20000
  },
  {
    name: 'fetch_latest - bioRxiv biology',
    tool: 'fetch_latest',
    args: { source: 'biorxiv', category: 'biorxiv:biology', count: 2 },
    timeout: 20000
  },
  
  // 3. search_papers tests
  {
    name: 'search_papers - arXiv neural networks',
    tool: 'search_papers',
    args: { source: 'arxiv', query: 'neural networks', field: 'title', count: 3 },
    timeout: 25000
  },
  {
    name: 'search_papers - OpenAlex AI',
    tool: 'search_papers',
    args: { source: 'openalex', query: 'artificial intelligence', field: 'all', count: 3 },
    timeout: 25000
  },
  
  // 4. fetch_top_cited test
  {
    name: 'fetch_top_cited - ML papers',
    tool: 'fetch_top_cited',
    args: { concept: 'C41008148', since: '2024-01-01', count: 3 },
    timeout: 25000
  },
  
  // 5. fetch_content tests
  {
    name: 'fetch_content - arXiv paper',
    tool: 'fetch_content',
    args: { source: 'arxiv', paper_id: '2305.11176' },
    timeout: 30000
  },
  {
    name: 'fetch_content - OpenAlex paper',
    tool: 'fetch_content', 
    args: { source: 'openalex', paper_id: 'W2741809807' },
    timeout: 30000
  },
  
  // 6. fetch_pdf_content test
  {
    name: 'fetch_pdf_content - arXiv PDF',
    tool: 'fetch_pdf_content',
    args: { 
      url: 'https://arxiv.org/pdf/2305.11176.pdf',
      maxSizeMB: 5,
      maxPages: 10,
      confirmLargeFiles: false
    },
    timeout: 45000
  }
];

function startServer() {
  return new Promise((resolve) => {
    console.log('🚀 Starting MCP Server...\n');
    
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverOutput = '';
    let serverReady = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      
      if (output.includes('Server is ready') && !serverReady) {
        serverReady = true;
        resolve({ serverProcess, serverOutput });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.log('📥 Server error:', data.toString().trim());
    });

    setTimeout(() => {
      if (!serverReady) {
        console.log('⚠️  Server ready timeout, proceeding anyway...');
        resolve({ serverProcess, serverOutput });
      }
    }, 5000);
  });
}

async function runTest(testCase, serverProcess) {
  return new Promise((resolve) => {
    console.log(`\n📋 Test ${currentTest + 1}/${testCases.length}: ${testCase.name}`);
    console.log(`🔧 Tool: ${testCase.tool}`);
    console.log(`📝 Args:`, JSON.stringify(testCase.args, null, 2));
    
    const testRequest = {
      jsonrpc: '2.0',
      id: currentTest + 1,
      method: 'tools/call',
      params: {
        name: testCase.tool,
        arguments: testCase.args
      }
    };

    let testOutput = '';
    let responseReceived = false;
    
    const outputHandler = (data) => {
      const output = data.toString();
      testOutput += output;
      
      // Look for JSON response with our test ID
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.id === currentTest + 1) {
              responseReceived = true;
              
              if (parsed.error) {
                console.log(`❌ Error: ${parsed.error.message}`);
                results.push({
                  name: testCase.name,
                  status: 'error',
                  error: parsed.error.message
                });
              } else if (parsed.result) {
                console.log(`✅ Success: ${parsed.result.content?.[0]?.text || 'Response received'}`);
                results.push({
                  name: testCase.name,
                  status: 'success',
                  result: parsed.result
                });
              }
              
              serverProcess.stdout.removeListener('data', outputHandler);
              resolve();
              return;
            }
          } catch (e) {
            // Not valid JSON, continue
          }
        }
      }
    };

    serverProcess.stdout.on('data', outputHandler);
    
    // Send the test request
    serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');
    
    // Timeout handler
    setTimeout(() => {
      if (!responseReceived) {
        console.log(`⏰ Timeout after ${testCase.timeout}ms`);
        results.push({
          name: testCase.name,
          status: 'timeout',
          error: `Timeout after ${testCase.timeout}ms`
        });
        serverProcess.stdout.removeListener('data', outputHandler);
        resolve();
      }
    }, testCase.timeout);
  });
}

async function runAllTests() {
  const { serverProcess, serverOutput } = await startServer();
  
  console.log('📊 Running all test cases...\n');
  
  for (let i = 0; i < testCases.length; i++) {
    currentTest = i;
    await runTest(testCases[i], serverProcess);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.status === 'success').length;
  const errors = results.filter(r => r.status === 'error').length;
  const timeouts = results.filter(r => r.status === 'timeout').length;
  
  console.log(`✅ Successful: ${successful}/${testCases.length}`);
  console.log(`❌ Errors: ${errors}/${testCases.length}`);
  console.log(`⏰ Timeouts: ${timeouts}/${testCases.length}`);
  
  console.log('\nDetailed Results:');
  results.forEach((result, i) => {
    const status = result.status === 'success' ? '✅' : 
                  result.status === 'error' ? '❌' : '⏰';
    console.log(`${status} ${i + 1}. ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Clean shutdown
  console.log('\n🛑 Shutting down server...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

// Run all tests
runAllTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});