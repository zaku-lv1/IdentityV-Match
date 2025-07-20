const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../config/firebase');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('tournament')
    .setDescription('大会情報を表示')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('大会ID')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('createteams')
    .setDescription('チームを作成（管理者のみ）')
    .addStringOption(option =>
      option.setName('tournament_id')
        .setDescription('大会ID')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Register slash commands
  try {
    await client.application.commands.set(commands);
    console.log('Slash commands registered successfully');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'tournament') {
    const tournamentId = interaction.options.getString('id');
    // Tournament information logic
    await interaction.reply(`大会 ${tournamentId} の情報を表示します。`);
  }

  if (commandName === 'createteams') {
    const tournamentId = interaction.options.getString('tournament_id');
    
    try {
      const db = getDb();
      const tournamentRef = db.collection('tournaments').doc(tournamentId);
      const tournamentDoc = await tournamentRef.get();
      
      if (!tournamentDoc.exists) {
        await interaction.reply('指定された大会が見つかりません。');
        return;
      }
      
      const tournament = tournamentDoc.data();
      const entriesSnapshot = await db.collection('entries')
        .where('tournamentId', '==', tournamentId)
        .where('status', '==', 'confirmed')
        .get();
      
      const entries = entriesSnapshot.docs.map(doc => doc.data());
      
      // Team creation logic
      await createTeamsAndChannels(interaction.guild, tournament, entries);
      
      await interaction.reply('チームとチャンネルを作成しました！');
    } catch (error) {
      console.error('Error creating teams:', error);
      await interaction.reply('チーム作成中にエラーが発生しました。');
    }
  }
});

async function createTeamsAndChannels(guild, tournament, entries) {
  const teamSize = tournament.teamSize || 5;
  const teams = [];
  
  // Team division logic (random or manual)
  for (let i = 0; i < entries.length; i += teamSize) {
    const teamMembers = entries.slice(i, i + teamSize);
    const teamName = `チーム${Math.floor(i / teamSize) + 1}`;
    
    // Create role
    const role = await guild.roles.create({
      name: teamName,
      color: 'Random',
      mentionable: true
    });
    
    // Create category
    const category = await guild.channels.create({
      name: teamName,
      type: 4 // Category
    });
    
    // Create text channel
    const textChannel = await guild.channels.create({
      name: `${teamName}-作戦会議`,
      type: 0, // Text
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: ['ViewChannel']
        },
        {
          id: role.id,
          allow: ['ViewChannel', 'SendMessages']
        }
      ]
    });
    
    // Create voice channel
    const voiceChannel = await guild.channels.create({
      name: `${teamName}-VC`,
      type: 2, // Voice
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: ['ViewChannel']
        },
        {
          id: role.id,
          allow: ['ViewChannel', 'Connect', 'Speak']
        }
      ]
    });
    
    // Assign roles to members
    for (const entry of teamMembers) {
      try {
        const member = await guild.members.fetch(entry.discordId);
        await member.roles.add(role);
      } catch (error) {
        console.error(`Error assigning role to ${entry.discordId}:`, error);
      }
    }
    
    teams.push({
      name: teamName,
      members: teamMembers,
      roleId: role.id,
      textChannelId: textChannel.id,
      voiceChannelId: voiceChannel.id
    });
  }
  
  return teams;
}

client.login(process.env.DISCORD_BOT_TOKEN);