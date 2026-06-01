const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// ✅ Validate JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET is not set in .env file');
  console.error('Please add JWT_SECRET to your .env file');
  process.exit(1);
}

// ✅ DB (after dotenv)
const db = require('./db');
app.use('/uploads', express.static('uploads'));

// ===============================
// MIDDLEWARE
// ===============================

// ✅ CORS - allow frontend requests
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:9002', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow localhost variations in development
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Increase body size limit for image uploads (10mb)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ Rate limiting - prevent brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased limit from 100 to 500 to accommodate dashboard requests
  message: {
    success: false,
    message: "Too many requests, please try again later."
  }
});
app.use('/api/', limiter);

// ✅ Auth rate limiting (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Increased from 20 to 50
  message: {
    success: false,
    message: "Too many login attempts, please try again later."
  }
});

// ===============================
// ROUTES
// ===============================

// 🔐 AUTH ROUTE (TOP) - with rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));

// 🔒 PROTECTED ROUTES
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/kitchen', require('./routes/kitchen'));

// ===============================
// ROOT
// ===============================
app.get('/', (req, res) => {
  res.json({
    message: 'Elites POS System API',
    version: '1.0.0',
    status: 'Running'
  });
});

// ===============================
// HEALTH CHECK
// ===============================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ===============================
// ERROR HANDLING MIDDLEWARE (must be last)
// ===============================
app.use(require('./middleware/errorMiddleware'));

// ===============================
// SERVER START
// ===============================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} already in use. Killing old process...`);
    const { execSync } = require('child_process');
    try {
      if (process.platform === 'win32') {
        execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT}') do taskkill /F /PID %a`, { shell: 'cmd' });
      } else {
        execSync(`lsof -ti:${PORT} | xargs kill -9`);
      }
      console.log(`✅ Old process killed. Restarting...`);
      setTimeout(() => {
        server.listen(PORT);
      }, 1000);
    } catch (e) {
      console.error('Could not kill old process. Please restart manually.');
      process.exit(1);
    }
  } else {
    throw err;
  }
});

// ✅ Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  db.end(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  db.end(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});

module.exports = app;
