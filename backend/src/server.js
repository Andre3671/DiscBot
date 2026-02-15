import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import routes
import botsRouter from './api/routes/bots.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/bots', botsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Serve static frontend files in production
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Catch-all route for SPA (Vue Router)
app.get('*', (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(frontendDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          error: 'Frontend not built. Run "npm run build" in frontend directory.'
        });
      }
    });
  } else {
    res.status(404).json({ success: false, error: 'Not found' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Join bot-specific room
  socket.on('subscribe', (botId) => {
    socket.join(`bot-${botId}`);
    console.log(`[Socket.io] Client ${socket.id} subscribed to bot ${botId}`);
  });

  // Leave bot-specific room
  socket.on('unsubscribe', (botId) => {
    socket.leave(`bot-${botId}`);
    console.log(`[Socket.io] Client ${socket.id} unsubscribed from bot ${botId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to other modules
export { io };

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Initialize BotManager (will auto-start enabled bots)
    const { default: BotManager } = await import('./bot/BotManager.js');
    await BotManager.initialize();

    httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   Discord Bot Builder Server          ║
╠════════════════════════════════════════╣
║   Server running on port ${PORT}         ║
║   API: http://localhost:${PORT}/api     ║
║   Web: http://localhost:${PORT}          ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down gracefully...');

  try {
    const { default: BotManager } = await import('./bot/BotManager.js');
    await BotManager.stopAll();
  } catch (error) {
    console.error('[Server] Error stopping bots:', error);
  }

  httpServer.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

startServer();
