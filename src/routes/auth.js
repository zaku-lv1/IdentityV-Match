const express = require('express');
const passport = require('../config/passport');
const { getDb } = require('../config/firebase');
const router = express.Router();

// Discord OAuth login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      const db = getDb();
      const settingsDoc = await db.collection('settings').doc('general').get();
      const settings = settingsDoc.data();
      
      if (settings && settings.allowedGuildId) {
        // Check if user is in the allowed Discord server
        const userGuilds = req.user.guilds || [];
        const isInAllowedGuild = userGuilds.some(guild => guild.id === settings.allowedGuildId);
        
        if (!isInAllowedGuild) {
          req.logout(() => {
            res.redirect('/?error=not_in_server');
          });
          return;
        }
      }
      
      res.redirect('/');
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect('/?error=auth_failed');
    }
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// Profile setup/edit
router.get('/profile', requireAuth, (req, res) => {
  res.render('profile', { user: req.user });
});

router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { hunterRank, survivorRank, identityVAccountId } = req.body;
    const db = getDb();
    
    // Validate ranks (1-8, where 8 is 最高峰)
    const validRanks = ['1', '2', '3', '4', '5', '6', '7', '8'];
    if (!validRanks.includes(hunterRank) || !validRanks.includes(survivorRank)) {
      return res.redirect('/auth/profile?error=invalid_rank');
    }
    
    // Validate IdentityV Account ID (should be numeric if provided)
    if (identityVAccountId && !/^\d+$/.test(identityVAccountId)) {
      return res.redirect('/auth/profile?error=invalid_account_id');
    }
    
    const updateData = {
      hunterRank: parseInt(hunterRank),
      survivorRank: parseInt(survivorRank),
      identityVAccountId: identityVAccountId || null,
      updatedAt: new Date()
    };
    
    await db.collection('users').doc(req.user.discordId).update(updateData);
    
    // Update the session user data
    req.user.hunterRank = parseInt(hunterRank);
    req.user.survivorRank = parseInt(survivorRank);
    req.user.identityVAccountId = identityVAccountId || null;
    
    res.redirect('/?success=profile_updated');
  } catch (error) {
    console.error('Profile update error:', error);
    res.redirect('/auth/profile?error=update_failed');
  }
});

// Middleware to require authentication
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/discord');
}

module.exports = router;