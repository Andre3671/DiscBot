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

    const embed = new EmbedBuilder()
      .setTitle(`Plex Search Results: ${query}`)
      .setDescription(results.slice(0, 5).map((item, index) =>
        `${index + 1}. ${item.title} (${item.year || 'N/A'})`
      ).join('\n'))
      .setColor('#e5a00d')
      .setFooter({ text: 'Powered by Plex' });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Get now playing
   */
  async getNowPlaying(messageOrInteraction, isSlash, integration) {
    const sessions = await this.plexRequest(integration, '/status/sessions');

    if (!sessions || sessions.length === 0) {
      return this.reply(messageOrInteraction, 'No one is currently watching anything on Plex.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('Now Playing on Plex')
      .setDescription(sessions.map((session, index) =>
        `${index + 1}. ${session.title} - ${session.user}`
      ).join('\n'))
      .setColor('#e5a00d')
      .setFooter({ text: `${sessions.length} active stream(s)` });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Get server stats
   */
  async getServerStats(messageOrInteraction, isSlash, integration) {
    const stats = await this.plexRequest(integration, '/library/sections');

    const embed = new EmbedBuilder()
      .setTitle('Plex Server Stats')
      .addFields(
        { name: 'Server', value: integration.serverName || 'Plex Server', inline: true },
        { name: 'Libraries', value: stats?.length?.toString() || '0', inline: true },
        { name: 'Status', value: '✅ Online', inline: true }
      )
      .setColor('#e5a00d')
      .setFooter({ text: 'Powered by Plex' });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Make request to Plex API
   */
  async plexRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};

    if (!apiUrl || !apiKey) {
      throw new Error('Plex API URL and API key are required');
    }

    try {
      // Normalize URL to prevent double slashes
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
