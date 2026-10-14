require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const setupChatSocket = require('./sockets/chatHandler');

const app = express();
const server = http.createServer(app);

// CORS configuration for both Express and Socket.io
const CORS_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(express.json());

// Setup MongoDB
connectDB();

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Centralized Error Handler Middleware
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

setupChatSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 Chat Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready on port ${PORT}`);
  console.log(`========================================`);
});
