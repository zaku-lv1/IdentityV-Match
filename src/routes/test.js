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

module.exports = router;