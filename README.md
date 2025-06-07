# Performance Tracking System - Backend

This is the backend API for the Performance Tracking System, built with Node.js, Express, and TypeScript.

## Requirements

- Node.js 18+
- npm or yarn

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   NODE_ENV=development
   PORT=5000
   CORS_ORIGIN=http://localhost:3000
   LOG_LEVEL=debug
   ```

## Available Scripts

- `npm run dev`: Starts the server in development mode with hot reloading
- `npm run build`: Compiles TypeScript to JavaScript
- `npm start`: Starts the server in production mode
- `npm run lint`: Runs ESLint to check code quality

## Project Structure

```
src/
├── config/       # Configuration files
├── controllers/  # Request handlers
├── middlewares/  # Express middlewares
├── models/       # Data models
├── routes/       # API routes
├── utils/        # Utility functions
└── Server.ts     # Entry point
```

## API Documentation

API documentation will be available at `/api-docs` when the server is running. 