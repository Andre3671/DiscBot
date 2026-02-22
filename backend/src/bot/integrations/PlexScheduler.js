import cron from 'node-cron';
import axios from 'axios';
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

    // Group items and build embeds (one per show, one per movie)
    const toAnnounce = newItems.slice(0, 25);
    const embeds = await this.buildGroupedEmbeds(toAnnounce, freshIntegration);

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

  /**
   * Build grouped embeds: one embed per unique show, one per movie.
   * Episodes of the same show are collapsed into a single embed with their
   * show poster and a compact episode list (S01E01 · S01E02 · ...).
   * IMDb URLs are fetched in parallel and set as the embed title link.
   */
  async buildGroupedEmbeds(items, integration, isTest = false) {
    const baseUrl = (integration.config.apiUrl || '').replace(/\/$/, '');
    const token = integration.config.apiKey;
    const serverName = integration.config?.serverName || 'Plex Server';
    const footerText = isTest
      ? `TEST | ${serverName} | Recently Added`
      : `${serverName} | Recently Added`;

    // Group episodes by show, separate movies and other
    const showMap = new Map();
    const movies = [];
    const other = [];

    for (const item of items) {
      if (item.type === 'episode') {
        const key = item.grandparentRatingKey || item.grandparentTitle || 'unknown';
        if (!showMap.has(key)) {
          showMap.set(key, {
            ratingKey: item.grandparentRatingKey,
            title: item.grandparentTitle || 'Unknown Show',
            year: item.parentYear || item.year,
            thumb: item.grandparentThumb || item.thumb,
            episodes: []
          });
        }
        showMap.get(key).episodes.push(item);
      } else if (item.type === 'movie') {
        movies.push(item);
      } else {
        other.push(item);
      }
    }

    // Fetch IMDb URLs in parallel for all unique shows and movies
    const imdbUrls = new Map();
    const fetches = [];
    for (const [key, show] of showMap) {
      if (show.ratingKey) {
        fetches.push(
          this.fetchImdbUrl(integration, show.ratingKey).then(url => {
            if (url) imdbUrls.set(key, url);
          })
        );
      }
    }
    for (const movie of movies) {
      if (movie.ratingKey) {
        fetches.push(
          this.fetchImdbUrl(integration, movie.ratingKey).then(url => {
            if (url) imdbUrls.set(movie.ratingKey, url);
          })
        );
      }
    }
    await Promise.all(fetches);

    const embeds = [];

    // One embed per show
    for (const [key, show] of showMap) {
      const episodeList = show.episodes
        .map(ep => {
          const s = ep.parentIndex != null ? `S${String(ep.parentIndex).padStart(2, '0')}` : '';
          const e = ep.index != null ? `E${String(ep.index).padStart(2, '0')}` : '';
          return (s + e) || ep.title;
        })
        .join(' · ');

      const embed = new EmbedBuilder()
        .setTitle(`📺 ${show.title}`)
        .setDescription(episodeList)
        .setColor('#e5a00d')
        .setFooter({ text: footerText })
        .setTimestamp();

      if (imdbUrls.has(key)) embed.setURL(imdbUrls.get(key));
      if (show.year) embed.addFields({ name: 'Year', value: String(show.year), inline: true });
      embed.addFields({ name: 'New episodes', value: String(show.episodes.length), inline: true });
      if (show.thumb) embed.setThumbnail(`${baseUrl}${show.thumb}?X-Plex-Token=${token}`);

      embeds.push(embed);
    }

    // One embed per movie
    for (const movie of movies) {
      const embed = new EmbedBuilder()
        .setTitle(`🎬 ${movie.title}`)
        .setColor('#e5a00d')
        .setFooter({ text: footerText })
        .setTimestamp();

      if (imdbUrls.has(movie.ratingKey)) embed.setURL(imdbUrls.get(movie.ratingKey));
      if (movie.year) embed.addFields({ name: 'Year', value: String(movie.year), inline: true });
      if (movie.summary) embed.setDescription(movie.summary.slice(0, 150) + (movie.summary.length > 150 ? '…' : ''));
      if (movie.thumb) embed.setThumbnail(`${baseUrl}${movie.thumb}?X-Plex-Token=${token}`);

      embeds.push(embed);
    }

    // Anything else (albums, etc.)
    for (const item of other) {
      const title = item.grandparentTitle ? `${item.grandparentTitle} — ${item.title}` : item.title;
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#e5a00d')
        .setFooter({ text: footerText })
        .setTimestamp();

      if (item.thumb) embed.setThumbnail(`${baseUrl}${item.thumb}?X-Plex-Token=${token}`);

      embeds.push(embed);
    }

    return embeds;
  }

  /**
   * Fetch the IMDb URL for a Plex item by its ratingKey.
   * Returns null if not found or on error.
   */
  async fetchImdbUrl(integration, ratingKey) {
    try {
      const { apiUrl, apiKey } = integration.config || {};
      const baseUrl = apiUrl.replace(/\/$/, '');
      const response = await axios.get(`${baseUrl}/library/metadata/${ratingKey}`, {
        headers: { 'X-Plex-Token': apiKey, 'Accept': 'application/json' },
        params: { includeGuids: 1 }
      });
      const metadata = response.data?.MediaContainer?.Metadata?.[0];
      const imdbGuid = metadata?.Guid?.find(g => g.id?.startsWith('imdb://'));
      if (!imdbGuid) return null;
      const imdbId = imdbGuid.id.replace('imdb://', '');
      return `https://www.imdb.com/title/${imdbId}/`;
    } catch {
      return null;
    }
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

    // Build grouped embeds (one per show, one per movie) and send
    const toSend = recentItems.slice(0, 25);
    const embeds = await this.buildGroupedEmbeds(toSend, integration, true);

    for (let i = 0; i < embeds.length; i += 10) {
      await channel.send({ embeds: embeds.slice(i, i + 10) });
    }

    const itemCount = toSend.length;
    const embedCount = embeds.length;
    const extra = recentItems.length > 25 ? ` (showing 25 of ${recentItems.length} items)` : '';
    return { sent: embedCount, message: `Sent ${itemCount} item(s) as ${embedCount} grouped embed(s) to #${channel.name}${extra}` };
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
