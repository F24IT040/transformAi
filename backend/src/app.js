const express = require('express');
const cors = require('cors');
require('dotenv').config();

const contentRoutes = require('./routes/contentRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    system: 'AI Content Transformation Engine v2.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api', contentRoutes);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// Global Error Handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Enhanced Backend Engine running on http://localhost:${PORT}`);
});

server.on('error', error => {
  console.error(`Backend could not start on port ${PORT}:`, error.message);
  process.exitCode = 1;
});

module.exports = app;
