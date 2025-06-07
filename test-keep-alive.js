// Script to test the keep-alive functionality
require('dotenv').config();
const axios = require('axios');

// Set environment variables for testing
process.env.KEEP_ALIVE_ENABLED = 'true';
process.env.KEEP_ALIVE_INTERVAL_MINUTES = '1'; // 1 minute for testing
process.env.KEEP_ALIVE_URL = 'http://localhost:5000/api/v1/health/ping';

// Create a mock server to respond to ping requests
const http = require('http');
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] Received request: ${req.method} ${req.url}`);
  
  // Log headers
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Respond with a simple JSON message
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'alive',
    timestamp: new Date().toISOString(),
    message: 'This is the ping endpoint responding'
  }));
});

// Import the keep-alive service (we need to use require syntax for JS)
async function runTest() {
  try {
    // Start the mock server
    const PORT = 5000;
    server.listen(PORT, () => {
      console.log(`Mock server running at http://localhost:${PORT}`);
      console.log(`Ping endpoint: http://localhost:${PORT}/api/v1/health/ping`);
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dynamically import the KeepAliveService (compiled from TypeScript)
    console.log('Loading keep-alive service...');
    // This is a trick to load the keep-alive service even though it's a TypeScript file
    // We rely on the fact that it's compiled to JavaScript in the dist directory
    const keepAlivePath = './dist/utils/keepAlive.js';
    console.log(`Looking for keep-alive service at: ${keepAlivePath}`);
    
    try {
      const keepAliveService = require(keepAlivePath).default;
      
      // Start the keep-alive service
      console.log('Starting keep-alive service...');
      keepAliveService.start();
      
      // Keep the script running for a while to observe pings
      console.log('Test running. Will automatically exit after 5 minutes.');
      console.log('Press Ctrl+C to stop the test earlier.');
      
      // Exit after 5 minutes
      setTimeout(() => {
        console.log('Test completed. Stopping services...');
        keepAliveService.stop();
        server.close();
        process.exit(0);
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error('Failed to load keep-alive service:', error.message);
      console.log('Trying to ping manually instead...');
      
      // Manually send a ping request
      setInterval(async () => {
        try {
          console.log(`[${new Date().toISOString()}] Sending manual ping...`);
          const response = await axios.get('http://localhost:5000/api/v1/health/ping', {
            headers: {
              'User-Agent': 'KeepAliveService/1.0',
              'X-Keep-Alive': 'true'
            }
          });
          console.log('Ping successful:', response.status, response.statusText);
        } catch (error) {
          console.error('Ping failed:', error.message);
        }
      }, 60 * 1000); // Every minute
    }
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTest(); 