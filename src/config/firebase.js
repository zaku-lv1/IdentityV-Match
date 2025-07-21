const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db;

const initializeFirebase = () => {
  try {
    // Firebase サービスアカウントキーファイルのパス
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    
    // ファイルが存在するかチェック
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('Firebase service account file not found at:', serviceAccountPath);
      console.warn('Please create firebase-service-account.json file with your Firebase credentials');
      console.warn('You can download it from Firebase Console > Project Settings > Service Accounts');
      
      // 開発用のダミーサービスを作成
      console.log('Creating mock Firebase service for development...');
      db = createMockFirestore();
      return;
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
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.log('Falling back to mock database for development');
    db = createMockFirestore();
  }
};

// 改良されたモック Firestore
const createMockFirestore = () => {
  const mockData = {
    users: new Map(),
    tournaments: new Map(),
    entries: new Map(),
    teams: new Map(),
    settings: new Map(),
    series: new Map(),
    matchResults: new Map(),
    sessions: new Map() // Add sessions collection for session storage
  };

  const createQuery = (collectionName, filters = [], orderByField = null, orderByDirection = 'asc') => {
    return {
      where: (field, operator, value) => {
        const newFilters = [...filters, { field, operator, value }];
        return createQuery(collectionName, newFilters, orderByField, orderByDirection);
      },
      orderBy: (field, direction = 'asc') => {
        return createQuery(collectionName, filters, field, direction);
      },
      get: async () => {
        let docs = [];
        
        // すべてのドキュメントを取得
        for (const [id, data] of mockData[collectionName]) {
          docs.push({
            id,
            data: () => data,
            exists: true,
            ref: {
              id: id,
              parent: { id: collectionName }
            }
          });
        }
        
        // フィルターを適用
        for (const filter of filters) {
          docs = docs.filter(doc => {
            const docData = doc.data();
            const fieldValue = docData[filter.field];
            
            switch (filter.operator) {
              case '==':
                return fieldValue === filter.value;
              case '!=':
                return fieldValue !== filter.value;
              case '>':
                return fieldValue > filter.value;
              case '<':
                return fieldValue < filter.value;
              case '>=':
                return fieldValue >= filter.value;
              case '<=':
                return fieldValue <= filter.value;
              case 'array-contains':
                return Array.isArray(fieldValue) && fieldValue.includes(filter.value);
              default:
                return true;
            }
          });
        }
        
        // ソートを適用
        if (orderByField) {
          docs.sort((a, b) => {
            const aVal = a.data()[orderByField];
            const bVal = b.data()[orderByField];
            
            let comparison = 0;
            if (aVal instanceof Date && bVal instanceof Date) {
              comparison = aVal.getTime() - bVal.getTime();
            } else if (aVal > bVal) {
              comparison = 1;
            } else if (aVal < bVal) {
              comparison = -1;
            }
            
            return orderByDirection === 'desc' ? -comparison : comparison;
          });
        }
        
        return {
          docs,
          empty: docs.length === 0,
          size: docs.length
        };
      }
    };
  };

  const mockCollection = (collectionName) => ({
    doc: (id) => ({
      get: async () => {
        const data = mockData[collectionName].get(id);
        return {
          exists: !!data,
          data: () => data,
          id: id,
          ref: {
            id: id,
            parent: { id: collectionName },
            delete: async () => {
              mockData[collectionName].delete(id);
            }
          }
        };
      },
      set: async (data, options = {}) => {
        if (options.merge) {
          const existing = mockData[collectionName].get(id) || {};
          mockData[collectionName].set(id, { ...existing, ...data });
        } else {
          mockData[collectionName].set(id, data);
        }
      },
      update: async (data) => {
        const existing = mockData[collectionName].get(id) || {};
        mockData[collectionName].set(id, { ...existing, ...data });
      },
      delete: async () => {
        mockData[collectionName].delete(id);
      },
      ref: {
        id: id,
        parent: { id: collectionName }
      }
    }),
    add: async (data) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      mockData[collectionName].set(id, data);
      return { id };
    },
    where: (field, operator, value) => {
      return createQuery(collectionName, [{ field, operator, value }]);
    },
    orderBy: (field, direction = 'asc') => {
      return createQuery(collectionName, [], field, direction);
    },
    get: async () => {
      const docs = [];
      for (const [id, data] of mockData[collectionName]) {
        docs.push({
          id,
          data: () => data,
          exists: true,
          ref: {
            id: id,
            parent: { id: collectionName }
          }
        });
      }
      return { docs, size: docs.length };
    }
  });

  return {
    collection: mockCollection,
    batch: () => {
      const operations = [];
      return {
        delete: (ref) => {
          operations.push({ type: 'delete', ref });
        },
        set: (ref, data, options = {}) => {
          operations.push({ type: 'set', ref, data, options });
        },
        update: (ref, data) => {
          operations.push({ type: 'update', ref, data });
        },
        commit: async () => {
          for (const op of operations) {
            switch (op.type) {
              case 'delete':
                // Extract collection and document ID from the ref
                if (op.ref && op.ref.parent && op.ref.id) {
                  const collectionName = op.ref.parent.id;
                  const docId = op.ref.id;
                  if (mockData[collectionName]) {
                    mockData[collectionName].delete(docId);
                  }
                }
                break;
              case 'set':
                if (op.ref && op.ref.parent && op.ref.id) {
                  const collectionName = op.ref.parent.id;
                  const docId = op.ref.id;
                  if (mockData[collectionName]) {
                    if (op.options.merge) {
                      const existing = mockData[collectionName].get(docId) || {};
                      mockData[collectionName].set(docId, { ...existing, ...op.data });
                    } else {
                      mockData[collectionName].set(docId, op.data);
                    }
                  }
                }
                break;
              case 'update':
                if (op.ref && op.ref.parent && op.ref.id) {
                  const collectionName = op.ref.parent.id;
                  const docId = op.ref.id;
                  if (mockData[collectionName]) {
                    const existing = mockData[collectionName].get(docId) || {};
                    mockData[collectionName].set(docId, { ...existing, ...op.data });
                  }
                }
                break;
            }
          }
        }
      };
    }
  };
};

const getDb = () => {
  if (!db) {
    throw new Error('Firebase not initialized');
  }
  return db;
};

module.exports = { initializeFirebase, getDb };