#!/usr/bin/env node

/**
 * Quick MCP PDF Test Script
 * Tests fetch_pdf_content tool via direct MCP protocol
 */

import { spawn } from 'child_process';
import { join } from 'path';

console.log('🧪 Testing MCP PDF extraction...');

const serverPath = join(process.cwd(), 'dist', 'server.js');
const serverProcess = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverOutput = '';
let serverReady = false;

// Capture server output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📤 Server:', output.trim());
  serverOutput += output;
  
  // Check if server is ready
  if (output.includes('Server is ready')) {
    serverReady = true;
    testPdfExtraction();
  }
});

serverProcess.stderr.on('data', (data) => {
  console.log('📥 Server error:', data.toString().trim());
});

serverProcess.on('error', (error) => {
  console.error('❌ Process error:', error);
});

async function testPdfExtraction() {
  console.log('🚀 Server ready, testing PDF extraction...');
  
  // Test with a small, simple PDF
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'fetch_pdf_content',
      arguments: {
        url: 'https://arxiv.org/pdf/2305.11176.pdf',
        maxSizeMB: 5,
        maxPages: 10,
        timeout: 30,
        confirmLargeFiles: false
      }
    }
  };

  console.log('📤 Sending PDF request:', JSON.stringify(testRequest, null, 2));
  
  serverProcess.stdin.write(JSON.stringify(testRequest) + '\n');
  
  // Wait for response
  setTimeout(() => {
    console.log('⏰ 30 seconds elapsed, analyzing output...');
    
    // Look for JSON responses
    const lines = serverOutput.split('\n');
    const jsonResponses = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(line.trim());
          if (parsed.id === 1) {
            jsonResponses.push(parsed);
          }
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    }
    
    console.log('📥 JSON responses found:', jsonResponses.length);
    
    if (jsonResponses.length > 0) {
      console.log('✅ Response received:');
      for (const response of jsonResponses) {
        console.log(JSON.stringify(response, null, 2));
      }
    } else {
      console.log('❌ No JSON response found');
      console.log('Raw server output length:', serverOutput.length);
      console.log('Last 500 chars:', serverOutput.slice(-500));
    }
    
    // Clean shutdown
    serverProcess.kill('SIGTERM');
    process.exit(0);
    
  }, 30000);
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
});