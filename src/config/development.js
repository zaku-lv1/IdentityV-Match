// 開発環境用の設定とヘルパー

const initDevelopmentData = async (db) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  try {
    // 開発用の初期データを作成
    console.log('Setting up development data...');
    
    // 管理者設定を確認・作成
    const settingsDoc = await db.collection('settings').doc('general').get();
    if (!settingsDoc.exists) {
      await db.collection('settings').doc('general').set({
        adminUserIds: ['1316250671401668710', 'dev_user_123'], // 開発用のDiscord ID (実際のIDに変更してください)
        allowedGuildId: '1383070923070115850', // 開発用のサーバーID (実際のIDに変更してください)
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created default admin settings');
    }
    
    // サンプル大会を確認・作成
    const tournamentDoc = await db.collection('tournaments').doc('sample-tournament').get();
    if (!tournamentDoc.exists) {
      await db.collection('tournaments').doc('sample-tournament').set({
        title: 'サンプル大会 - 初心者歓迎',
        description: 'これは開発用のサンプル大会です。初心者の方も気軽にご参加ください！',
        maxEntries: 20,
        teamSize: 5,
        rules: `
## 基本ルール
- ランクマッチルールに準拠
- 試合時間: 最大15分
- 通常の第五人格ルールに従う

## 禁止事項
- 暴言・煽り行為
- 故意の回線切断
- 外部ツールの使用
        `.trim(),
        banPickRules: `
## BANピックルール
1. ハンター側がサバイバー1名をBAN
2. サバイバー側がハンター1名をBAN
3. ハンター側がハンターをピック
4. サバイバー側が4名をピック

## BANピック時間
- 各BANフェーズ: 30秒
- 各ピックフェーズ: 60秒
        `.trim(),
        entryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1週間後
        status: 'open',
        createdBy: '123456789012345678',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created sample tournament');
    }
    
    // サンプル大会2を作成
    const tournament2Doc = await db.collection('tournaments').doc('competitive-tournament').get();
    if (!tournament2Doc.exists) {
      await db.collection('tournaments').doc('competitive-tournament').set({
        title: '最高峰限定大会',
        description: '最高峰プレイヤー限定の高レベル競技大会です。',
        maxEntries: 16,
        teamSize: 4,
        rules: `
## 最高峰限定ルール
- プロリーグルールに準拠
- 試合時間: 最大20分
- 厳格な競技環境での実施

## 参加条件
- ハンター・サバイバー共に最高峰段位必須
- 大会経験者優遇
        `.trim(),
        banPickRules: `
## 上級BANピックルール
1. 第1BANフェーズ（交互に2体ずつBAN）
2. 第1ピックフェーズ（ハンター→サバイバー2名→ハンター→サバイバー2名）
3. 第2BANフェーズ（交互に1体ずつBAN）
4. 第2ピックフェーズ（残りをピック）

## 制限時間
- BANフェーズ: 各45秒
- ピックフェーズ: 各90秒
        `.trim(),
        entryDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2週間後
        status: 'open',
        createdBy: '123456789012345678',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created competitive tournament');
    }
    
    // サンプルユーザーを作成（8段階段位システム対応）
    const sampleUsers = [
      {
        id: 'sample-user-1',
        data: {
          discordId: 'sample-user-1',
          username: 'TopPlayer',
          discriminator: '1234',
          avatar: null,
          hunterRank: 8, // 最高峰
          survivorRank: 8, // 最高峰
          createdAt: new Date(),
          lastLogin: new Date()
        }
      },
      {
        id: 'sample-user-2',
        data: {
          discordId: 'sample-user-2',
          username: 'SkillfulPlayer',
          discriminator: '5678',
          avatar: null,
          hunterRank: 7, // 7段
          survivorRank: 6, // 6段
          createdAt: new Date(),
          lastLogin: new Date()
        }
      },
      {
        id: 'sample-user-3',
        data: {
          discordId: 'sample-user-3',
          username: 'BeginnerPlayer',
          discriminator: '9012',
          avatar: null,
          hunterRank: 3, // 3段
          survivorRank: 4, // 4段
          createdAt: new Date(),
          lastLogin: new Date()
        }
      }
    ];
    
    for (const user of sampleUsers) {
      const userDoc = await db.collection('users').doc(user.id).get();
      if (!userDoc.exists) {
        await db.collection('users').doc(user.id).set(user.data);
      }
    }
    
    // サンプルエントリーを作成
    const sampleEntries = [
      {
        tournamentId: 'sample-tournament',
        discordId: 'sample-user-1',
        username: 'TopPlayer',
        hunterRank: 8,
        survivorRank: 8,
        status: 'confirmed',
        enteredAt: new Date()
      },
      {
        tournamentId: 'sample-tournament',
        discordId: 'sample-user-2',
        username: 'SkillfulPlayer',
        hunterRank: 7,
        survivorRank: 6,
        status: 'confirmed',
        enteredAt: new Date()
      },
      {
        tournamentId: 'competitive-tournament',
        discordId: 'sample-user-1',
        username: 'TopPlayer',
        hunterRank: 8,
        survivorRank: 8,
        status: 'confirmed',
        enteredAt: new Date()
      }
    ];
    
    for (const entry of sampleEntries) {
      const existingEntry = await db.collection('entries')
        .where('tournamentId', '==', entry.tournamentId)
        .where('discordId', '==', entry.discordId)
        .get();
      
      if (existingEntry.empty) {
        await db.collection('entries').add(entry);
      }
    }
    
    // サンプルシリーズを作成
    const sampleSeries = [
      {
        id: 'sample-series-1',
        data: {
          tournamentId: 'sample-tournament',
          seriesTitle: '準決勝 - チームA vs チームB',
          seriesType: 'BO3',
          team1Name: 'チームA',
          team2Name: 'チームB',
          status: 'ongoing',
          games: [],
          winner: null,
          notes: 'サンプルのBO3シリーズです',
          createdBy: '123456789012345678',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      {
        id: 'sample-series-2',
        data: {
          tournamentId: 'competitive-tournament',
          seriesTitle: '決勝 - 最強チーム vs エリートチーム',
          seriesType: 'BO5',
          team1Name: '最強チーム',
          team2Name: 'エリートチーム',
          status: 'ongoing',
          games: [],
          winner: null,
          notes: '最高峰限定大会の決勝戦',
          createdBy: '123456789012345678',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    ];
    
    for (const series of sampleSeries) {
      const seriesDoc = await db.collection('series').doc(series.id).get();
      if (!seriesDoc.exists) {
        await db.collection('series').doc(series.id).set(series.data);
      }
    }
    
    // サンプル試合結果を作成（実際の試合データをシミュレート）
    const sampleMatchResults = [
      {
        tournamentId: 'sample-tournament',
        seriesId: 'sample-series-1',
        gameNumber: 1,
        matchTitle: '準決勝 第1試合 - チームA vs チームB',
        hunterPlayer: 'ProHunter_A',
        hunterCharacter: 'photographer',
        hunterTeam: 'team1',
        survivorPlayers: [
          { name: 'Survivor_B1', character: 'coordinator' },
          { name: 'Survivor_B2', character: 'mercenary' },
          { name: 'Survivor_B3', character: 'decoder' },
          { name: 'Survivor_B4', character: 'priestess' }
        ],
        eliminatedCount: 3,
        escapedCount: 1,
        hunterPoints: 3,
        survivorPoints: 1,
        gameWinner: 'team1',
        bonusApplied: false,
        notes: 'チームAのハンターが圧倒的パフォーマンスを見せた',
        createdBy: 'development-seed',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2時間前
      },
      {
        tournamentId: 'sample-tournament',
        seriesId: 'sample-series-1',
        gameNumber: 2,
        matchTitle: '準決勝 第2試合 - チームB vs チームA',
        hunterPlayer: 'EliteHunter_B',
        hunterCharacter: 'violinist',
        hunterTeam: 'team2',
        survivorPlayers: [
          { name: 'Survivor_A1', character: 'seer' },
          { name: 'Survivor_A2', character: 'perfumer' },
          { name: 'Survivor_A3', character: 'mechanic' },
          { name: 'Survivor_A4', character: 'forward' }
        ],
        eliminatedCount: 1,
        escapedCount: 3,
        hunterPoints: 1,
        survivorPoints: 3,
        gameWinner: 'team1', // team1 = チームA（サバイバー側でこの試合勝利）
        bonusApplied: false,
        notes: 'チームAのサバイバーチームが見事な連携で逆転',
        createdBy: 'development-seed',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1時間前
      },
      {
        tournamentId: 'sample-tournament',
        seriesId: 'sample-series-1',
        gameNumber: 3,
        matchTitle: '準決勝 決着戦 - チームA vs チームB',
        hunterPlayer: 'ProHunter_A',
        hunterCharacter: 'sculptor',
        hunterTeam: 'team1',
        survivorPlayers: [
          { name: 'Survivor_B1', character: 'enchantress' },
          { name: 'Survivor_B2', character: 'grave_keeper' },
          { name: 'Survivor_B3', character: 'cowboy' },
          { name: 'Survivor_B4', character: 'prisoner' }
        ],
        eliminatedCount: 2,
        escapedCount: 2,
        hunterPoints: 2,
        survivorPoints: 2,
        gameWinner: 'team1', // ハンター勝利（より多くの吊りで勝利）
        bonusApplied: true, // 接戦のためボーナス適用
        notes: 'BO3の決着戦！最後まで接戦となった名勝負',
        createdBy: 'development-seed',
        createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30分前
      },
      {
        tournamentId: 'competitive-tournament',
        seriesId: 'sample-series-2',
        gameNumber: 1,
        matchTitle: '決勝戦 第1試合 - 最強チーム vs エリートチーム',
        hunterPlayer: 'ChampionHunter',
        hunterCharacter: 'nightmare',
        hunterTeam: 'team1',
        survivorPlayers: [
          { name: 'EliteSurvivor1', character: 'seer' },
          { name: 'EliteSurvivor2', character: 'mercenary' },
          { name: 'EliteSurvivor3', character: 'decoder' },
          { name: 'EliteSurvivor4', character: 'coordinator' }
        ],
        eliminatedCount: 4,
        escapedCount: 0,
        hunterPoints: 4,
        survivorPoints: 0,
        gameWinner: 'team1',
        bonusApplied: false,
        notes: '最高峰限定大会の決勝戦開幕！ハンターの完全勝利',
        createdBy: 'development-seed',
        createdAt: new Date(Date.now() - 10 * 60 * 1000) // 10分前
      },
      {
        tournamentId: 'competitive-tournament',
        seriesId: null, // 個別試合
        gameNumber: 1,
        matchTitle: '練習試合 - フリー対戦',
        hunterPlayer: 'PracticeHunter',
        hunterCharacter: 'wax_artist',
        hunterTeam: null,
        survivorPlayers: [
          { name: 'TestPlayer1', character: 'first_officer' },
          { name: 'TestPlayer2', character: 'barmaid' },
          { name: 'TestPlayer3', character: 'postman' },
          { name: 'TestPlayer4', character: 'patient' }
        ],
        eliminatedCount: 2,
        escapedCount: 2,
        hunterPoints: 2,
        survivorPoints: 2,
        gameWinner: null, // 引き分け
        bonusApplied: false,
        notes: '練習試合として実施。新キャラクターのテストプレイ',
        createdBy: 'development-seed',
        createdAt: new Date(Date.now() - 5 * 60 * 1000) // 5分前
      }
    ];
    
    for (const matchResult of sampleMatchResults) {
      const existingMatch = await db.collection('matchResults')
        .where('tournamentId', '==', matchResult.tournamentId)
        .where('gameNumber', '==', matchResult.gameNumber)
        .where('matchTitle', '==', matchResult.matchTitle)
        .get();
      
      if (existingMatch.empty) {
        await db.collection('matchResults').add(matchResult);
      }
    }
    
    // シリーズの進行状況を更新
    await db.collection('series').doc('sample-series-1').update({
      games: [
        { gameNumber: 1, winner: 'team1', hunterPoints: 3, survivorPoints: 1 },
        { gameNumber: 2, winner: 'team1', hunterPoints: 1, survivorPoints: 3 },
        { gameNumber: 3, winner: 'team1', hunterPoints: 2, survivorPoints: 2 }
      ],
      winner: 'team1', // チームAが2-1で勝利
      status: 'completed',
      notes: 'BO3シリーズが完了。チームAが準決勝を突破。'
    });
    
    await db.collection('series').doc('sample-series-2').update({
      games: [
        { gameNumber: 1, winner: 'team1', hunterPoints: 4, survivorPoints: 0 }
      ],
      winner: null, // まだ進行中
      status: 'ongoing',
      notes: '決勝戦進行中。最強チームが第1試合を制した。'
    });
    
    // サンプルチームを作成
    const sampleTeams = [
      {
        id: 'team-sample-1',
        data: {
          tournamentId: 'sample-tournament',
          name: 'チームA',
          members: [
            { discordId: 'sample-user-1', username: 'TopPlayer', hunterRank: 8, survivorRank: 8 },
            { discordId: 'sample-user-2', username: 'SkillfulPlayer', hunterRank: 7, survivorRank: 6 },
            { discordId: 'team-member-3', username: 'ProHunter', hunterRank: 6, survivorRank: 7 },
            { discordId: 'team-member-4', username: 'EliteSurvivor', hunterRank: 5, survivorRank: 8 },
            { discordId: 'team-member-5', username: 'BalancedPlayer', hunterRank: 6, survivorRank: 6 }
          ],
          createdAt: new Date(),
          createdBy: '123456789012345678'
        }
      },
      {
        id: 'team-sample-2',
        data: {
          tournamentId: 'sample-tournament',
          name: 'チームB',
          members: [
            { discordId: 'team-b-1', username: 'TeamB_Captain', hunterRank: 7, survivorRank: 7 },
            { discordId: 'team-b-2', username: 'TeamB_Hunter', hunterRank: 8, survivorRank: 5 },
            { discordId: 'team-b-3', username: 'TeamB_Survivor1', hunterRank: 5, survivorRank: 8 },
            { discordId: 'team-b-4', username: 'TeamB_Survivor2', hunterRank: 4, survivorRank: 7 },
            { discordId: 'team-b-5', username: 'TeamB_Flex', hunterRank: 6, survivorRank: 6 }
          ],
          createdAt: new Date(),
          createdBy: '123456789012345678'
        }
      },
      {
        id: 'team-competitive-1',
        data: {
          tournamentId: 'competitive-tournament',
          name: '最強チーム',
          members: [
            { discordId: 'comp-1', username: 'Legend_Hunter', hunterRank: 8, survivorRank: 8 },
            { discordId: 'comp-2', username: 'Master_Survivor', hunterRank: 7, survivorRank: 8 },
            { discordId: 'comp-3', username: 'Pro_Player', hunterRank: 8, survivorRank: 7 },
            { discordId: 'comp-4', username: 'Elite_Member', hunterRank: 8, survivorRank: 8 }
          ],
          createdAt: new Date(),
          createdBy: '123456789012345678'
        }
      },
      {
        id: 'team-competitive-2',
        data: {
          tournamentId: 'competitive-tournament',
          name: 'エリートチーム',
          members: [
            { discordId: 'elite-1', username: 'Champion_Player', hunterRank: 8, survivorRank: 7 },
            { discordId: 'elite-2', username: 'Expert_Hunter', hunterRank: 8, survivorRank: 6 },
            { discordId: 'elite-3', username: 'Ace_Survivor', hunterRank: 6, survivorRank: 8 },
            { discordId: 'elite-4', username: 'Tactical_Player', hunterRank: 7, survivorRank: 7 }
          ],
          createdAt: new Date(),
          createdBy: '123456789012345678'
        }
      }
    ];
    
    for (const team of sampleTeams) {
      const teamDoc = await db.collection('teams').doc(team.id).get();
      if (!teamDoc.exists) {
        await db.collection('teams').doc(team.id).set(team.data);
      }
    }
    
    console.log('Development data setup completed successfully');
  } catch (error) {
    console.error('Error setting up development data:', error);
  }
};

// 開発環境用のユーティリティ関数
const clearDevelopmentData = async (db) => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('clearDevelopmentData can only be run in development mode');
    return;
  }
  
  try {
    console.log('Clearing development data...');
    
    // すべてのコレクションをクリア
    const collections = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults'];
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleared ${collectionName} collection`);
    }
    
    console.log('Development data cleared successfully');
  } catch (error) {
    console.error('Error clearing development data:', error);
  }
};

// 段位表示用のヘルパー関数
const getRankDisplay = (rank) => {
  if (rank === 8) return '最高峰';
  return rank + '段';
};

// 開発環境でのデータ統計表示
const showDevelopmentStats = async (db) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  try {
    const collections = ['users', 'tournaments', 'entries', 'teams', 'settings', 'series', 'matchResults'];
    const stats = {};
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      stats[collectionName] = snapshot.size;
    }
    
    console.log('📊 Development Database Stats:');
    console.table(stats);
    
    // Show rank distribution
    const usersSnapshot = await db.collection('users').get();
    const rankStats = { hunters: {}, survivors: {} };
    
    usersSnapshot.docs.forEach(doc => {
      const user = doc.data();
      if (user.hunterRank) {
        const rank = getRankDisplay(user.hunterRank);
        rankStats.hunters[rank] = (rankStats.hunters[rank] || 0) + 1;
      }
      if (user.survivorRank) {
        const rank = getRankDisplay(user.survivorRank);
        rankStats.survivors[rank] = (rankStats.survivors[rank] || 0) + 1;
      }
    });
    
    console.log('📈 Rank Distribution:');
    console.log('Hunters:', rankStats.hunters);
    console.log('Survivors:', rankStats.survivors);
    
  } catch (error) {
    console.error('Error getting development stats:', error);
  }
};

module.exports = { 
  initDevelopmentData, 
  clearDevelopmentData, 
  showDevelopmentStats,
  getRankDisplay
};