const express = require('express');
const passport = require('../config/passport');
const { getDb } = require('../config/firebase');
const router = express.Router();

// Development mode login (when Discord OAuth is not configured)
if (process.env.NODE_ENV === 'development' && 
    (!process.env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID === 'mock_client_id')) {
  
  router.get('/dev-login', async (req, res) => {
    try {
      const db = getDb();
      
      // Create a mock user for development
      const mockUser = {
        discordId: 'dev_user_123',
        username: 'Developer',
        discriminator: '0001',
        avatar: null,
        hunterRank: 5,
        survivorRank: 6,
        identityVAccountId: '123456789',
        isAdmin: true,
        guilds: [],
        lastLogin: new Date(),
        createdAt: new Date()
      };
      
      // Store mock user in database
      await db.collection('users').doc(mockUser.discordId).set(mockUser, { merge: true });
      
      // Log in the user
      req.login(mockUser, (err) => {
        if (err) {
          console.error('Dev login error:', err);
          return res.redirect('/?error=dev_login_failed');
        }
        res.redirect('/');
      });
    } catch (error) {
      console.error('Dev login error:', error);
      res.redirect('/?error=dev_login_failed');
    }
  });
}

// Discord OAuth login
router.get('/discord', (req, res) => {
  if (process.env.NODE_ENV === 'development' && 
      (!process.env.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID === 'mock_client_id')) {
    return res.redirect('/auth/dev-login');
  }
  passport.authenticate('discord')(req, res);
});

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