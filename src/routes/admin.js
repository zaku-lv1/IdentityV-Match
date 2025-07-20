const express = require('express');
const { getDb } = require('../config/firebase');
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
    const tournament = tournamentDoc.data();
    
    const entriesSnapshot = await db.collection('entries')
      .where('tournamentId', '==', tournamentId)
      .where('status', '==', 'confirmed')
      .get();
    
    const entries = entriesSnapshot.docs.map(doc => doc.data());
    
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
        createdAt: new Date()
      };
      
      const teamRef = await db.collection('teams').add(teamData);
      teams.push({ id: teamRef.id, ...teamData });
    }
    
    res.json({ success: true, teams });
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

router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { allowedGuildId, adminUserIds } = req.body;
    
    const settingsData = {
      allowedGuildId: allowedGuildId || null,
      adminUserIds: adminUserIds ? adminUserIds.split(',').map(id => id.trim()) : [],
      updatedAt: new Date()
    };
    
    await db.collection('settings').doc('general').set(settingsData, { merge: true });
    
    res.redirect('/admin/settings?success=updated');
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).render('error', { message: 'Failed to update settings', user: req.user });
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