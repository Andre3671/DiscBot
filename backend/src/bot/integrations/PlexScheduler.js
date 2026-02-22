import cron from 'node-cron';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import storage from '../../storage/StorageManager.js';
import PlexIntegration from './PlexIntegration.js';

const INTERVAL_CRON = {
  hourly:   '0 * * * *',
  every6h:  '0 */6 * * *',
  daily:    '0 9 * * *',
  weekly:   '0 9 * * 1'
};

class PlexScheduler {
  constructor() {
    this.jobs = new Map();
    this.writing = false; // Flag to prevent reload loops
  }

  /**
   * Start all Plex schedulers for a given bot
   */
  startForBot(botId, botConfig, discordClient) {
    const plexIntegrations = (botConfig.integrations || [])
      .filter(int => int.service === 'plex' && int.config?.scheduler?.enabled);

    for (const integration of plexIntegrations) {
      this.startJob(botId, integration, discordClient);
    }
  }

  /**
   * Stop all Plex schedulers for a given bot
   */
  stopForBot(botId) {
    for (const [key, task] of this.jobs.entries()) {
      if (key.startsWith(`${botId}-`)) {
        task.stop();
        this.jobs.delete(key);
      }
    }
  }

  /**
   * Reload schedulers for a bot (stop then start)
   */
  reloadForBot(botId, botConfig, discordClient) {
    this.stopForBot(botId);
    this.startForBot(botId, botConfig, discordClient);
  }

  /**
   * Check if currently writing to prevent reload loops
   */
  isWriting() {
    return this.writing;
  }

  startJob(botId, integration, discordClient) {
    const key = `${botId}-${integration.id}`;
    const scheduler = integration.config.scheduler;
    const cronExpr = INTERVAL_CRON[scheduler.interval] || INTERVAL_CRON.daily;

    // Stop existing job if present
    if (this.jobs.has(key)) {
      this.jobs.get(key).stop();
    }

    const task = cron.schedule(cronExpr, async () => {
      try {
        await this.checkAndAnnounce(botId, integration, discordClient);
      } catch (error) {
        console.error(`[PlexScheduler] Error for bot ${botId}:`, error.message);
      }
    });

    this.jobs.set(key, task);
    console.log(`[PlexScheduler] Started job for bot ${botId}, interval: ${scheduler.interval}`);

    // Run initial check immediately
    this.checkAndAnnounce(botId, integration, discordClient).catch(err => {
      console.error(`[PlexScheduler] Initial check error for bot ${botId}:`, err.message);
    });
  }

  async checkAndAnnounce(botId, integration, discordClient) {
    // Re-read config to get latest announcedIds
    const botConfig = await storage.readBot(botId);
    const freshIntegration = botConfig.integrations.find(i => i.id === integration.id);
    if (!freshIntegration || !freshIntegration.config?.scheduler?.enabled) return;

    const scheduler = freshIntegration.config.scheduler;
    const channelId = scheduler.channelId;
    if (!channelId) return;

    let channel;
    try {
      channel = await discordClient.channels.fetch(channelId);
    } catch {
      console.warn(`[PlexScheduler] Channel ${channelId} not found for bot ${botId}`);
      return;
    }

    // Fetch recently added from Plex
    const items = await PlexIntegration.plexRequest(freshIntegration, '/library/recentlyAdded');
    if (!items || items.length === 0) return;

    const announcedIds = new Set(scheduler.announcedIds || []);
    const newItems = items.filter(item => !announcedIds.has(String(item.ratingKey)));

    if (newItems.length === 0) {
      console.log(`[PlexScheduler] No new items for bot ${botId}`);
      return;
    }

    console.log(`[PlexScheduler] Found ${newItems.length} new items for bot ${botId}`);

    // Build all embeds then send in batches of 10 (Discord limit per message)
    const toAnnounce = newItems.slice(0, 25);
    const embeds = toAnnounce.map(item => this.buildEmbed(item, freshIntegration));

    for (let i = 0; i < embeds.length; i += 10) {
      try {
        await channel.send({ embeds: embeds.slice(i, i + 10) });
      } catch (err) {
        console.error(`[PlexScheduler] Failed to send embed batch:`, err.message);
      }
    }

    for (const item of toAnnounce) {
      announcedIds.add(String(item.ratingKey));
    }

    // Persist updated state (cap at 500 IDs)
    const updatedIds = Array.from(announcedIds).slice(-500);
    const intIndex = botConfig.integrations.findIndex(i => i.id === integration.id);
    botConfig.integrations[intIndex].config.scheduler.announcedIds = updatedIds;
    botConfig.integrations[intIndex].config.scheduler.lastChecked = new Date().toISOString();

    // Set writing flag to prevent reload loop from file watcher
    this.writing = true;
    await storage.writeBot(botId, botConfig);
    setTimeout(() => { this.writing = false; }, 1000);
  }

  buildEmbed(item, integration) {
    const mediaType = this.getMediaType(item.type);
    const title = item.grandparentTitle
      ? `${item.grandparentTitle} - ${item.title}`
      : item.title;

    const embed = new EmbedBuilder()
      .setTitle(`New on Plex: ${title}`)
      .setColor('#e5a00d')
      .setFooter({ text: `${integration.config.serverName || 'Plex Server'} | Recently Added` })
      .setTimestamp();

    const parts = [];
    if (item.year) parts.push(`**Year:** ${item.year}`);
    parts.push(`**Type:** ${mediaType}`);
    embed.setDescription(parts.join('\n'));

    // Poster thumbnail
    if (item.thumb) {
      const baseUrl = integration.config.apiUrl.replace(/\/$/, '');
      const thumbUrl = `${baseUrl}${item.thumb}?X-Plex-Token=${integration.config.apiKey}`;
      embed.setThumbnail(thumbUrl);
    }

    return embed;
  }

  getMediaType(type) {
    const types = {
      movie: 'Movie',
      show: 'TV Show',
      season: 'Season',
      episode: 'Episode'
    };
    return types[type] || type || 'Unknown';
  }

  /**
   * Test check: fetch recently added items within the interval window and post to channel.
   * Does NOT update announcedIds so the real scheduled run still picks them up.
   */
  async testCheck(botId, integrationId, discordClient) {
    const botConfig = await storage.readBot(botId);
    const integration = botConfig.integrations.find(i => i.id === integrationId);
    if (!integration) throw new Error('Integration not found');

    const scheduler = integration.config?.scheduler;
    if (!scheduler?.channelId) throw new Error('No channel configured for scheduler');

    let channel;
    try {
      channel = await discordClient.channels.fetch(scheduler.channelId);
    } catch {
      throw new Error(`Channel ${scheduler.channelId} not found (bot may not have access)`);
    }

    // Check bot has permission to send embeds in the channel
    const perms = channel.permissionsFor(discordClient.user);
    if (!perms?.has(PermissionFlagsBits.SendMessages)) {
      throw new Error(`Bot is missing Send Messages permission in #${channel.name}`);
    }
    if (!perms?.has(PermissionFlagsBits.EmbedLinks)) {
      throw new Error(`Bot is missing Embed Links permission in #${channel.name}`);
    }

    // Fetch recently added from Plex
    const items = await PlexIntegration.plexRequest(integration, '/library/recentlyAdded');
    if (!items || items.length === 0) {
      return { sent: 0, message: 'No recently added items found on Plex.' };
    }

    // Filter by time window based on interval
    const windowMs = {
      hourly: 60 * 60 * 1000,
      every6h: 6 * 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    const cutoff = Date.now() - (windowMs[scheduler.interval] || windowMs.daily);
    const recentItems = items.filter(item => {
      const addedAt = (item.addedAt || 0) * 1000; // Plex uses Unix seconds
      return addedAt >= cutoff;
    });

    if (recentItems.length === 0) {
      return { sent: 0, message: `No items added in the last ${scheduler.interval} window.` };
    }

    // Build all embeds and send grouped in one message (max 10 per Discord message)
    const toSend = recentItems.slice(0, 10);
    const embeds = toSend.map(item => {
      const embed = this.buildEmbed(item, integration);
      embed.setFooter({ text: `TEST | ${integration.config.serverName || 'Plex Server'} | Recently Added` });
      return embed;
    });

    await channel.send({ embeds });

    const extra = recentItems.length > 10 ? ` (showing 10 of ${recentItems.length})` : '';
    return { sent: embeds.length, message: `Sent ${embeds.length} item(s) in 1 message to #${channel.name}${extra}` };
  }

  /**
   * Stop all jobs globally
   */
  stopAll() {
    for (const [key, task] of this.jobs.entries()) {
      task.stop();
    }
    this.jobs.clear();
  }
}

export default new PlexScheduler();
