// Local file-based database system for IdentityV-Match
// This replaces Firebase dependency with a robust local storage solution

const fs = require('fs');
const path = require('path');

class LocalDatabase {
  constructor(dataDirectory = null) {
    this.dataDir = dataDirectory || path.join(__dirname, '../../data');
    this.backupDir = path.join(this.dataDir, 'backups');
    this.collections = {};
    this.ensureDirectories();
    this.loadAllData();
  }

  ensureDirectories() {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('✅ Created data directory:', this.dataDir);
    }
    
    // Create backup directory
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('✅ Created backup directory:', this.backupDir);
    }
  }

  getCollectionFile(collectionName) {
    return path.join(this.dataDir, `${collectionName}.json`);
  }

  // Enhanced data loading with better error handling
  loadCollectionData(collectionName) {
    const filePath = this.getCollectionFile(collectionName);
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const convertedData = new Map();
        
        for (const [id, doc] of Object.entries(data)) {
          convertedData.set(id, this.convertDatesFromStorage(doc));
        }
        
        console.log(`📂 Loaded ${convertedData.size} documents from ${collectionName}`);
        return convertedData;
      } else {
        console.log(`📂 Collection ${collectionName} file not found, creating empty collection`);
      }
    } catch (error) {
      console.warn(`⚠️ Error loading ${collectionName}:`, error.message);
      this.createBackupOnError(collectionName, filePath);
    }
    return new Map();
  }

  createBackupOnError(collectionName, filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `${collectionName}-error-${timestamp}.json`);
        fs.copyFileSync(filePath, backupPath);
        console.log(`💾 Created error backup: ${backupPath}`);
      }
    } catch (backupError) {
      console.error('Failed to create error backup:', backupError);
    }
  }

  // Enhanced data saving with atomic writes
  saveCollectionData(collectionName) {
    try {
      const filePath = this.getCollectionFile(collectionName);
      const tempPath = filePath + '.tmp';
      
      const data = {};
      for (const [id, doc] of this.collections[collectionName]) {
        data[id] = this.convertDatesForStorage(doc);
      }
      
      // Atomic write: write to temp file, then rename
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
      fs.renameSync(tempPath, filePath);
      
    } catch (error) {
      console.warn(`⚠️ Error saving ${collectionName}:`, error.message);
      throw error;
    }
  }

  // Improved date conversion with validation
  convertDatesForStorage(obj) {
    if (obj instanceof Date) {
      if (isNaN(obj.getTime())) {
        console.warn('Invalid date detected, using current date as fallback');
        return { __type: 'Date', value: new Date().toISOString() };
      }
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
      const date = new Date(obj.value);
      return isNaN(date.getTime()) ? new Date() : date;
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
    const collectionNames = [
      'users', 'tournaments', 'entries', 'teams', 
      'settings', 'series', 'matchResults', 'sessions'
    ];
    
    for (const collectionName of collectionNames) {
      this.collections[collectionName] = this.loadCollectionData(collectionName);
    }
    
    console.log('🗃️ Local database initialization complete');
  }

  // Database management utilities
  createFullBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `full-backup-${timestamp}.json`);
      
      const allData = {};
      for (const [collectionName, data] of Object.entries(this.collections)) {
        allData[collectionName] = Object.fromEntries(data);
      }
      
      fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
      console.log('💾 Full backup created:', backupFile);
      return backupFile;
    } catch (error) {
      console.error('Failed to create full backup:', error);
      throw error;
    }
  }

  restoreFromBackup(backupFilePath) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Backup restoration disabled in production mode');
    }
    
    try {
      const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      
      // Create safety backup before restoration
      this.createFullBackup();
      
      for (const [collectionName, data] of Object.entries(backupData)) {
        if (this.collections[collectionName]) {
          this.collections[collectionName].clear();
          for (const [id, doc] of Object.entries(data)) {
            this.collections[collectionName].set(id, this.convertDatesFromStorage(doc));
          }
          this.saveCollectionData(collectionName);
        }
      }
      
      console.log('✅ Database restored from backup:', backupFilePath);
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      throw error;
    }
  }

  // Data validation and integrity checks
  validateDatabase() {
    const issues = [];
    
    for (const [collectionName, collection] of Object.entries(this.collections)) {
      for (const [id, doc] of collection) {
        // Check for required fields based on collection type
        switch (collectionName) {
          case 'users':
            if (!doc.discordId || !doc.username) {
              issues.push(`Invalid user document ${id}: missing required fields`);
            }
            break;
          case 'tournaments':
            if (!doc.title || !doc.status) {
              issues.push(`Invalid tournament document ${id}: missing required fields`);
            }
            break;
          case 'entries':
            if (!doc.tournamentId || !doc.discordId) {
              issues.push(`Invalid entry document ${id}: missing required fields`);
            }
            break;
        }
        
        // Check date fields
        for (const [key, value] of Object.entries(doc)) {
          if (key.includes('At') || key.includes('Date')) {
            if (!(value instanceof Date) || isNaN(value.getTime())) {
              issues.push(`Invalid date in ${collectionName}/${id}.${key}`);
            }
          }
        }
      }
    }
    
    if (issues.length > 0) {
      console.warn('🔍 Database validation found issues:');
      issues.forEach(issue => console.warn(`  - ${issue}`));
    } else {
      console.log('✅ Database validation passed');
    }
    
    return issues;
  }

  // Get database statistics
  getStats() {
    const stats = {};
    for (const [collectionName, collection] of Object.entries(this.collections)) {
      stats[collectionName] = collection.size;
    }
    return stats;
  }

  // Clear all data (development only)
  clearAllData() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('clearAllData can only be used in development mode');
    }
    
    try {
      // Create backup before clearing
      this.createFullBackup();
      
      for (const collectionName of Object.keys(this.collections)) {
        this.collections[collectionName].clear();
        this.saveCollectionData(collectionName);
      }
      console.log('🗑️ All data cleared from local database');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  // Firestore-compatible API implementation
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
          
          // Get all documents
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
          
          // Apply filters
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
                case 'in':
                  return Array.isArray(filter.value) && filter.value.includes(fieldValue);
                case 'array-contains-any':
                  return Array.isArray(fieldValue) && 
                         Array.isArray(filter.value) && 
                         filter.value.some(val => fieldValue.includes(val));
                default:
                  return true;
              }
            });
          }
          
          // Apply sorting
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
}

module.exports = LocalDatabase;