const express = require('express');
const { getDb } = require('../config/firebase');
const { getSurvivorCharacters, getCharacterName, getHunterCharacters } = require('../config/characters');
const router = express.Router();

// Test character selection form
router.get('/character-form', async (req, res) => {
  try {
    const db = getDb();
    
    // Get tournaments for the form
    const tournamentsSnapshot = await db.collection('tournaments').get();
    const tournaments = tournamentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get active series for the form
    const seriesSnapshot = await db.collection('series')
      .where('status', '==', 'ongoing')
      .orderBy('createdAt', 'desc')
      .get();
    
    const activeSeries = seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('test/character-form', { 
      tournaments, 
      activeSeries,
      survivorCharacters: getSurvivorCharacters(),
      hunterCharacters: getHunterCharacters(),
      getCharacterName
    });
  } catch (error) {
    console.error('Error loading test form:', error);
    res.status(500).json({ error: 'Failed to load test form' });
  }
});

// Test match result submission
router.post('/match-results', async (req, res) => {
  try {
    const db = getDb();
    const {
      tournamentId,
      seriesId,
      matchTitle,
      hunterPlayer,
      hunterCharacter,
      survivorPlayer1,
      survivorCharacter1,
      survivorPlayer2,
      survivorCharacter2,
      survivorPlayer3,
      survivorCharacter3,
      survivorPlayer4,
      survivorCharacter4,
      eliminatedCount,
      escapedCount,
      hunterTeam,
      notes
    } = req.body;

    // Build survivor players array with character information
    const survivorPlayers = [];
    for (let i = 1; i <= 4; i++) {
      const playerName = req.body[`survivorPlayer${i}`];
      const characterId = req.body[`survivorCharacter${i}`];
      
      if (playerName && playerName.trim()) {
        survivorPlayers.push({
          name: playerName.trim(),
          character: characterId || null
        });
      }
    }

    // Validate that we have at least some survivors
    if (survivorPlayers.length === 0) {
      return res.status(400).json({ error: 'サバイバープレイヤーを最低1人入力してください' });
    }
    
    // Calculate points
    let hunterPoints = parseInt(eliminatedCount) || 0;
    let survivorPoints = parseInt(escapedCount) || 0;
    
    // Determine which team won this game
    const gameWinner = hunterPoints > survivorPoints ? hunterTeam : (hunterTeam === 'team1' ? 'team2' : 'team1');
    
    let gameNumber = 1;
    let seriesData = null;
    
    // If this is part of a series, get the current game number and series info
    if (seriesId) {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (seriesDoc.exists) {
        seriesData = seriesDoc.data();
        gameNumber = (seriesData.games || []).length + 1;
      }
    }
    
    const matchData = {
      tournamentId,
      seriesId: seriesId || null,
      gameNumber,
      matchTitle,
      hunterPlayer,
      hunterCharacter: hunterCharacter || null,
      hunterTeam: hunterTeam || null,
      survivorPlayers, // Now an array of objects with name and character
      eliminatedCount: parseInt(eliminatedCount),
      escapedCount: parseInt(escapedCount),
      hunterPoints,
      survivorPoints,
      gameWinner,
      bonusApplied: false,
      notes: notes || '',
      createdBy: 'test-user',
      createdAt: new Date()
    };
    
    const matchRef = await db.collection('matchResults').add(matchData);
    
    res.json({ 
      success: true, 
      message: 'Match result saved successfully',
      matchId: matchRef.id,
      data: matchData
    });
  } catch (error) {
    console.error('Error adding match result:', error);
    res.status(500).json({ error: 'Failed to add match result' });
  }
});

// View match results
router.get('/results', async (req, res) => {
  try {
    const db = getDb();
    const resultsSnapshot = await db.collection('matchResults')
      .orderBy('createdAt', 'desc')
      .get();
    
    const results = resultsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('test/results', { 
      results,
      getCharacterName
    });
  } catch (error) {
    console.error('Error loading results:', error);
    res.status(500).json({ error: 'Failed to load results' });
  }
});

// Tournament simulation endpoints
router.get('/tournament-simulator', async (req, res) => {
  try {
    const db = getDb();
    
    // Get tournaments and series for simulation
    const tournamentsSnapshot = await db.collection('tournaments').get();
    const tournaments = tournamentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const seriesSnapshot = await db.collection('series').get();
    const allSeries = seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('test/tournament-simulator', { 
      tournaments, 
      allSeries,
      survivorCharacters: getSurvivorCharacters(),
      hunterCharacters: getHunterCharacters(),
      getCharacterName
    });
  } catch (error) {
    console.error('Error loading tournament simulator:', error);
    res.status(500).json({ error: 'Failed to load tournament simulator' });
  }
});

// Simulate random match result
router.post('/simulate-match', async (req, res) => {
  try {
    const db = getDb();
    const { tournamentId, seriesId } = req.body;
    
    // Get random characters
    const hunterCharacters = getHunterCharacters();
    const survivorCharacters = getSurvivorCharacters();
    
    const randomHunter = hunterCharacters[Math.floor(Math.random() * hunterCharacters.length)];
    const randomSurvivors = [];
    
    // Pick 4 unique survivor characters
    const usedSurvivors = new Set();
    while (randomSurvivors.length < 4) {
      const randomSurvivor = survivorCharacters[Math.floor(Math.random() * survivorCharacters.length)];
      if (!usedSurvivors.has(randomSurvivor.id)) {
        randomSurvivors.push(randomSurvivor);
        usedSurvivors.add(randomSurvivor.id);
      }
    }
    
    // Generate random match outcome
    const eliminatedCount = Math.floor(Math.random() * 5); // 0-4
    const escapedCount = 4 - eliminatedCount;
    
    let gameNumber = 1;
    let hunterTeam = Math.random() > 0.5 ? 'team1' : 'team2';
    
    // If this is part of a series, get the current game number
    if (seriesId) {
      const seriesDoc = await db.collection('series').doc(seriesId).get();
      if (seriesDoc.exists) {
        const seriesData = seriesDoc.data();
        gameNumber = (seriesData.games || []).length + 1;
      }
    }
    
    const gameWinner = eliminatedCount > escapedCount ? hunterTeam : (hunterTeam === 'team1' ? 'team2' : 'team1');
    
    const matchData = {
      tournamentId,
      seriesId: seriesId || null,
      gameNumber,
      matchTitle: `シミュレーション試合 #${Date.now()}`,
      hunterPlayer: `RandomHunter_${Math.floor(Math.random() * 1000)}`,
      hunterCharacter: randomHunter.id,
      hunterTeam: seriesId ? hunterTeam : null,
      survivorPlayers: randomSurvivors.map((char, index) => ({
        name: `RandomSurvivor_${index + 1}_${Math.floor(Math.random() * 1000)}`,
        character: char.id
      })),
      eliminatedCount,
      escapedCount,
      hunterPoints: eliminatedCount,
      survivorPoints: escapedCount,
      gameWinner,
      bonusApplied: Math.random() > 0.8, // 20% chance of bonus
      notes: 'ランダムシミュレーションによる自動生成試合',
      createdBy: 'simulator',
      createdAt: new Date()
    };
    
    const matchRef = await db.collection('matchResults').add(matchData);
    
    res.json({ 
      success: true, 
      message: 'Simulated match created successfully',
      matchId: matchRef.id,
      data: matchData
    });
  } catch (error) {
    console.error('Error simulating match:', error);
    res.status(500).json({ error: 'Failed to simulate match' });
  }
});

// Create a new test series
router.post('/create-test-series', async (req, res) => {
  try {
    const db = getDb();
    const { tournamentId, seriesType, team1Name, team2Name } = req.body;
    
    const seriesData = {
      tournamentId,
      seriesTitle: `テストシリーズ - ${team1Name} vs ${team2Name}`,
      seriesType: seriesType || 'BO3',
      team1Name: team1Name || 'チームA',
      team2Name: team2Name || 'チームB',
      status: 'ongoing',
      games: [],
      winner: null,
      notes: 'テスト用に作成されたシリーズ',
      createdBy: 'test-creator',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const seriesRef = await db.collection('series').add(seriesData);
    
    res.json({
      success: true,
      message: 'Test series created successfully',
      seriesId: seriesRef.id,
      data: seriesData
    });
  } catch (error) {
    console.error('Error creating test series:', error);
    res.status(500).json({ error: 'Failed to create test series' });
  }
});

// Data management endpoints for testing
router.post('/clear-match-data', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'This endpoint is only available in development mode' });
    }
    
    const db = getDb();
    const snapshot = await db.collection('matchResults').get();
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    res.json({ success: true, message: 'All match results cleared', deletedCount: snapshot.size });
  } catch (error) {
    console.error('Error clearing match data:', error);
    res.status(500).json({ error: 'Failed to clear match data' });
  }
});

// Backup and restore data (development only)
router.post('/backup-data', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'This endpoint is only available in development mode' });
    }
    
    const db = getDb();
    
    // Check if we're using the persistent mock
    if (typeof db.createBackup === 'function') {
      const backupFile = db.createBackup();
      res.json({ success: true, message: 'Backup created successfully', backupFile });
    } else {
      res.status(400).json({ error: 'Backup feature not available with current database setup' });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

module.exports = router;