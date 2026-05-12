import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { RedisStore } from 'rate-limit-redis';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

// Optional Redis adapter for Socket.IO
let RedisAdapter: any = null;
try {
  RedisAdapter = require('@socket.io/redis-adapter').createAdapter;
} catch (e) {
  console.warn('Socket.IO Redis adapter not found, falling back to local adapter');
}

// Routes
import authRoutes from './routes/auth.routes';
import sessionRoutes from './routes/sessions.routes';
import questionRoutes from './routes/questions.routes';
import feedbackRoutes from './routes/feedback.routes';
import voiceNoteRoutes from './routes/voicenotes.routes';
import contentRoutes from './routes/content.routes';
import analyticsRoutes from './routes/analytics.routes';
import notificationRoutes from './routes/notifications.routes';
import userRoutes from './routes/users.routes';
import pollsRoutes from './routes/polls.routes';
import exportRoutes from './routes/export.routes';
import announcementsRoutes from './routes/announcements.routes';
import aiRoutes from './routes/ai.routes';
import accessLogRoutes from './routes/access-log.routes';
import onlineUsersRoutes from './routes/online-users.routes';
import activityLogRoutes from './routes/activity-log.routes';
import healthRoutes from './routes/health.routes';
import moderatorLogRoutes from './routes/moderator-log.routes';
import flaggedContentRoutes from './routes/flagged-content.routes';

// Services
import { initializeSocket } from './services/socket.service';
import { setActivityLogIO } from './services/activity-log.service';
import { metricsMiddleware } from './middleware/metrics.middleware';


// Validate required env vars
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in environment');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://donor-summit.com',
  'https://www.donor-summit.com',
  'http://localhost:3000',
  /\.vercel\.app$/
].filter(Boolean) as (string | RegExp)[];

export const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-user-id'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
});

// Configure Redis adapter for horizontal scaling if Redis and adapter are available
if (redis && RedisAdapter) {
  const pubClient = redis;
  const subClient = redis.duplicate();
  
  // Critical: Add error handlers to prevent crashes
  pubClient.on('error', (err) => console.error('Redis PubClient Error:', err));
  subClient.on('error', (err) => console.error('Redis SubClient Error:', err));
  
  io.adapter(RedisAdapter(pubClient, subClient));
}

// Initialize Socket.IO event handlers
initializeSocket(io);
setActivityLogIO(io);

// Export io for use in routes (already exported on line 48)

// Rate limiting setup
const createRateLimitStore = (prefix: string) => redis ? new RedisStore({
  // @ts-ignore
  sendCommand: (...args: string[]) => redis.call(...args),
  prefix: `rl:${prefix}:`,
}) : undefined;

const generalLimiter = rateLimit({
  store: createRateLimitStore('general'),
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  store: createRateLimitStore('auth'),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const questionLimiter = rateLimit({
  store: createRateLimitStore('question'),
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many questions. Please wait before submitting another.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
// Configure CORS for production - using origin: true for emergency debugging
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-user-id'],
  exposedHeaders: ['Content-Range', 'X-Total-Count'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
}));
app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(ao =>
      ao instanceof RegExp ? ao.test(origin) : ao === origin
    )) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'x-user-id'],
  optionsSuccessStatus: 204,
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Metrics middleware (before routes)
app.use(metricsMiddleware);

// Request logger for debugging 500 errors
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// API Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sessions', generalLimiter, sessionRoutes);
app.use('/api/questions', generalLimiter, questionRoutes);
app.use('/api/feedback', generalLimiter, feedbackRoutes);
app.use('/api/voicenotes', generalLimiter, voiceNoteRoutes);
app.use('/api/content', generalLimiter, contentRoutes);
app.use('/api/analytics', generalLimiter, analyticsRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);
app.use('/api/users', generalLimiter, userRoutes);
app.use('/api/polls', generalLimiter, pollsRoutes);
app.use('/api/export', generalLimiter, exportRoutes);
app.use('/api/announcements', generalLimiter, announcementsRoutes);
app.use('/api/ai', generalLimiter, aiRoutes);
app.use('/api/access-logs', generalLimiter, accessLogRoutes);
app.use('/api/online-users', generalLimiter, onlineUsersRoutes);
app.use('/api/activity-logs', generalLimiter, activityLogRoutes);
app.use('/api/health', generalLimiter, healthRoutes);
app.use('/api/moderator-logs', generalLimiter, moderatorLogRoutes);
app.use('/api/flagged-content', generalLimiter, flaggedContentRoutes);

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  require('fs').appendFileSync('server_error.log', `[${new Date().toISOString()}] ${req.method} ${req.path} - error: ${err.stack || err}\n`);
  const status = err.status || 500;
  const isClientError = status >= 400 && status < 500;
  const message = (process.env.NODE_ENV !== 'production' || isClientError)
    ? (err.message || 'Internal server error')
    : 'Internal server error';
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || process.env.BACKEND_PORT || 5000;

server.listen(PORT, () => {
  console.log(`IDES Backend running on port ${PORT}`);
  console.log(`Socket.IO ready for connections`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
