const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const adminRoutes = require('./routes/admin');
const { initializeFirebase, getDb } = require('./config/firebase');
const { initDevelopmentData, showDevelopmentStats } = require('./config/development');

const app = express();

// Trust proxy setting (重要: rate limitの前に設定)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // 開発環境では無効化
}));
app.use(cors());

// Rate limiting (trust proxy設定後に配置)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Global middleware to check admin status
app.use(async (req, res, next) => {
  if (req.user) {
    try {
      const db = getDb();
      const settingsDoc = await db.collection('settings').doc('general').get();
      const settings = settingsDoc.exists ? settingsDoc.data() : {};
      
      req.user.isAdmin = settings.adminUserIds && settings.adminUserIds.includes(req.user.discordId);
    } catch (error) {
      console.error('Error checking admin status:', error);
      req.user.isAdmin = false;
    }
  }
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/tournaments', tournamentRoutes);
app.use('/admin', adminRoutes);

// Home route
app.get('/', async (req, res) => {
  try {
    const db = getDb();
    
    // Get recent tournaments for display
    const tournamentsSnapshot = await db.collection('tournaments')
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc')
      .get();
    
    const tournaments = tournamentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).slice(0, 3); // Show only 3 most recent
    
    res.render('index', { 
      user: req.user,
      tournaments: tournaments
    });
  } catch (error) {
    console.error('Error loading home page:', error);
    res.render('index', { 
      user: req.user,
      tournaments: []
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Development endpoint for stats (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/dev/stats', async (req, res) => {
    try {
      const db = getDb();
      const collections = ['users', 'tournaments', 'entries', 'teams', 'settings'];
      const stats = {};
      
      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).get();
        stats[collectionName] = snapshot.size;
      }
      
      res.json({
        environment: 'development',
        database_stats: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    message: 'ページが見つかりません',
    user: req.user 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error', { 
    message: 'サーバーエラーが発生しました',
    user: req.user 
  });
});

// Initialize Firebase and start server
const startServer = async () => {
  try {
    initializeFirebase();
    
    // 開発環境の場合、初期データを設定
    if (process.env.NODE_ENV === 'development') {
      try {
        const db = getDb();
        await initDevelopmentData(db);
        await showDevelopmentStats(db);
      } catch (error) {
        console.error('Error initializing development data:', error);
      }
    }
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`💻 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Dev stats: http://localhost:${PORT}/dev/stats`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();