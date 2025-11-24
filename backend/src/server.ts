import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import profilesRouter from './routes/profiles';
import adminRouter from './routes/admin';
import logsRouter from './routes/logs';
import authRouter from './routes/auth';
import apksRouter from './routes/apks';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy - required when behind reverse proxy (Nginx, Cloudflare, etc.)
// This allows rate limiting and logging to see real client IPs from X-Forwarded-For header
// For Cloudflare ZeroTrust tunnels, trust all proxies
if (NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Vite/React
        "https://static.cloudflareinsights.com"
      ],
      scriptSrcElem: [
        "'self'",
        "https://static.cloudflareinsights.com"
      ],
      connectSrc: [
        "'self'",
        "https://cloudflareinsights.com",
        "https://api.github.com"
      ],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  } : false
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
// Increase limit for detailed execution logs with command results
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/logs', logsRouter);
app.use('/api/apks', apksRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static frontend in production
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

export default app;

