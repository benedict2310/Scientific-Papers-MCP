import { spawn } from 'child_process';

const startTime = Date.now();
console.log('🚀 Starting MCP server...');

// Test the MCP server startup time
const server = spawn('node', ['dist/server.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;

// Listen for stderr output (our server logs)
server.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('Server stderr:', output.trim());
  
  if (output.includes('started successfully')) {
    const readyTime = Date.now() - startTime;
    console.log(`✅ Server ready in ${readyTime}ms`);
    serverReady = true;
    
    // Now test initialization
    console.log('📡 Testing MCP initialization...');
    testInitialization();
  }
});

// Test MCP initialization
function testInitialization() {
  const initStart = Date.now();
  
  server.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "startup-test",
        version: "1.0.0"
      }
    }
  }) + '\n');
  
  let responses = '';
  server.stdout.on('data', (data) => {
    responses += data.toString();
    const lines = responses.split('\n');
    
    lines.forEach(line => {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          if (response.id === 1) {
            const initTime = Date.now() - initStart;
            console.log(`✅ MCP initialization completed in ${initTime}ms`);
            console.log('🎉 Server startup test successful!');
            
            const totalTime = Date.now() - startTime;
            console.log(`📊 Total time: ${totalTime}ms`);
            
            server.kill();
            process.exit(0);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
  });
}

// Timeout after 10 seconds
setTimeout(() => {
  if (!serverReady) {
    console.log('❌ Server startup timed out after 10 seconds');
  } else {
    console.log('❌ MCP initialization timed out');
  }
  server.kill();
  process.exit(1);
}, 10000);

// Handle server errors
server.on('error', (error) => {
  console.log('❌ Server error:', error.message);
  process.exit(1);
});

server.on('exit', (code, signal) => {
  if (code !== 0) {
    console.log(`❌ Server exited with code ${code}, signal ${signal}`);
  }
}); 