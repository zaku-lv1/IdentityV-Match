# IdentityV-Match データベース移行ガイド

## 概要

「全データFirebase管理じゃ無理？」という課題に対応するため、IdentityV-Matchシステムはローカルファイルベースのデータベースシステムを実装しました。これにより、Firebaseに依存せずに完全にローカルで動作する、より管理しやすいシステムとなりました。

## 🔄 移行内容

### 従来の課題
- **外部サービス依存**: Firebaseへのインターネット接続が必須
- **複雑な設定**: サービスアカウントキー、プロジェクト設定など
- **コスト懸念**: 使用量に応じた課金システム
- **開発環境の複雑性**: 開発用の複雑なフォールバック機構
- **データ制御の制限**: 外部サービスによるデータ管理

### 新しいローカルファイルシステム
- **完全ローカル**: インターネット接続不要
- **簡単セットアップ**: 追加設定なしで即座に利用開始
- **無料**: 一切の外部コストなし
- **完全データ制御**: ローカルファイルによる完全な管理
- **シンプルな開発環境**: 複雑なフォールバック不要

## 🗃️ 新しいデータベースシステム

### 技術仕様

**ストレージ形式**: JSON ファイル
**場所**: `data/` ディレクトリ
**API**: Firebase Firestore 互換
**バックアップ**: 自動 + 手動
**検証**: 組み込みデータ整合性チェック

### ファイル構造

```
IdentityV-Match/
└── data/
    ├── users.json           # ユーザー情報
    ├── tournaments.json     # 大会情報
    ├── entries.json         # エントリー情報
    ├── teams.json           # チーム情報
    ├── settings.json        # システム設定
    ├── series.json          # シリーズ情報
    ├── matchResults.json    # 試合結果
    ├── sessions.json        # セッション情報
    └── backups/             # 自動バックアップ
        ├── full-backup-2025-07-21T13-57-39-613Z.json
        └── error-backup-*.json
```

### データ形式

各JSONファイルは以下の形式で保存されます：

```json
{
  "document_id": {
    "field1": "value1",
    "field2": 123,
    "dateField": {
      "__type": "Date",
      "value": "2025-07-21T13:46:53.244Z"
    }
  }
}
```

## 🔧 管理機能

### 開発用エンドポイント

#### データベース統計情報
```bash
GET http://localhost:3000/dev/stats
```

レスポンス例：
```json
{
  "environment": "development",
  "database_type": "local",
  "database_stats": {
    "users": 3,
    "tournaments": 2,
    "entries": 3,
    "teams": 4,
    "settings": 1,
    "series": 2,
    "matchResults": 5
  },
  "timestamp": "2025-07-21T13:57:18.563Z"
}
```

#### データベース管理インターフェース
```bash
GET http://localhost:3000/dev/database
```

#### フルバックアップ作成
```bash
GET http://localhost:3000/dev/database/backup
```

#### データベース検証
```bash
POST http://localhost:3000/dev/database/validate
```

#### 全データクリア（開発のみ）
```bash
POST http://localhost:3000/dev/database/clear
```

## 🚀 使用方法

### 基本的な使用（推奨）

1. リポジトリをクローン
2. `npm install`
3. `npm start`

追加設定は一切不要です。システムが自動的に `data/` ディレクトリを作成し、初期データをセットアップします。

### 環境変数設定

`.env` ファイル（ローカルデータベース使用時）:
```bash
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-session-secret-key

# ローカルデータベースを使用（デフォルト）
USE_FIREBASE=false

# Discord OAuth（オプション）
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback
```

### Firebase オプション

大規模展開や複数サーバー間同期が必要な場合：

```bash
# Firebase使用（オプション）
USE_FIREBASE=true
FIREBASE_PROJECT_ID=your-firebase-project-id
USE_FIRESTORE_SESSIONS=true
```

## 📦 バックアップとリストア

### 自動バックアップ

- **データ変更時**: 全ての書き込み操作で自動バックアップ作成
- **エラー時**: データ破損検出時に緊急バックアップ作成
- **定期実行**: 管理エンドポイントから手動実行可能

### 手動バックアップ

```bash
# データディレクトリをコピー
cp -r data/ backup-$(date +%Y%m%d)/

# 開発エンドポイント経由
curl http://localhost:3000/dev/database/backup
```

### リストア

```bash
# バックアップから復元
cp backup-20250721/data/* data/

# 特定のバックアップファイルから復元
cp data/backups/full-backup-2025-07-21T13-57-39-613Z.json restored-data.json
# 手動でファイルを配置
```

## 🔄 移行シナリオ

### 既存Firebaseから移行

1. 既存システムでFirebaseからデータをエクスポート
2. 新システムで `USE_FIREBASE=false` に設定
3. データを `data/` ディレクトリに配置
4. システム起動

### ローカルからFirebaseへ移行

1. Firebase プロジェクトを設定
2. `firebase-service-account.json` を配置
3. `USE_FIREBASE=true` に設定
4. システム起動（自動でデータが移行される）

## 🛠️ 開発・カスタマイズ

### カスタムコレクション追加

`src/config/localDatabase.js` の `loadAllData()` メソッドでコレクション名を追加：

```javascript
const collectionNames = [
  'users', 'tournaments', 'entries', 'teams', 
  'settings', 'series', 'matchResults', 'sessions',
  'newCollection' // 新しいコレクション
];
```

### データ検証ルール追加

`validateDatabase()` メソッドに検証ロジックを追加：

```javascript
case 'newCollection':
  if (!doc.requiredField) {
    issues.push(`Invalid newCollection document ${id}: missing requiredField`);
  }
  break;
```

## ⚡ パフォーマンス

### 推奨ハードウェア

- **CPU**: 1コア以上
- **RAM**: 512MB以上
- **ストレージ**: SSD推奨（高速な読み書きのため）
- **ネットワーク**: 不要

### ベンチマーク

- **起動時間**: 約1-2秒
- **レスポンス時間**: 1-10ms
- **ファイルサイズ**: 通常の大会で100KB-1MB程度
- **同時接続**: 100-500ユーザー（ハードウェア依存）

## 🔒 セキュリティ

### データ保護

- **ローカルファイル**: OSレベルのファイル権限で保護
- **バックアップ暗号化**: 必要に応じてファイルシステムレベルで実装
- **アクセス制御**: アプリケーションレベルでの認証・認可

### セキュリティ推奨事項

```bash
# データディレクトリの権限設定
chmod 700 data/
chmod 600 data/*.json

# バックアップディレクトリの保護
chmod 700 data/backups/
```

## 🆘 トラブルシューティング

### よくある問題

**Q: データファイルが見つからない**
A: アプリケーションを一度起動すると自動作成されます

**Q: データが保存されない**
A: ディレクトリの書き込み権限を確認してください

**Q: バックアップが作成されない**
A: `data/backups/` ディレクトリの権限を確認してください

**Q: パフォーマンスが遅い**
A: `data/` ディレクトリをSSDに配置してください

### ログ分析

システムログで以下を確認：
```
📂 Loaded X documents from collectionName  # 正常読み込み
⚠️ Error loading collectionName           # 読み込みエラー
💾 Created error backup                    # 緊急バックアップ作成
✅ Local database is ready               # 初期化完了
```

## 📞 サポート

- **GitHub Issues**: バグ報告・機能要求
- **開発用エンドポイント**: リアルタイムデバッグ
- **ログファイル**: 詳細な動作ログ

---

**IdentityV-Match ローカルデータベースシステム** - Firebase から解放された、完全ローカル管理の新時代 🎮✨