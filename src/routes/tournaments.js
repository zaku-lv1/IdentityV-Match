const express = require('express');
const { getDb } = require('../config/firebase');
const { 
  isEntryAllowed, 
  getUpdatedTournamentStatus,
  formatJapaneseDate,
  getTimeRemaining 
} = require('../utils/tournamentUtils');
const router = express.Router();

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const tournamentsSnapshot = await db.collection('tournaments')
      .orderBy('createdAt', 'desc')
      .get();
    
    const tournaments = await Promise.all(tournamentsSnapshot.docs.map(async (doc) => {
      const tournamentData = { id: doc.id, ...doc.data() };
      
      // Update tournament status based on deadline
      const updatedStatus = getUpdatedTournamentStatus(tournamentData);
      if (updatedStatus !== tournamentData.status) {
        // Update status in database
        await db.collection('tournaments').doc(doc.id).update({ 
          status: updatedStatus,
          updatedAt: new Date()
        });
        tournamentData.status = updatedStatus;
      }
      
      // Add deadline information
      tournamentData.deadlineInfo = getTimeRemaining(tournamentData.entryDeadline);
      
      return tournamentData;
    }));
    
    console.log('Tournaments loaded:', tournaments.length); // デバッグ用
    
    res.render('tournaments', { 
      user: req.user, 
      tournaments: tournaments 
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).render('error', { 
      message: 'Failed to load tournaments', 
      user: req.user 
    });
  }
});

// Get specific tournament
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const tournamentDoc = await db.collection('tournaments').doc(req.params.id).get();
    
    if (!tournamentDoc.exists) {
      return res.status(404).render('error', { 
        message: 'Tournament not found', 
        user: req.user 
      });
    }
    
    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() };
    
    // Update tournament status based on deadline
    const updatedStatus = getUpdatedTournamentStatus(tournament);
    if (updatedStatus !== tournament.status) {
      // Update status in database
      await db.collection('tournaments').doc(req.params.id).update({ 
        status: updatedStatus,
        updatedAt: new Date()
      });
      tournament.status = updatedStatus;
    }
    
    // Add deadline and entry permission information
    tournament.deadlineInfo = getTimeRemaining(tournament.entryDeadline);
    tournament.entryPermission = isEntryAllowed(tournament);
    
    // Get entries for this tournament
    const entriesSnapshot = await db.collection('entries')
      .where('tournamentId', '==', req.params.id)
      .get();
    
    const entries = entriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Check if user is already entered
    let userEntry = null;
    if (req.user) {
      userEntry = entries.find(entry => entry.discordId === req.user.discordId);
    }
    
    console.log('Tournament detail loaded:', tournament.title); // デバッグ用
    console.log('Entries count:', entries.length); // デバッグ用
    console.log('Entry permission:', tournament.entryPermission); // デバッグ用
    
    res.render('tournament-detail', { 
      user: req.user, 
      tournament, 
      entries, 
      userEntry,
      formatDate: formatJapaneseDate
    });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).render('error', { 
      message: 'Failed to load tournament', 
      user: req.user 
    });
  }
});

// Enter tournament
router.post('/:id/enter', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const tournamentId = req.params.id;
    
    // Check if tournament exists and get current data
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentDoc.data();
    
    // Update tournament status based on deadline
    const updatedStatus = getUpdatedTournamentStatus(tournament);
    if (updatedStatus !== tournament.status) {
      await db.collection('tournaments').doc(tournamentId).update({ 
        status: updatedStatus,
        updatedAt: new Date()
      });
      tournament.status = updatedStatus;
    }
    
    // Check if entry is allowed (deadline and status)
    const entryPermission = isEntryAllowed(tournament);
    if (!entryPermission.allowed) {
      return res.status(400).json({ error: entryPermission.reason });
    }
    
    // Check if user already entered
    const existingEntrySnapshot = await db.collection('entries')
      .where('tournamentId', '==', tournamentId)
      .where('discordId', '==', req.user.discordId)
      .get();
    
    if (!existingEntrySnapshot.empty) {
      return res.status(400).json({ error: 'Already entered' });
    }
    
    // Check if user has set ranks
    if (!req.user.hunterRank || !req.user.survivorRank) {
      return res.status(400).json({ error: 'Please set your ranks first' });
    }
    
    // Check if tournament is full
    const entriesSnapshot = await db.collection('entries')
      .where('tournamentId', '==', tournamentId)
      .get();
    
    if (tournament.maxEntries && entriesSnapshot.size >= tournament.maxEntries) {
      return res.status(400).json({ error: '定員に達しています' });
    }
    
    // Create entry
    const entryData = {
      tournamentId,
      discordId: req.user.discordId,
      username: req.user.username,
      hunterRank: req.user.hunterRank,
      survivorRank: req.user.survivorRank,
      status: 'confirmed',
      enteredAt: new Date()
    };
    
    await db.collection('entries').add(entryData);
    
    console.log('User entered tournament:', req.user.username, '→', tournament.title); // デバッグ用
    
    res.json({ success: true, message: 'Successfully entered tournament' });
  } catch (error) {
    console.error('Error entering tournament:', error);
    res.status(500).json({ error: 'Failed to enter tournament' });
  }
});

// Cancel entry
router.delete('/:id/enter', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const tournamentId = req.params.id;
    
    // Check if tournament exists and get current data
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentDoc.data();
    
    // Update tournament status based on deadline
    const updatedStatus = getUpdatedTournamentStatus(tournament);
    if (updatedStatus !== tournament.status) {
      await db.collection('tournaments').doc(tournamentId).update({ 
        status: updatedStatus,
        updatedAt: new Date()
      });
      tournament.status = updatedStatus;
    }
    
    // Check if cancellation is allowed (deadline and status)
    const entryPermission = isEntryAllowed(tournament);
    if (!entryPermission.allowed) {
      return res.status(400).json({ error: entryPermission.reason });
    }
    
    // Find user's entry
    const entrySnapshot = await db.collection('entries')
      .where('tournamentId', '==', tournamentId)
      .where('discordId', '==', req.user.discordId)
      .get();
    
    if (entrySnapshot.empty) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    // Delete entry - batch delete to handle multiple docs
    const batch = db.batch();
    entrySnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    console.log('User cancelled entry:', req.user.username, '→', tournamentId); // デバッグ用
    
    res.json({ success: true, message: 'Entry cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling entry:', error);
    res.status(500).json({ error: 'Failed to cancel entry' });
  }
});

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

module.exports = router;