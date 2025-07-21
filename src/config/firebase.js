const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const LocalDatabase = require('./localDatabase');

let db;

const initializeDatabase = () => {
  // Check if Firebase should be used (only if explicitly enabled)
  const useFirebase = process.env.USE_FIREBASE === 'true';
  
  if (useFirebase) {
    try {
      // Firebase サービスアカウントキーファイルのパス
      const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
      
      // ファイルが存在するかチェック
      if (!fs.existsSync(serviceAccountPath)) {
        console.warn('⚠️ Firebase enabled but service account file not found at:', serviceAccountPath);
        console.warn('Please create firebase-service-account.json file with your Firebase credentials');
        console.warn('You can download it from Firebase Console > Project Settings > Service Accounts');
        throw new Error('Firebase service account file not found');
      }

      // Firebase サービスアカウントキーを読み込み
      const serviceAccount = require(serviceAccountPath);
      
      // Firebase Admin SDK を初期化
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
      }
      
      db = admin.firestore();
      console.log('🔥 Firebase Firestore initialized successfully');
      return;
      
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      console.log('🔄 Falling back to local database...');
    }
  }
  
  // Use local database as primary storage
  console.log('🗃️ Initializing local file-based database...');
  db = new LocalDatabase();
  console.log('✅ Local database is ready (Firebase disabled)');
};



const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

// Check if we're using Firebase or local database
const isUsingFirebase = () => {
  return db && typeof db.app !== 'undefined'; // Firebase Firestore has an 'app' property
};

// Get database type for logging/debugging
const getDatabaseType = () => {
  if (!db) return 'none';
  return isUsingFirebase() ? 'firebase' : 'local';
};

module.exports = { 
  initializeDatabase, 
  getDb, 
  isUsingFirebase, 
  getDatabaseType,
  // Keep old name for backward compatibility
  initializeFirebase: initializeDatabase
};