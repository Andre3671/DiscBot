import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class SonarrIntegration {
  /**
   * Execute Sonarr integration command
   */
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'sonarr');

    if (!integration) {
      return this.reply(messageOrInteraction, 'Sonarr integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;

    try {
      switch (action) {
        case 'search':
          await this.searchSeries(messageOrInteraction, args, isSlash, integration);
          break;

        case 'calendar':
          await this.getCalendar(messageOrInteraction, isSlash, integration);
          break;

        case 'add':
          await this.addSeries(messageOrInteraction, args, isSlash, integration);
          break;

        default:
          return this.reply(messageOrInteraction, `Unknown Sonarr action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[SonarrIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Sonarr.', isSlash);
    }
  }

  /**
   * Search for series
   */
  async searchSeries(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash
      ? messageOrInteraction.options.getString('query')
      : args.join(' ');

    if (!query) {
      return this.reply(messageOrInteraction, 'Please provide a series name to search.', isSlash);
    }

    const results = await this.sonarrRequest(integration, '/series/lookup', { term: query });

    if (!results || results.length === 0) {
      return this.reply(messageOrInteraction, `No series found for "${query}".`, isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Sonarr Search Results: ${query}`)
      .setDescription(results.slice(0, 5).map((series, index) =>
        `${index + 1}. ${series.title} (${series.year || 'N/A'})`
      ).join('\n'))
      .setColor('#3498db')
      .setFooter({ text: 'Powered by Sonarr' });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Get upcoming episodes calendar
   */
  async getCalendar(messageOrInteraction, isSlash, integration) {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const episodes = await this.sonarrRequest(integration, '/calendar', {
      start: today,
      end: nextWeek
    });

    if (!episodes || episodes.length === 0) {
      return this.reply(messageOrInteraction, 'No upcoming episodes in the next 7 days.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('Upcoming Episodes (Next 7 Days)')
      .setDescription(episodes.slice(0, 10).map((ep, index) => {
        const airDate = new Date(ep.airDate).toLocaleDateString();
        return `${index + 1}. ${ep.series.title} - S${ep.seasonNumber}E${ep.episodeNumber} (${airDate})`;
      }).join('\n'))
      .setColor('#3498db')
      .setFooter({ text: `${episodes.length} episode(s) airing` });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Add series to Sonarr
   */
  async addSeries(messageOrInteraction, args, isSlash, integration) {
    return this.reply(messageOrInteraction, 'Adding series is not yet implemented. Use the Sonarr web interface.', isSlash);
  }

  /**
   * Make request to Sonarr API
   */
  async sonarrRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};

    if (!apiUrl || !apiKey) {
      throw new Error('Sonarr API URL and API key are required');
    }

    try {
      // Normalize URL to prevent double slashes
      const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const fullUrl = `${baseUrl}/api/v3${normalizedEndpoint}`;

      const response = await axios.get(fullUrl, {
        headers: {
          'X-Api-Key': apiKey
        },
        params
      });

      return response.data;
    } catch (error) {
      console.error('[SonarrIntegration] API Error:', error.message);
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

export default new SonarrIntegration();
