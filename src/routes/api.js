const express = require('express');
const { getDb } = require('../config/firebase');
const router = express.Router();

// Middleware to require authentication for admin operations
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

function requireAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

// Get teams for a specific tournament
router.get('/tournaments/:id/teams', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const tournamentId = req.params.id;
    
    // Get teams for this tournament
    const teamsSnapshot = await db.collection('teams')
      .where('tournamentId', '==', tournamentId)
      .get();
    
    const teams = teamsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ teams });
  } catch (error) {
    console.error('Error fetching tournament teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get members for a specific team
router.get('/teams/:id/members', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const teamId = req.params.id;
    
    // Get team data
    const teamDoc = await db.collection('teams').doc(teamId).get();
    
    if (!teamDoc.exists) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const teamData = teamDoc.data();
    const members = teamData.members || [];
    
    res.json({ 
      teamId,
      teamName: teamData.name,
      members 
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Update team composition (admin only)
router.put('/teams/:id', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const teamId = req.params.id;
    const { name, members } = req.body;
    
    // Validate input
    if (!name || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid team data' });
    }
    
    // Validate team members (4-7 people)
    if (members.length < 4 || members.length > 7) {
      return res.status(400).json({ error: 'Team must have 4-7 members' });
    }
    
    // Check if team exists
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Update team
    const updateData = {
      name,
      members,
      updatedAt: new Date(),
      updatedBy: req.user.discordId
    };
    
    await db.collection('teams').doc(teamId).update(updateData);
    
    res.json({ 
      success: true, 
      message: 'Team updated successfully',
      teamId,
      team: { id: teamId, ...teamDoc.data(), ...updateData }
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Create new team (admin only)
router.post('/teams', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { tournamentId, name, members } = req.body;
    
    // Validate input
    if (!tournamentId || !name || !Array.isArray(members)) {
      return res.status(400).json({ error: 'Invalid team data' });
    }
    
    // Validate team members (4-7 people)
    if (members.length < 4 || members.length > 7) {
      return res.status(400).json({ error: 'Team must have 4-7 members' });
    }
    
    // Check if tournament exists
    const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();
    if (!tournamentDoc.exists) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    // Create team
    const teamData = {
      tournamentId,
      name,
      members,
      createdAt: new Date(),
      createdBy: req.user.discordId
    };
    
    const teamRef = await db.collection('teams').add(teamData);
    
    res.json({ 
      success: true, 
      message: 'Team created successfully',
      teamId: teamRef.id,
      team: { id: teamRef.id, ...teamData }
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

module.exports = router;