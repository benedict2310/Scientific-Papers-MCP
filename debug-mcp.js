#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🔍 Testing MCP Server via npx...\n');

// Test 1: Run via npx and see what happens
console.log('1️⃣ Testing: npx -y @futurelab-studio/latest-science-mcp');
const npxProcess = spawn('npx', ['-y', '@futurelab-studio/latest-science-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let npxOutput = '';
let npxError = '';

npxProcess.stdout.on('data', (data) => {
  npxOutput += data.toString();
  console.log('📤 STDOUT:', data.toString());
});

npxProcess.stderr.on('data', (data) => {
  npxError += data.toString();
  console.log('📢 STDERR:', data.toString());
});

npxProcess.on('close', (code) => {
  console.log(`\n✅ npx process exited with code: ${code}`);
  console.log(`📋 Total STDOUT: "${npxOutput}"`);
  console.log(`📋 Total STDERR: "${npxError}"`);
  
  // Now test sending an MCP initialize message
  console.log('\n2️⃣ Testing: Send MCP initialize message via npx');
  testMcpProtocol();
});

function testMcpProtocol() {
  const mcpProcess = spawn('npx', ['-y', '@futurelab-studio/latest-science-mcp'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let mcpOutput = '';
  let mcpError = '';
  let processExited = false;

  mcpProcess.stdout.on('data', (data) => {
    mcpOutput += data.toString();
    console.log('📤 MCP STDOUT:', data.toString());
  });

  mcpProcess.stderr.on('data', (data) => {
    mcpError += data.toString();
    console.log('📢 MCP STDERR:', data.toString());
  });

  mcpProcess.on('close', (code) => {
    processExited = true;
    console.log(`\n✅ MCP process exited with code: ${code}`);
    console.log(`📋 Total MCP STDOUT: "${mcpOutput}"`);
    console.log(`📋 Total MCP STDERR: "${mcpError}"`);
    
    if (code !== 0) {
      console.log('❌ Process exited with non-zero code - this explains the connection closed error!');
    }
  });

  // Send MCP initialize message
  const initMessage = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "debug-test",
        version: "1.0.0"
      }
    }
  }) + '\n';

  console.log('📨 Sending initialize message:', initMessage);
  mcpProcess.stdin.write(initMessage);

  // Wait for response or timeout
  setTimeout(() => {
    if (!processExited) {
      console.log('⏰ Process still running after 3 seconds - this is good!');
      mcpProcess.kill('SIGTERM');
    }
  }, 3000);
} 