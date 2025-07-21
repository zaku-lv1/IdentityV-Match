#!/usr/bin/env node

// Database Migration Utility for IdentityV-Match
// Helps users migrate between local and Firebase databases

const fs = require('fs');
const path = require('path');

class DatabaseMigrator {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.backupDir = path.join(this.dataDir, 'backups');
  }

  // Create a complete backup before any migration
  createPreMigrationBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `pre-migration-backup-${timestamp}.json`);
      
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const allData = {};
      const collections = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults', 'sessions'];
      
      for (const collection of collections) {
        const filePath = path.join(this.dataDir, `${collection}.json`);
        if (fs.existsSync(filePath)) {
          allData[collection] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      }

      fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
      console.log('✅ Pre-migration backup created:', backupFile);
      return backupFile;
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      throw error;
    }
  }

  // Export local data to a portable format
  exportLocalData(outputFile = null) {
    try {
      if (!outputFile) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        outputFile = path.join(process.cwd(), `identityv-export-${timestamp}.json`);
      }

      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        database: 'local',
        collections: {}
      };

      const collections = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults', 'sessions'];
      
      for (const collection of collections) {
        const filePath = path.join(this.dataDir, `${collection}.json`);
        if (fs.existsSync(filePath)) {
          exportData.collections[collection] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      }

      fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
      console.log('✅ Data exported to:', outputFile);
      return outputFile;
    } catch (error) {
      console.error('❌ Export failed:', error.message);
      throw error;
    }
  }

  // Import data from exported file
  importData(importFile) {
    try {
      if (!fs.existsSync(importFile)) {
        throw new Error(`Import file not found: ${importFile}`);
      }

      // Create backup before import
      this.createPreMigrationBackup();

      const importData = JSON.parse(fs.readFileSync(importFile, 'utf8'));
      
      if (!importData.collections) {
        throw new Error('Invalid import file format');
      }

      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      for (const [collection, data] of Object.entries(importData.collections)) {
        const filePath = path.join(this.dataDir, `${collection}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ Imported ${collection}: ${Object.keys(data).length} documents`);
      }

      console.log('✅ Import completed successfully');
    } catch (error) {
      console.error('❌ Import failed:', error.message);
      throw error;
    }
  }

  // Validate data integrity
  validateData() {
    try {
      const collections = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults'];
      const issues = [];
      
      for (const collection of collections) {
        const filePath = path.join(this.dataDir, `${collection}.json`);
        if (fs.existsSync(filePath)) {
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`✅ ${collection}: ${Object.keys(data).length} documents`);
          } catch (parseError) {
            issues.push(`❌ ${collection}: Invalid JSON format`);
          }
        } else {
          console.log(`⚠️ ${collection}: File not found (will be created on first use)`);
        }
      }

      if (issues.length > 0) {
        console.log('\n🔍 Issues found:');
        issues.forEach(issue => console.log(issue));
      } else {
        console.log('\n✅ All data files are valid');
      }

      return issues.length === 0;
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      return false;
    }
  }

  // Clean up old backups (keep only recent ones)
  cleanupBackups(keepCount = 10) {
    try {
      if (!fs.existsSync(this.backupDir)) {
        console.log('ℹ️ No backup directory found');
        return;
      }

      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (backupFiles.length > keepCount) {
        const filesToDelete = backupFiles.slice(keepCount);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Deleted old backup: ${file.name}`);
        });
        console.log(`✅ Cleanup completed, kept ${keepCount} most recent backups`);
      } else {
        console.log(`ℹ️ ${backupFiles.length} backups found, no cleanup needed`);
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  // Show usage information
  showHelp() {
    console.log(`
📖 IdentityV-Match Database Migration Tool

使用方法:
  node scripts/migrate.js <command> [options]

コマンド:
  backup              事前バックアップを作成
  export [file]       ローカルデータをエクスポート
  import <file>       データをインポート
  validate            データ整合性をチェック
  cleanup [count]     古いバックアップをクリーンアップ (デフォルト: 10個保持)
  help                このヘルプを表示

例:
  node scripts/migrate.js backup
  node scripts/migrate.js export my-data.json
  node scripts/migrate.js import my-data.json
  node scripts/migrate.js validate
  node scripts/migrate.js cleanup 5

注意:
- 重要な操作の前には必ずバックアップを作成してください
- Firebase移行時はサーバーを停止してから実行してください
`);
  }
}

// CLI interface
function main() {
  const migrator = new DatabaseMigrator();
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'backup':
        migrator.createPreMigrationBackup();
        break;
      
      case 'export':
        const exportFile = args[1];
        migrator.exportLocalData(exportFile);
        break;
      
      case 'import':
        const importFile = args[1];
        if (!importFile) {
          console.error('❌ Import file path required');
          process.exit(1);
        }
        migrator.importData(importFile);
        break;
      
      case 'validate':
        const isValid = migrator.validateData();
        process.exit(isValid ? 0 : 1);
        break;
      
      case 'cleanup':
        const keepCount = parseInt(args[1]) || 10;
        migrator.cleanupBackups(keepCount);
        break;
      
      case 'help':
      case '-h':
      case '--help':
      default:
        migrator.showHelp();
        break;
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = DatabaseMigrator;