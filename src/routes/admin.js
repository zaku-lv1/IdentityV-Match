const express = require('express');
const { getDb } = require('../config/firebase');
const { 
  getUpdatedTournamentStatus,
  formatJapaneseDate,
  validateTeamFormation
} = require('../utils/tournamentUtils');
const { getSurvivorCharacters, getCharacterName, getHunterCharacters } = require('../config/characters');
const router = express.Router();

// Admin dashboard
router.get('/', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    
    // Get statistics
    const tournamentsSnapshot = await db.collection('tournaments').get();
    const entriesSnapshot = await db.collection('entries').get();
    const usersSnapshot = await db.collection('users').get();
    
    const stats = {
      totalTournaments: tournamentsSnapshot.size,
      totalEntries: entriesSnapshot.size,
      totalUsers: usersSnapshot.size
    };
    
    res.render('admin/dashboard', { user: req.user, stats });
  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', { message: 'Failed to load admin dashboard', user: req.user });
  }
});

// Users management
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const usersSnapshot = await db.collection('users')
      .orderBy('lastLogin', 'desc')
      .get();
    
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('admin/users', { user: req.user, users });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).render('error', { message: 'Failed to load users', user: req.user });
  }
});

// Tournament management
router.get('/tournaments', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tournamentsSnapshot = await db.collection('tournaments')
      .orderBy('createdAt', 'desc')
      .get();
    
    const tournaments = await Promise.all(tournamentsSnapshot.docs.map(async (doc) => {
      const tournamentData = { id: doc.id, ...doc.data() };
      
      // Get entry count for each tournament
      const entriesSnapshot = await db.collection('entries')
        .where('tournamentId', '==', doc.id)
        .get();
      
      tournamentData.entryCount = entriesSnapshot.size;
      return tournamentData;
    }));
    
    res.render('admin/tournaments', { user: req.user, tournaments });
  } catch (error) {
    console.error('Error loading tournaments:', error);
    res.status(500).render('error', { message: 'Failed to load tournaments', user: req.user });
  }
});

// Create tournament
router.get('/tournaments/create', requireAdmin, (req, res) => {
  res.render('admin/create-tournament', { user: req.user });
});

router.post('/tournaments/create', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const {
      title,
      description,
      maxEntries,
      teamSize,
      rules,
      banPickRules,
      entryDeadline
    } = req.body;
    
    const tournamentData = {
      title,
      description,
      maxEntries: parseInt(maxEntries),
      teamSize: parseInt(teamSize),
      rules: rules || '',
      banPickRules: banPickRules || '',
      entryDeadline: new Date(entryDeadline),
      status: 'open',
      createdBy: req.user.discordId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('tournaments').add(tournamentData);
    
    res.redirect(`/admin/tournaments/${docRef.id}`);
  } catch (error) {
    console.error('Error creating tournament:', error);
    res.status(500).render('error', { message: 'Failed to create tournament', user: req.user });
  }
});

// Tournament detail and team management
router.get('/tournaments/:id', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tournamentDoc = await db.collection('tournaments').doc(req.params.id).get();
    
    if (!tournamentDoc.exists) {
      return res.status(404).render('error', { message: 'Tournament not found', user: req.user });
    }
    
    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
    
    // Update tournament status based on deadline
    const updatedStatus = getUpdatedTournamentStatus(tournament);
    if (updatedStatus !== tournament.status) {
      await db.collection('tournaments').doc(req.params.id).update({ 
        status: updatedStatus,
        updatedAt: new Date()
      });
      tournament.status = updatedStatus;
    }
    
    // Get entries
    const entriesSnapshot = await db.collection('entries')
      .where('tournamentId', '==', req.params.id)
      .get();
    
    const entries = entriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get teams if they exist
    const teamsSnapshot = await db.collection('teams')
      .where('tournamentId', '==', req.params.id)
      .get();
    
    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('admin/tournament-detail', { 
      user: req.user, 
      tournament, 
      entries, 
      teams 
    });
  } catch (error) {
    console.error('Error loading tournament detail:', error);
    res.status(500).render('error', { message: 'Failed to load tournament', user: req.user });
  }
});

// Create teams (random)
router.post('/tournaments/:id/teams/random', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tournamentId = req.params.id;
    
    // Get tournament and entries
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentDoc.data();
    
    // Only allow team creation for closed or ongoing tournaments
    if (tournament.status === 'open') {
      return res.status(400).json({ error: 'エントリー期限を締切ってからチームを作成してください' });
    }
    
    const entriesSnapshot = await db.collection('entries')
      .where('tournamentId', '==', tournamentId)
      .where('status', '==', 'confirmed')
      .get();
    
    const entries = entriesSnapshot.docs.map(doc => doc.data());
    
    // Validate team formation constraints
    const teamFormationValidation = validateTeamFormation(entries.length);
    if (!teamFormationValidation.allowed) {
      return res.status(400).json({ error: teamFormationValidation.reason });
    }
    
    // Delete existing teams first
    const existingTeamsSnapshot = await db.collection('teams')
      .where('tournamentId', '==', tournamentId)
      .get();
    
    const deleteBatch = db.batch();
    existingTeamsSnapshot.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    
    // Shuffle entries randomly
    const shuffledEntries = entries.sort(() => Math.random() - 0.5);
    const teamSize = tournament.teamSize || 5;
    const teams = [];
    
    for (let i = 0; i < shuffledEntries.length; i += teamSize) {
      const teamMembers = shuffledEntries.slice(i, i + teamSize);
      const teamName = `チーム${Math.floor(i / teamSize) + 1}`;
      
      const teamData = {
        tournamentId,
        name: teamName,
        members: teamMembers,
        createdAt: new Date(),
        createdBy: req.user.discordId
      };
      
      const teamRef = await db.collection('teams').add(teamData);
      teams.push({ id: teamRef.id, ...teamData });
    }
    
    console.log(`Created ${teams.length} teams for tournament ${tournamentId}`);
    
    res.json({ 
      success: true, 
      teams,
      teamsCreated: teams.length,
      message: `${teams.length}個のチームを作成しました`
    });
  } catch (error) {
    console.error('Error creating random teams:', error);
    res.status(500).json({ error: 'Failed to create teams' });
  }
});

// Settings
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const settingsDoc = await db.collection('settings').doc('general').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    
    res.render('admin/settings', { user: req.user, settings });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).render('error', { message: 'Failed to load settings', user: req.user });
  }
});

// Series Management
router.get('/series', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const seriesSnapshot = await db.collection('series')
      .orderBy('createdAt', 'desc')
      .get();
    
    const series = seriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get tournaments for the form
    const tournamentsSnapshot = await db.collection('tournaments').get();
    const tournaments = tournamentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('admin/series', { user: req.user, series, tournaments });
  } catch (error) {
    console.error('Error loading series:', error);
    res.status(500).render('error', { message: 'Failed to load series', user: req.user });
  }
});

router.post('/series', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const {
      tournamentId,
      seriesTitle,
      seriesType,
      team1Name,
      team2Name,
      notes
    } = req.body;
    
    const seriesData = {
      tournamentId,
      seriesTitle,
      seriesType, // 'BO3' or 'BO5'
      team1Name,
      team2Name,
      status: 'ongoing', // 'ongoing', 'completed'
      games: [],
      winner: null,
      notes: notes || '',
      createdBy: req.user.discordId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('series').add(seriesData);
    
    res.redirect(`/admin/series/${docRef.id}`);
  } catch (error) {
    console.error('Error creating series:', error);
    res.status(500).render('error', { message: 'Failed to create series', user: req.user });
  }
});

router.get('/series/:id', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const seriesDoc = await db.collection('series').doc(req.params.id).get();
    
    if (!seriesDoc.exists) {
      return res.status(404).render('error', { message: 'Series not found', user: req.user });
    }
    
    const series = { id: seriesDoc.id, ...seriesDoc.data() };
    
    // Get matches for this series
    const matchesSnapshot = await db.collection('matchResults')
      .where('seriesId', '==', req.params.id)
      .orderBy('gameNumber', 'asc')
      .get();
    
    const matches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.render('admin/series-detail', { user: req.user, series, matches });
  } catch (error) {
    console.error('Error loading series detail:', error);
    res.status(500).render('error', { message: 'Failed to load series', user: req.user });
  }
});

// Match Results Management
router.get('/match-results', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const resultsSnapshot = await db.collection('matchResults')
      .orderBy('createdAt', 'desc')
      .get();
    
    const results = resultsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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
    
    res.render('admin/match-results', { 
      user: req.user, 
      results, 
      tournaments, 
      activeSeries,
      survivorCharacters: getSurvivorCharacters(),
      hunterCharacters: getHunterCharacters(),
      getCharacterName
    });
  } catch (error) {
    console.error('Error loading match results:', error);
    res.status(500).render('error', { message: 'Failed to load match results', user: req.user });
  }
});

router.post('/match-results', requireAdmin, async (req, res) => {
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
      return res.status(400).render('error', { 
        message: 'サバイバープレイヤーを最低1人入力してください', 
        user: req.user 
      });
    }
    
    // Get scoring settings
    const settingsDoc = await db.collection('settings').doc('general').get();
    const settings = settingsDoc.data() || {};
    const enableBonusScoring = settings.enableBonusScoring || false;
    
    // Calculate points
    let hunterPoints = parseInt(eliminatedCount) || 0;
    let survivorPoints = parseInt(escapedCount) || 0;
    
    // Apply bonus scoring if enabled and survivors got 4 escapes
    if (enableBonusScoring && survivorPoints === 4) {
      survivorPoints = 5;
      hunterPoints = 0;
    }
    
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
      bonusApplied: enableBonusScoring && parseInt(escapedCount) === 4,
      notes: notes || '',
      createdBy: req.user.discordId,
      createdAt: new Date()
    };
    
    const matchRef = await db.collection('matchResults').add(matchData);
    
    // If this is part of a series, update the series with the game result
    if (seriesId && seriesData) {
      const updatedGames = [...(seriesData.games || []), {
        gameNumber,
        matchId: matchRef.id,
        winner: gameWinner,
        hunterPoints,
        survivorPoints
      }];
      
      // Calculate series winner based on BO3/BO5 rules
      const { seriesWinner, seriesComplete } = calculateSeriesWinner(seriesData.seriesType, updatedGames);
      
      await db.collection('series').doc(seriesId).update({
        games: updatedGames,
        winner: seriesWinner,
        status: seriesComplete ? 'completed' : 'ongoing',
        updatedAt: new Date()
      });
    }
    
    res.redirect('/admin/match-results?success=added');
  } catch (error) {
    console.error('Error adding match result:', error);
    res.status(500).render('error', { message: 'Failed to add match result', user: req.user });
  }
});

// Helper function to calculate series winner
function calculateSeriesWinner(seriesType, games) {
  const team1Wins = games.filter(game => game.winner === 'team1').length;
  const team2Wins = games.filter(game => game.winner === 'team2').length;
  
  let requiredWins, maxGames;
  if (seriesType === 'BO3') {
    requiredWins = 2;
    maxGames = 3;
  } else if (seriesType === 'BO5') {
    requiredWins = 3;
    maxGames = 5;
  } else {
    return { seriesWinner: null, seriesComplete: false };
  }
  
  // Check if someone has won
  if (team1Wins >= requiredWins) {
    return { seriesWinner: 'team1', seriesComplete: true };
  }
  if (team2Wins >= requiredWins) {
    return { seriesWinner: 'team2', seriesComplete: true };
  }
  
  // Check if series is complete (all games played)
  if (games.length >= maxGames) {
    // This shouldn't happen with proper BO3/BO5 logic, but handle it
    const winner = team1Wins > team2Wins ? 'team1' : 'team2';
    return { seriesWinner: winner, seriesComplete: true };
  }
  
  return { seriesWinner: null, seriesComplete: false };
}

// Update tournament status
router.put('/tournaments/:id/status', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    
    if (!['open', 'closed', 'ongoing', 'finished'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.collection('tournaments').doc(req.params.id).update({
      status,
      updatedAt: new Date()
    });
    
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating tournament status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Remove participant
router.delete('/tournaments/:id/participants/:participantId', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    
    await db.collection('entries').doc(req.params.participantId).delete();
    
    res.json({ success: true, message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Clear all teams
router.delete('/tournaments/:id/teams', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const tournamentId = req.params.id;
    
    const teamsSnapshot = await db.collection('teams')
      .where('tournamentId', '==', tournamentId)
      .get();
    
    const batch = db.batch();
    teamsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    res.json({ success: true, message: 'All teams cleared successfully' });
  } catch (error) {
    console.error('Error clearing teams:', error);
    res.status(500).json({ error: 'Failed to clear teams' });
  }
});

// Delete specific team
router.delete('/tournaments/:id/teams/:teamId', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    
    await db.collection('teams').doc(req.params.teamId).delete();
    
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { allowedGuildId, adminUserIds, enableBonusScoring } = req.body;
    
    const settingsData = {
      allowedGuildId: allowedGuildId || null,
      adminUserIds: adminUserIds ? adminUserIds.split(',').map(id => id.trim()) : [],
      enableBonusScoring: enableBonusScoring === 'on',
      updatedAt: new Date()
    };
    
    await db.collection('settings').doc('general').set(settingsData, { merge: true });
    
    res.redirect('/admin/settings?success=updated');
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).render('error', { message: 'Failed to update settings', user: req.user });
  }
});

// API endpoint to get teams for a tournament (for dynamic team member selection)
router.get('/api/tournaments/:id/teams', async (req, res) => {
  try {
    const db = getDb();
    const tournamentId = req.params.id;
    
    // Get teams for the tournament
    const teamsSnapshot = await db.collection('teams')
      .where('tournamentId', '==', tournamentId)
      .get();
    
    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Middleware to require admin privileges
async function requireAdmin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/discord');
  }
  
  try {
    const db = getDb();
    const settingsDoc = await db.collection('settings').doc('general').get();
    const settings = settingsDoc.data();
    
    if (settings && settings.adminUserIds && settings.adminUserIds.includes(req.user.discordId)) {
      req.user.isAdmin = true;
      return next();
    }
    
    res.status(403).render('error', { message: 'Admin access required', user: req.user });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).render('error', { message: 'Failed to verify admin status', user: req.user });
  }
}

module.exports = router;