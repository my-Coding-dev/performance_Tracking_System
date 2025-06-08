// This is a simple JavaScript wrapper to run TypeScript code in production
require('dotenv').config();

// Register TypeScript compiler
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

// Import and run the TypeScript app
require('./src/Server.ts');

console.log('Server started via JavaScript wrapper'); 