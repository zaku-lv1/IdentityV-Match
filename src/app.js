const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const FirestoreStore = require('firestore-store')(session);
const FileStore = require('session-file-store')(session);
require('dotenv').config();

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const adminRoutes = require('./routes/admin');
const testRoutes = require('./routes/test');
const { initializeDatabase, getDb, getDatabaseType } = require('./config/firebase');
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

// Session configuration with persistent store for maintaining login state across restarts
const createSessionStore = () => {
  // For production with proper Firebase setup, use Firestore session store
  if (process.env.NODE_ENV === 'production' && process.env.USE_FIRESTORE_SESSIONS === 'true') {
    try {
      const db = getDb();
      console.log('Using Firestore session store for production persistence');
      return new FirestoreStore({
        database: db,
        collection: 'sessions'
      });
    } catch (error) {
      console.warn('Failed to create Firestore session store, falling back to file store:', error.message);
    }
  }
  
  // Use file-based store for development and fallback
  console.log('Using file-based session store for development persistence');
  return new FileStore({
    path: path.join(__dirname, '../sessions'),
    ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    retries: 0,
    factor: 1,
    minTimeout: 50,
    maxTimeout: 100
  });
};

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret-key',
  resave: false,
  saveUninitialized: false,
  store: createSessionStore(),
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // Prevent XSS attacks
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days for better persistence
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
app.use('/test', testRoutes);

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
      const collections = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults'];
      const stats = {};
      
      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).get();
        stats[collectionName] = snapshot.size;
      }
      
      res.json({
        environment: 'development',
        database_type: getDatabaseType(),
        database_stats: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Database management endpoint
  app.get('/dev/database', async (req, res) => {
    try {
      const db = getDb();
      
      // Check if local database has management features
      const hasManagement = typeof db.getStats === 'function';
      
      const stats = hasManagement ? db.getStats() : 'Management not available';
      const validationIssues = hasManagement ? db.validateDatabase() : [];
      
      res.json({
        message: 'Database management interface',
        database_type: getDatabaseType(),
        statistics: stats,
        validation_issues: validationIssues,
        available_actions: hasManagement ? [
          'GET /dev/database/backup - Create full backup',
          'POST /dev/database/validate - Run validation',
          'POST /dev/database/clear - Clear all data (dev only)'
        ] : ['Limited management available for this database type'],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create backup endpoint
  app.get('/dev/database/backup', async (req, res) => {
    try {
      const db = getDb();
      
      if (typeof db.createFullBackup === 'function') {
        const backupFile = db.createFullBackup();
        res.json({
          message: 'Backup created successfully',
          backup_file: backupFile,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({ error: 'Backup not supported for this database type' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Validate database endpoint
  app.post('/dev/database/validate', async (req, res) => {
    try {
      const db = getDb();
      
      if (typeof db.validateDatabase === 'function') {
        const issues = db.validateDatabase();
        res.json({
          message: 'Database validation completed',
          issues_found: issues.length,
          issues: issues,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({ error: 'Validation not supported for this database type' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear database endpoint (development only)
  app.post('/dev/database/clear', async (req, res) => {
    try {
      const db = getDb();
      
      if (typeof db.clearAllData === 'function') {
        db.clearAllData();
        res.json({
          message: 'All data cleared successfully',
          warning: 'This action cannot be undone',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({ error: 'Clear operation not supported for this database type' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test endpoint to simulate session creation
  app.get('/dev/test-session', (req, res) => {
    // Force session creation by setting a value
    req.session.testData = {
      created: new Date().toISOString(),
      id: Math.random().toString(36).substr(2, 9)
    };
    
    res.json({
      message: 'Test session created',
      sessionId: req.sessionID,
      testData: req.session.testData,
      sessionStore: 'file-based for development'
    });
  });

  // Test endpoint to check session persistence
  app.get('/dev/check-session', (req, res) => {
    res.json({
      message: 'Session check',
      sessionId: req.sessionID,
      hasSession: !!req.session,
      testData: req.session?.testData || null,
      sessionStore: 'file-based for development'
    });
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

// Initialize database and start server
const startServer = async () => {
  try {
    initializeDatabase();
    
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
      console.log(`🗃️ Database: ${getDatabaseType()}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`💻 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Dev stats: http://localhost:${PORT}/dev/stats`);
        console.log(`🛠️ Database management: http://localhost:${PORT}/dev/database`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();