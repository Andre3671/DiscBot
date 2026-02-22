import cron from 'node-cron';
import axios from 'axios';
import { EmbedBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
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

    const toAnnounce = newItems.slice(0, 25);
    try {
      await this.sendGroupedItems(channel, toAnnounce, freshIntegration);
    } catch (err) {
      console.error(`[PlexScheduler] Failed to send newsletter:`, err.message);
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
   * Send grouped items as a grid: one text embed listing all titles + episode info,
   * plus poster images downloaded from Plex sent as file attachments.
   * Discord auto-renders multiple image attachments as a visual grid.
   */
  async sendGroupedItems(channel, items, integration, isTest = false) {
    const baseUrl = (integration.config.apiUrl || '').replace(/\/$/, '');
    const token = integration.config.apiKey;
    const serverName = integration.config?.serverName || 'Plex Server';
    const footerText = isTest
      ? `TEST | ${serverName} | Recently Added`
      : `${serverName} | Recently Added`;

    // Group episodes/seasons by show, separate movies
    const showMap = new Map();
    const movies = [];

    for (const item of items) {
      if (item.type === 'episode' || item.type === 'season') {
        // Plex hierarchy: Show > Season > Episode
        // For type=episode: grandparent = show, parent = season
        // For type=season:  parent = show  (no grandparent)
        let showKey, showRatingKey, showTitle, showYear, showThumb;
        if (item.type === 'episode') {
          showKey = item.grandparentRatingKey || item.grandparentTitle || item.ratingKey || 'unknown';
          showRatingKey = item.grandparentRatingKey || null;
          showTitle = item.grandparentTitle || 'Unknown Show';
          showYear = item.year;
          showThumb = item.grandparentThumb || item.parentThumb || item.thumb || null;
        } else {
          showKey = item.parentRatingKey || item.parentTitle || item.ratingKey || 'unknown';
          showRatingKey = item.parentRatingKey || item.ratingKey || null;
          showTitle = item.parentTitle || 'Unknown Show';
          showYear = item.parentYear || item.year;
          showThumb = item.parentThumb || item.thumb || null;
        }

        if (!showMap.has(showKey)) {
          showMap.set(showKey, {
            ratingKey: showRatingKey,
            title: showTitle,
            year: showYear,
            thumb: showThumb,
            addedAt: item.addedAt || 0,
            episodes: [],
            seasons: []
          });
        }
        const show = showMap.get(showKey);
        if (!show.thumb) show.thumb = showThumb;
        if ((item.addedAt || 0) > show.addedAt) show.addedAt = item.addedAt || 0;

        if (item.type === 'season') {
          show.seasons.push(item.title || (item.index != null ? `Season ${item.index}` : 'New Season'));
        } else {
          show.episodes.push(item);
        }
      } else if (item.type === 'movie') {
        movies.push(item);
      }
    }

    // Fetch IMDb URLs in parallel
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

    // Build entries list with description line and thumb URL per item
    const entries = [];

    for (const [key, show] of showMap) {
      let episodeStr;
      if (show.episodes.length > 0) {
        episodeStr = show.episodes
          .map(ep => {
            const s = ep.parentIndex != null ? `S${String(ep.parentIndex).padStart(2, '0')}` : '';
            const e = ep.index != null ? `E${String(ep.index).padStart(2, '0')}` : '';
            return (s + e) || ep.title;
          })
          .join(' · ');
      } else {
        episodeStr = show.seasons.join(', ');
      }
      const imdbUrl = imdbUrls.get(key);
      const titleMd = imdbUrl ? `[${show.title}](${imdbUrl})` : show.title;
      entries.push({
        line: `📺 **${titleMd}** — ${episodeStr}`,
        thumbUrl: show.thumb ? `${baseUrl}${show.thumb}?X-Plex-Token=${token}` : null,
        addedAt: show.addedAt
      });
    }

    for (const movie of movies) {
      const imdbUrl = imdbUrls.get(movie.ratingKey);
      const titleMd = imdbUrl ? `[${movie.title}](${imdbUrl})` : movie.title;
      const yearStr = movie.year ? ` (${movie.year})` : '';
      entries.push({
        line: `🎬 **${titleMd}**${yearStr}`,
        thumbUrl: movie.thumb ? `${baseUrl}${movie.thumb}?X-Plex-Token=${token}` : null,
        addedAt: movie.addedAt || 0
      });
    }

    if (entries.length === 0) return;

    // Sort newest first, then download posters only for the 10 most recent entries
    entries.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));

    // Download poster images in parallel from Plex (failures silently skipped)
    await Promise.all(entries.slice(0, 10).map(async (entry, i) => {
      if (!entry.thumbUrl) return;
      try {
        const resp = await axios.get(entry.thumbUrl, {
          responseType: 'arraybuffer',
          timeout: 10000
        });
        entry.buffer = Buffer.from(resp.data);
        entry.filename = `poster_${i}.jpg`;
      } catch {
        // Poster unavailable — grid will just have fewer images
      }
    }));

    // Build description from all entry lines
    const description = entries.map(e => e.line).join('\n');

    // Collect poster attachments for all entries that successfully downloaded
    const attachments = entries
      .filter(e => e.buffer)
      .map(e => new AttachmentBuilder(e.buffer, { name: e.filename }));

    const embed = new EmbedBuilder()
      .setTitle('🆕 New on Plex')
      .setDescription(description)
      .setColor('#e5a00d')
      .setFooter({ text: footerText })
      .setTimestamp();

    // Send text embed + up to 10 poster images (Discord auto-grids multiple images)
    await channel.send({
      embeds: [embed],
      files: attachments
    });
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

    const toSend = recentItems.slice(0, 25);
    await this.sendGroupedItems(channel, toSend, integration, true);

    const extra = recentItems.length > 25 ? ` (showing 25 of ${recentItems.length} items)` : '';
    return { sent: toSend.length, message: `Sent ${toSend.length} item(s) as a grid to #${channel.name}${extra}` };
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
