// ファイルベースの永続化可能なモック Firestore
const fs = require('fs');
const path = require('path');

class PersistentMockFirestore {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.ensureDataDirectory();
    this.collections = {};
    this.loadAllData();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('Created data directory for persistent storage:', this.dataDir);
    }
  }

  getCollectionFile(collectionName) {
    return path.join(this.dataDir, `${collectionName}.json`);
  }

  loadCollectionData(collectionName) {
    const filePath = this.getCollectionFile(collectionName);
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // Convert date strings back to Date objects
        const convertedData = new Map();
        for (const [id, doc] of Object.entries(data)) {
          convertedData.set(id, this.convertDatesFromStorage(doc));
        }
        console.log(`Loaded ${convertedData.size} documents from ${collectionName}`);
        return convertedData;
      }
    } catch (error) {
      console.warn(`Error loading ${collectionName}:`, error.message);
    }
    return new Map();
  }

  saveCollectionData(collectionName) {
    try {
      const filePath = this.getCollectionFile(collectionName);
      const data = {};
      for (const [id, doc] of this.collections[collectionName]) {
        data[id] = this.convertDatesForStorage(doc);
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn(`Error saving ${collectionName}:`, error.message);
    }
  }

  convertDatesForStorage(obj) {
    if (obj instanceof Date) {
      return { __type: 'Date', value: obj.toISOString() };
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesForStorage(item));
    }
    if (obj && typeof obj === 'object') {
      const converted = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertDatesForStorage(value);
      }
      return converted;
    }
    return obj;
  }

  convertDatesFromStorage(obj) {
    if (obj && typeof obj === 'object' && obj.__type === 'Date') {
      return new Date(obj.value);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDatesFromStorage(item));
    }
    if (obj && typeof obj === 'object') {
      const converted = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = this.convertDatesFromStorage(value);
      }
      return converted;
    }
    return obj;
  }

  loadAllData() {
    const collectionNames = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults', 'sessions'];
    
    for (const collectionName of collectionNames) {
      this.collections[collectionName] = this.loadCollectionData(collectionName);
    }
  }

  collection(collectionName) {
    if (!this.collections[collectionName]) {
      this.collections[collectionName] = new Map();
    }

    const saveData = () => this.saveCollectionData(collectionName);

    const createQuery = (filters = [], orderByField = null, orderByDirection = 'asc') => {
      return {
        where: (field, operator, value) => {
          const newFilters = [...filters, { field, operator, value }];
          return createQuery(newFilters, orderByField, orderByDirection);
        },
        orderBy: (field, direction = 'asc') => {
          return createQuery(filters, field, direction);
        },
        get: async () => {
          let docs = [];
          
          // すべてのドキュメントを取得
          for (const [id, data] of this.collections[collectionName]) {
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

    return {
      doc: (id) => ({
        get: async () => {
          const data = this.collections[collectionName].get(id);
          return {
            exists: !!data,
            data: () => data,
            id: id,
            ref: {
              id: id,
              parent: { id: collectionName },
              delete: async () => {
                this.collections[collectionName].delete(id);
                saveData();
              }
            }
          };
        },
        set: async (data, options = {}) => {
          if (options.merge) {
            const existing = this.collections[collectionName].get(id) || {};
            this.collections[collectionName].set(id, { ...existing, ...data });
          } else {
            this.collections[collectionName].set(id, data);
          }
          saveData();
        },
        update: async (data) => {
          const existing = this.collections[collectionName].get(id) || {};
          this.collections[collectionName].set(id, { ...existing, ...data });
          saveData();
        },
        delete: async () => {
          this.collections[collectionName].delete(id);
          saveData();
        },
        ref: {
          id: id,
          parent: { id: collectionName }
        }
      }),
      add: async (data) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        this.collections[collectionName].set(id, data);
        saveData();
        return { id };
      },
      where: (field, operator, value) => {
        return createQuery([{ field, operator, value }]);
      },
      orderBy: (field, direction = 'asc') => {
        return createQuery([], field, direction);
      },
      get: async () => {
        const docs = [];
        for (const [id, data] of this.collections[collectionName]) {
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
    };
  }

  batch() {
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
        const collectionsToSave = new Set();
        
        for (const op of operations) {
          switch (op.type) {
            case 'delete':
              if (op.ref && op.ref.parent && op.ref.id) {
                const collectionName = op.ref.parent.id;
                const docId = op.ref.id;
                if (this.collections[collectionName]) {
                  this.collections[collectionName].delete(docId);
                  collectionsToSave.add(collectionName);
                }
              }
              break;
            case 'set':
              if (op.ref && op.ref.parent && op.ref.id) {
                const collectionName = op.ref.parent.id;
                const docId = op.ref.id;
                if (this.collections[collectionName]) {
                  if (op.options.merge) {
                    const existing = this.collections[collectionName].get(docId) || {};
                    this.collections[collectionName].set(docId, { ...existing, ...op.data });
                  } else {
                    this.collections[collectionName].set(docId, op.data);
                  }
                  collectionsToSave.add(collectionName);
                }
              }
              break;
            case 'update':
              if (op.ref && op.ref.parent && op.ref.id) {
                const collectionName = op.ref.parent.id;
                const docId = op.ref.id;
                if (this.collections[collectionName]) {
                  const existing = this.collections[collectionName].get(docId) || {};
                  this.collections[collectionName].set(docId, { ...existing, ...op.data });
                  collectionsToSave.add(collectionName);
                }
              }
              break;
          }
        }
        
        // Save all modified collections
        for (const collectionName of collectionsToSave) {
          this.saveCollectionData(collectionName);
        }
      }
    };
  }

  // データクリア機能（開発用）
  clearAllData() {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('clearAllData can only be used in development mode');
    }
    
    for (const collectionName of Object.keys(this.collections)) {
      this.collections[collectionName].clear();
      this.saveCollectionData(collectionName);
    }
    console.log('All data cleared from persistent storage');
  }

  // バックアップ作成
  createBackup() {
    const backupDir = path.join(this.dataDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    const allData = {};
    for (const [collectionName, data] of Object.entries(this.collections)) {
      allData[collectionName] = Object.fromEntries(data);
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
    console.log('Backup created:', backupFile);
    return backupFile;
  }
}

module.exports = PersistentMockFirestore;