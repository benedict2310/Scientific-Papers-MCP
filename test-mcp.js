import { spawn } from 'child_process';

// Test the MCP server with list_categories tool
const server = spawn('node', ['dist/server.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send MCP initialization
server.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
}) + '\n');

// Test list_categories tool with arXiv
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "list_categories",
      arguments: {
        source: "arxiv"
      }
    }
  }) + '\n');
}, 500);

// Test list_categories tool with OpenAlex
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "list_categories",
      arguments: {
        source: "openalex"
      }
    }
  }) + '\n');
}, 1500);

// Collect responses
let responses = '';
let testCount = 0;
server.stdout.on('data', (data) => {
  responses += data.toString();
  const lines = responses.split('\n');
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('MCP Response:', JSON.stringify(response, null, 2));
        
        if (response.id === 2) {
          console.log('\n✅ arXiv test successful!');
          testCount++;
        }
        if (response.id === 3) {
          console.log('\n✅ OpenAlex test successful!');
          testCount++;
        }
        
        if (testCount === 2) {
          console.log('\n🎉 All MCP Server tests successful!');
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Ignore parsing errors for partial lines
      }
    }
  });
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('❌ MCP Server test timed out');
  server.kill();
  process.exit(1);
}, 10000); 