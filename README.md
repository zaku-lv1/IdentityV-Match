# IdentityV-Match

第五人格（Identity V）の対戦管理システム - プレイヤーマッチングとトーナメント運営のための包括的プラットフォーム

## 🎮 概要

IdentityV-Matchは、第五人格のプレイヤーが対戦を管理し、トーナメントを運営するための強力なWebアプリケーションです。チーム編成、試合結果の記録、キャラクター追跡、統計分析など、競技運営に必要な機能を提供します。

## ✨ 主な機能

### 🏆 大会・対戦管理
- **大会作成・管理**: BO3/BO5形式のシリーズ対戦の作成と管理
- **エントリーシステム**: プレイヤーの大会参加登録とランク管理
- **チーム編成**: 動的チーム作成とメンバー管理
- **試合進行**: リアルタイムでの試合結果入力と進行管理

### 👥 チーム・プレイヤー管理
- **動的チーム選択**: 対戦時にチームを選択すると自動的にメンバーを選択可能
- **ランキング管理**: ハンター・サバイバー両方の段位システム（8段階）
- **プレイヤー統計**: 個人・チーム成績の詳細分析
- **Discord連携**: Discord認証による簡単ログイン

### 📊 キャラクター・戦略分析
- **キャラクター追跡**: 試合で使用されたキャラクターの記録と分析
- **BANピックシステム**: プロリーグ仕様のBANピック管理
- **戦略データベース**: チーム戦術とキャラクター組み合わせの分析
- **試合レポート**: 詳細な試合結果とパフォーマンス分析

### 🔧 管理機能
- **管理者ダッシュボード**: 大会運営者向けの包括的管理画面
- **権限管理**: Discord ID ベースの管理者権限システム
- **データエクスポート**: 試合結果とプレイヤーデータのCSVエクスポート
- **リアルタイム更新**: 試合進行のリアルタイム反映

## 🚀 技術スタック

### フロントエンド
- **テンプレートエンジン**: EJS
- **スタイリング**: CSS3（カスタムCSS）
- **JavaScript**: バニラJavaScript（ES6+）
- **レスポンシブデザイン**: モバイル対応UI

### バックエンド
- **ランタイム**: Node.js
- **フレームワーク**: Express.js
- **データベース**: Firebase Firestore
- **認証**: Passport.js (Discord OAuth)
- **セッション管理**: ファイルベース/Firestoreストア

### インフラ・デプロイ
- **開発環境**: nodemon
- **本番環境**: Firebase Hosting対応
- **データ永続化**: Firestore / 開発用ファイルストレージ
- **セキュリティ**: Helmet.js、レート制限

## 📦 インストール・セットアップ

### 前提条件
- Node.js 16.x 以上
- npm または yarn
- Firebase プロジェクト（本番環境）
- Discord アプリケーション（OAuth用）

### 1. リポジトリのクローン
```bash
git clone https://github.com/zaku-lv1/IdentityV-Match.git
cd IdentityV-Match
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. 環境設定
`.env.example`を`.env`にコピーし、必要な環境変数を設定：

```bash
cp .env.example .env
```

`.env`ファイルを編集：
```env
# 基本設定
NODE_ENV=development
PORT=3000
SESSION_SECRET=your-session-secret-key

# Discord OAuth設定
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_CALLBACK_URL=http://localhost:3000/auth/discord/callback

# Firebase設定（本番環境）
FIREBASE_PROJECT_ID=your-firebase-project-id
USE_FIRESTORE_SESSIONS=true
```

### 4. Firebase設定（本番環境）
Firebase サービスアカウントキーを`firebase-service-account.json`として保存：

```bash
# Firebase Console > プロジェクト設定 > サービスアカウント からダウンロード
# ファイルを firebase-service-account.json として保存
```

### 5. 開発サーバーの起動
```bash
# 開発モード（ホットリロード付き）
npm run dev

# 本番モード
npm start
```

## 🎯 使用方法

### 基本的な使い方

1. **Discord認証**: `/auth/discord` でDiscordアカウントでログイン
2. **プロフィール設定**: ハンター・サバイバーのランクを設定
3. **大会参加**: 開催中の大会にエントリー
4. **チーム編成**: 管理者がランダムまたは手動でチーム作成
5. **試合実行**: 対戦結果の入力とキャラクター追跡

### 管理者機能

1. **管理者設定**: Discord IDを管理者リストに追加
2. **大会作成**: 新しい大会の作成と設定
3. **チーム管理**: 参加者のチーム分けと編集
4. **試合管理**: シリーズ作成と試合結果の管理

### 動的チーム選択機能

対戦入力時に：
1. 大会を選択
2. チームが存在する場合、チーム選択オプションが表示
3. チームを選択すると、そのメンバーが自動的に候補として表示
4. 手動入力とチーム選択を柔軟に切り替え可能

## 🔧 開発ガイド

### プロジェクト構造
```
IdentityV-Match/
├── src/
│   ├── app.js              # メインアプリケーション
│   ├── config/             # 設定ファイル
│   │   ├── firebase.js     # Firebase設定
│   │   ├── characters.js   # キャラクターデータ
│   │   └── development.js  # 開発用データ
│   ├── routes/             # ルーター
│   │   ├── auth.js         # 認証ルート
│   │   ├── tournaments.js  # 大会ルート
│   │   ├── admin.js        # 管理者ルート
│   │   └── test.js         # テスト・実験機能
│   └── utils/              # ユーティリティ
│       └── tournamentUtils.js
├── views/                  # EJSテンプレート
│   ├── admin/              # 管理者画面
│   ├── test/               # テスト機能
│   └── *.ejs               # 各種ページ
├── public/                 # 静的ファイル
│   ├── css/               
│   └── js/
└── docs/                   # ドキュメント
```

### 開発用機能

#### テスト・デバッグエンドポイント（開発環境のみ）
- `/dev/stats` - データベース統計
- `/dev/test-session` - セッションテスト
- `/test/character-form` - キャラクター追跡テスト
- `/test/results` - 試合結果表示
- `/test/tournament-simulator` - 大会シミュレーター

#### 開発用データ
開発環境では自動的にサンプルデータが生成されます：
- サンプル大会（初心者向け・最高峰限定）
- テストユーザー（異なるランク）
- サンプルチーム（メンバー構成例）
- 試合結果データ

### カスタマイズ

#### キャラクターデータの追加
`src/config/characters.js`を編集してキャラクターを追加：

```javascript
const newCharacter = {
  id: 'new_character',
  name: '新キャラクター',
  type: 'survivor' // または 'hunter'
};
```

#### ランクシステムの調整
`src/utils/tournamentUtils.js`でランク表示をカスタマイズ：

```javascript
function getRankDisplay(rank) {
  // ランク表示ロジックをカスタマイズ
}
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成（`git checkout -b feature/amazing-feature`）
3. 変更をコミット（`git commit -m 'Add some amazing feature'`）
4. ブランチにプッシュ（`git push origin feature/amazing-feature`）
5. プルリクエストを作成

### 開発ガイドライン
- コードスタイル: ESLint設定に従う
- コミットメッセージ: 日本語または英語で明確に
- テスト: 新機能には適切なテストを追加
- ドキュメント: 重要な変更は README を更新

## 📝 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

- **第五人格**: NetEase Games による素晴らしいゲーム
- **コミュニティ**: フィードバックと改善提案をくださるプレイヤーの皆様
- **オープンソース**: 使用している各種ライブラリの開発者の皆様

## 📞 サポート・お問い合わせ

- **Issues**: バグ報告や機能要望は [GitHub Issues](https://github.com/zaku-lv1/IdentityV-Match/issues)
- **Discord**: [開発者Discord] （利用可能な場合）
- **Email**: [メールアドレス] （設定済みの場合）

---

**IdentityV-Match** - 競技第五人格の新しいスタンダードを目指して 🎮✨