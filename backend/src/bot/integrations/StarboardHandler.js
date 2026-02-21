import { EmbedBuilder } from 'discord.js';
import storage from '../../storage/StorageManager.js';

class StarboardHandler {
  constructor() {
    this.listeners = new Map(); // botId -> listener function
    this.writing = false;
  }

  isWriting() {
    return this.writing;
  }

  startForBot(botId, botConfig, discordClient) {
    const integrations = (botConfig.integrations || [])
      .filter(i => i.service === 'starboard' && i.config?.channelId);

    if (integrations.length === 0) return;

    const listener = async (reaction, user) => {
      if (user.bot) return;
      try {
        // Resolve partial reaction/message
        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        for (const integration of integrations) {
          await this.handleReaction(botId, integration, reaction, discordClient);
        }
      } catch (err) {
        console.error(`[StarboardHandler] Error for bot ${botId}:`, err.message);
      }
    };

    discordClient.on('messageReactionAdd', listener);
    this.listeners.set(botId, { listener, discordClient });
    console.log(`[StarboardHandler] Started for bot ${botId}`);
  }

  stopForBot(botId) {
    const entry = this.listeners.get(botId);
    if (entry) {
      entry.discordClient.removeListener('messageReactionAdd', entry.listener);
      this.listeners.delete(botId);
    }
  }

  reloadForBot(botId, botConfig, discordClient) {
    this.stopForBot(botId);
    this.startForBot(botId, botConfig, discordClient);
  }

  stopAll() {
    for (const [botId] of this.listeners) {
      this.stopForBot(botId);
    }
  }

  async handleReaction(botId, integration, reaction, discordClient) {
    const cfg = integration.config;
    const emoji = cfg.emoji || '⭐';
    const threshold = cfg.threshold || 3;

    if (reaction.emoji.name !== emoji && reaction.emoji.toString() !== emoji) return;

    const count = reaction.count;
    if (count < threshold) return;

    // Re-read config to get latest postedMessageIds
    const botConfig = await storage.readBot(botId);
    const freshInt = botConfig.integrations.find(i => i.id === integration.id);
    if (!freshInt) return;

    const postedIds = new Set(freshInt.config.postedMessageIds || []);
    const messageId = reaction.message.id;
    if (postedIds.has(messageId)) return;

    let channel;
    try {
      channel = await discordClient.channels.fetch(cfg.channelId);
    } catch {
      console.warn(`[StarboardHandler] Starboard channel ${cfg.channelId} not found`);
      return;
    }

    const message = reaction.message;
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || '')
      .addFields({ name: 'Source', value: `[Jump to message](${message.url})` })
      .setTimestamp(message.createdAt);

    if (message.attachments.size > 0) {
      const img = message.attachments.find(a => a.contentType?.startsWith('image/'));
      if (img) embed.setImage(img.url);
    }

    await channel.send({
      content: `${emoji} **${count}** | <#${message.channelId}>`,
      embeds: [embed]
    });

    // Persist the posted message ID
    postedIds.add(messageId);
    const intIndex = botConfig.integrations.findIndex(i => i.id === integration.id);
    botConfig.integrations[intIndex].config.postedMessageIds = Array.from(postedIds).slice(-1000);

    this.writing = true;
    await storage.writeBot(botId, botConfig);
    setTimeout(() => { this.writing = false; }, 1000);

    console.log(`[StarboardHandler] Posted message ${messageId} to starboard for bot ${botId}`);
  }
}

export default new StarboardHandler();
