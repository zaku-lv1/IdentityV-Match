const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { getDb } = require('./firebase');
const admin = require('firebase-admin');

// Skip Discord strategy initialization if credentials are not provided or are mock values
if (process.env.DISCORD_CLIENT_ID && 
    process.env.DISCORD_CLIENT_SECRET && 
    process.env.DISCORD_CLIENT_ID !== 'mock_client_id') {
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds']
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    const db = getDb();
    const userRef = db.collection('users').doc(profile.id);
    const userDoc = await userRef.get();
    
    const userData = {
      discordId: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      accessToken: accessToken,
      guilds: profile.guilds || [],
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (!userDoc.exists) {
      // New user
      userData.hunterRank = null;
      userData.survivorRank = null;
      userData.identityVAccountId = null;
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await userRef.set(userData, { merge: true });
    return done(null, userData);
  } catch (error) {
    return done(error, null);
  }
}));
} else {
  console.log('Discord OAuth not configured - running in development mode without OAuth');
}

passport.serializeUser((user, done) => {
  done(null, user.discordId);
});

passport.deserializeUser(async (discordId, done) => {
  try {
    const db = getDb();
    const userDoc = await db.collection('users').doc(discordId).get();
    if (userDoc.exists) {
      done(null, userDoc.data());
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;