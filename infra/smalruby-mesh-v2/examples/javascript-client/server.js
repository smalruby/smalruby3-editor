/**
 * Simple Express server for Mesh v2 JavaScript client prototype
 * Serves static files for the prototype web application
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(__dirname));

// Default route serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mesh v2 client server running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  Mesh v2 JavaScript Client Prototype                      ║
╚════════════════════════════════════════════════════════════╝

Server running at: http://localhost:${PORT}

Usage:
  - Open http://localhost:${PORT} in your browser
  - Use ?mesh=domain parameter for custom domain
  - Example: http://localhost:${PORT}?mesh=test-domain

Press Ctrl+C to stop the server
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
