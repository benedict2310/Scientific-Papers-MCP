import { spawn } from 'child_process';

// Test the MCP server with tools/list method
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
      name: "debug-client",
      version: "1.0.0"
    }
  }
}) + '\n');

// Test tools/list method
setTimeout(() => {
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  }) + '\n');
}, 500);

// Collect responses
let responses = '';
server.stdout.on('data', (data) => {
  responses += data.toString();
  const lines = responses.split('\n');
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('MCP Response for method', response.id === 1 ? 'initialize' : 'tools/list');
        console.log(JSON.stringify(response, null, 2));
        console.log('---');
        
        if (response.id === 2) {
          console.log('\n✅ Tools list test complete!');
          server.kill();
          process.exit(0);
        }
      } catch (e) {
        // Ignore parsing errors for partial lines
      }
    }
  });
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('❌ Debug test timed out');
  server.kill();
  process.exit(1);
}, 5000); 