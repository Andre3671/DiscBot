import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class PlexIntegration {
  /**
   * Execute Plex integration command
   */
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'plex');

    if (!integration) {
      return this.reply(messageOrInteraction, 'Plex integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;

    try {
      switch (action) {
        case 'search':
          await this.searchLibrary(messageOrInteraction, args, isSlash, integration);
          break;

        case 'nowPlaying':
          await this.getNowPlaying(messageOrInteraction, isSlash, integration);
          break;

        case 'stats':
          await this.getServerStats(messageOrInteraction, isSlash, integration);
          break;

        case 'recentlyAdded':
          await this.getRecentlyAdded(messageOrInteraction, isSlash, integration);
          break;

        case 'onDeck':
          await this.getOnDeck(messageOrInteraction, isSlash, integration);
          break;

        default:
          return this.reply(messageOrInteraction, `Unknown Plex action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[PlexIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Plex.', isSlash);
    }
  }

  /**
   * Search Plex library
   */
  async searchLibrary(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash
      ? messageOrInteraction.options.getString('query')
      : args.join(' ');

    if (!query) {
      return this.reply(messageOrInteraction, 'Please provide a search query.', isSlash);
    }

    const results = await this.plexRequest(integration, '/search', { query });

    if (!results || results.length === 0) {
      return this.reply(messageOrInteraction, `No results found for "${query}".`, isSlash);
    }

    const baseUrl = (integration.config.apiUrl || '').replace(/\/$/, '');
    const token = integration.config.apiKey;

    const embeds = results.slice(0, 5).map(item => {
      const title = item.grandparentTitle
        ? `${item.grandparentTitle} — ${item.title}`
        : item.title;
      const typeLabel = { movie: '🎬 Movie', show: '📺 Show', episode: '📺 Episode', artist: '🎵 Artist', album: '🎵 Album' }[item.type] || item.type;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#e5a00d')
        .addFields({ name: 'Type', value: typeLabel, inline: true });

      if (item.year) embed.addFields({ name: 'Year', value: String(item.year), inline: true });
      if (item.rating) embed.addFields({ name: 'Rating', value: `⭐ ${item.rating}`, inline: true });
      if (item.summary) embed.setDescription(item.summary.slice(0, 200) + (item.summary.length > 200 ? '…' : ''));
      if (item.thumb) embed.setThumbnail(`${baseUrl}${item.thumb}?X-Plex-Token=${token}`);

      return embed;
    });

    return this.reply(messageOrInteraction, { embeds }, isSlash);
  }

  /**
   * Get now playing — rich embeds per active stream
   */
  async getNowPlaying(messageOrInteraction, isSlash, integration) {
    const sessions = await this.plexRequest(integration, '/status/sessions');

    if (!sessions || sessions.length === 0) {
      return this.reply(messageOrInteraction, 'Nothing is currently playing on Plex.', isSlash);
    }

    const baseUrl = (integration.config.apiUrl || '').replace(/\/$/, '');
    const token = integration.config.apiKey;

    const embeds = sessions.slice(0, 10).map(session => {
      const title = session.grandparentTitle
        ? `${session.grandparentTitle} — ${session.title}`
        : session.title;
      const user = session.User?.title || 'Unknown';
      const player = session.Player?.title || 'Unknown device';
      const state = session.Player?.state || 'playing';
      const stateIcon = state === 'paused' ? '⏸' : '▶';
      const resolution = session.Media?.[0]?.videoResolution
        ? `${session.Media[0].videoResolution}p`
        : null;

      const embed = new EmbedBuilder()
        .setTitle(`${stateIcon} ${title}`)
        .setColor(state === 'paused' ? '#747f8d' : '#e5a00d')
        .addFields(
          { name: '👤 User', value: user, inline: true },
          { name: '📱 Player', value: player, inline: true }
        );

      if (resolution) embed.addFields({ name: '🎥 Quality', value: resolution, inline: true });

      if (session.viewOffset && session.duration) {
        embed.addFields({ name: '⏱ Progress', value: this.buildProgressBar(session.viewOffset, session.duration) });
      }

      if (session.thumb) {
        embed.setThumbnail(`${baseUrl}${session.thumb}?X-Plex-Token=${token}`);
      }

      return embed;
    });

    const header = sessions.length === 1 ? '1 active stream' : `${sessions.length} active streams`;
    return this.reply(messageOrInteraction, { content: `🎬 **Now Playing on Plex** — ${header}`, embeds }, isSlash);
  }

  /**
   * Get server stats with per-library counts
   */
  async getServerStats(messageOrInteraction, isSlash, integration) {
    const sections = await this.plexRequest(integration, '/library/sections');
    const serverName = integration.config?.serverName || 'Plex Server';

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${serverName} — Library Stats`)
      .setColor('#e5a00d')
      .setFooter({ text: 'Powered by Plex' })
      .setTimestamp();

    if (!sections || sections.length === 0) {
      embed.setDescription('No libraries found.');
      return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
    }

    // Fetch item count per library (uses Container-Size: 0 trick — no items downloaded)
    const libraryCounts = await Promise.all(
      sections.map(async section => {
        try {
          const count = await this.plexRequestCount(integration, `/library/sections/${section.key}/all`);
          const typeIcon = { movie: '🎬', show: '📺', artist: '🎵' }[section.type] || '📁';
          return { name: `${typeIcon} ${section.title}`, value: `${count} item${count !== 1 ? 's' : ''}`, inline: true };
        } catch {
          return { name: section.title, value: 'N/A', inline: true };
        }
      })
    );

    embed.addFields(...libraryCounts);
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Get recently added items as grouped embeds
   */
  async getRecentlyAdded(messageOrInteraction, isSlash, integration) {
    const items = await this.plexRequest(integration, '/library/recentlyAdded');

    if (!items || items.length === 0) {
      return this.reply(messageOrInteraction, 'No recently added items found.', isSlash);
    }

    const baseUrl = (integration.config.apiUrl || '').replace(/\/$/, '');
    const token = integration.config.apiKey;
    const serverName = integration.config?.serverName || 'Plex Server';

    const embeds = items.slice(0, 10).map(item => {
      const title = item.grandparentTitle
        ? `${item.grandparentTitle} — ${item.title}`
        : item.title;
      const typeLabel = { movie: '🎬 Movie', show: '📺 Show', episode: '📺 Episode' }[item.type] || item.type;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#e5a00d')
        .setFooter({ text: serverName });

      const fields = [{ name: 'Type', value: typeLabel, inline: true }];
      if (item.year) fields.push({ name: 'Year', value: String(item.year), inline: true });
      embed.addFields(...fields);

      if (item.thumb) embed.setThumbnail(`${baseUrl}${item.thumb}?X-Plex-Token=${token}`);

      return embed;
    });

    const extra = items.length > 10 ? ` *(showing 10 of ${items.length})*` : '';
    return this.reply(messageOrInteraction, {
      content: `🆕 **Recently Added on Plex**${extra}`,
      embeds
    }, isSlash);
  }

  /**
   * Get on deck (in progress) items
   */
  async getOnDeck(messageOrInteraction, isSlash, integration) {
    const items = await this.plexRequest(integration, '/library/onDeck');

    if (!items || items.length === 0) {
      return this.reply(messageOrInteraction, 'Nothing is on deck right now.', isSlash);
    }

    const baseUrl = (integration.config.apiUrl || '').replace(/\/$/, '');
    const token = integration.config.apiKey;
    const serverName = integration.config?.serverName || 'Plex Server';

    const embeds = items.slice(0, 10).map(item => {
      const title = item.grandparentTitle
        ? `${item.grandparentTitle} — ${item.title}`
        : item.title;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor('#5865f2')
        .setFooter({ text: serverName });

      if (item.viewOffset && item.duration) {
        embed.addFields({ name: '⏱ Progress', value: this.buildProgressBar(item.viewOffset, item.duration) });
      }

      if (item.thumb) embed.setThumbnail(`${baseUrl}${item.thumb}?X-Plex-Token=${token}`);

      return embed;
    });

    return this.reply(messageOrInteraction, {
      content: `▶ **On Deck — ${serverName}**`,
      embeds
    }, isSlash);
  }

  /**
   * Build a Unicode progress bar
   */
  buildProgressBar(viewOffset, duration) {
    const pct = Math.min(viewOffset / duration, 1);
    const filled = Math.round(pct * 15);
    const bar = '█'.repeat(filled) + '░'.repeat(15 - filled);
    const elapsed = this.formatDuration(viewOffset);
    const total = this.formatDuration(duration);
    return `${bar} ${elapsed} / ${total}`;
  }

  formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Make request to Plex API — returns Metadata or Directory items
   */
  async plexRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};

    if (!apiUrl || !apiKey) {
      throw new Error('Plex API URL and API key are required');
    }

    try {
      const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const fullUrl = `${baseUrl}${normalizedEndpoint}`;

      const response = await axios.get(fullUrl, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json'
        },
        params
      });

      return response.data?.MediaContainer?.Metadata || response.data?.MediaContainer?.Directory || [];
    } catch (error) {
      console.error('[PlexIntegration] API Error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch only the total item count for a library section (no items downloaded)
   */
  async plexRequestCount(integration, endpoint) {
    const { apiUrl, apiKey } = integration.config || {};
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      headers: { 'X-Plex-Token': apiKey, 'Accept': 'application/json' },
      params: { 'X-Plex-Container-Start': 0, 'X-Plex-Container-Size': 0 }
    });
    return response.data?.MediaContainer?.totalSize ?? response.data?.MediaContainer?.size ?? 0;
  }

  /**
   * Get integration config from bot config
   */
  getIntegrationConfig(botConfig, serviceName) {
    return botConfig.integrations?.find(int => int.service === serviceName);
  }

  /**
   * Reply helper
   */
  async reply(messageOrInteraction, content, isSlash) {
    if (isSlash) {
      return messageOrInteraction.reply(content);
    } else {
      return messageOrInteraction.reply(content);
    }
  }
}

export default new PlexIntegration();
