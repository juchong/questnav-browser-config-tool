import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import ipRangeCheck from 'ip-range-check';
import profilesRouter from './routes/profiles';
import adminRouter from './routes/admin';
import logsRouter from './routes/logs';
import authRouter from './routes/auth';
import apksRouter from './routes/apks';
import webhooksRouter from './routes/webhooks';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Local development configuration
// When ALLOW_HTTP_LOCAL=true, allows HTTP access for specified local subnets
// This conditionally disables upgrade-insecure-requests CSP directive based on client IP
const ALLOW_HTTP_LOCAL = process.env.ALLOW_HTTP_LOCAL === 'true';
const LOCAL_SUBNETS = process.env.LOCAL_SUBNETS?.split(',').map(s => s.trim()) || [
  '127.0.0.1',
  '::1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16'
];

// Trust proxy - required when behind reverse proxy (Nginx, Cloudflare, etc.)
// This allows rate limiting and logging to see real client IPs from X-Forwarded-For header
// Configuration options:
//   - 'loopback' (default): Trust only localhost proxies (Docker, local nginx)
//   - '1': Trust first proxy (recommended for Cloudflare, single reverse proxy)
//   - 'true': Trust all proxies (not recommended due to IP spoofing risk)
//   - IP addresses: Trust specific proxy IPs
const trustProxyConfig = process.env.TRUST_PROXY_CONFIG || 'loopback';

if (NODE_ENV === 'production') {
  if (trustProxyConfig === 'true' || trustProxyConfig === 'false') {
    app.set('trust proxy', trustProxyConfig === 'true');
  } else if (!isNaN(Number(trustProxyConfig))) {
    app.set('trust proxy', Number(trustProxyConfig));
  } else {
    app.set('trust proxy', trustProxyConfig);
  }
}

// IP-based conditional CSP middleware
// Applies strict HTTPS enforcement for external traffic, relaxed for local subnets
app.use((req, res, next) => {
  const clientIP = (req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  
  // Check if request is from local subnet
  const isLocalAccess = ALLOW_HTTP_LOCAL && ipRangeCheck(clientIP, LOCAL_SUBNETS);
  
  if (NODE_ENV === 'production') {
    const cspDirectives: Record<string, string[]> = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
      scriptSrcElem: ["'self'", "https://static.cloudflareinsights.com"],
      connectSrc: ["'self'", "https://cloudflareinsights.com", "https://api.github.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      scriptSrcAttr: ["'none'"]
    };
    
    // Only enforce HTTPS upgrade for non-local traffic
    if (!isLocalAccess) {
      cspDirectives.upgradeInsecureRequests = [];
    }
    
    // Build CSP header string
    const cspHeader = Object.entries(cspDirectives)
      .map(([key, value]) => {
        const directive = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        return `${directive} ${value.join(' ')}`;
      })
      .join('; ');
    
    res.setHeader('Content-Security-Policy', cspHeader);
  }
  
  next();
});

// Use helmet for other security headers (without CSP since we're handling it above)
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS configuration
// In production, allow both the official domain and localhost for development
const allowedOrigins = [
  'https://setup.questnav.gg',
  'http://localhost:5173',
  'http://localhost:3000'
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow configured origin or localhost
    if (NODE_ENV === 'development') {
      const devOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
      if (origin === devOrigin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    // In production, check whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
// More lenient in development to account for React Strict Mode double-mounting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: NODE_ENV === 'development' ? 1000 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // Higher limit in dev
  standardHeaders: true,
  legacyHeaders: false,
  // Skip failed requests (don't count them towards the rate limit)
  skipFailedRequests: false
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
app.use('/api/webhooks', webhooksRouter);

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
  
  // Don't leak error details in production
  const errorMessage = NODE_ENV === 'development' ? err.message : 'Internal server error';
  
  res.status(500).json({
    success: false,
    error: errorMessage
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

export default app;

