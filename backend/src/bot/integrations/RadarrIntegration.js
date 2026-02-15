import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class RadarrIntegration {
  /**
   * Execute Radarr integration command
   */
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'radarr');

    if (!integration) {
      return this.reply(messageOrInteraction, 'Radarr integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;

    try {
      switch (action) {
        case 'search':
          await this.searchMovies(messageOrInteraction, args, isSlash, integration);
          break;

        case 'calendar':
          await this.getCalendar(messageOrInteraction, isSlash, integration);
          break;

        case 'add':
          await this.addMovie(messageOrInteraction, args, isSlash, integration);
          break;

        default:
          return this.reply(messageOrInteraction, `Unknown Radarr action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[RadarrIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Radarr.', isSlash);
    }
  }

  /**
   * Search for movies
   */
  async searchMovies(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash
      ? messageOrInteraction.options.getString('query')
      : args.join(' ');

    if (!query) {
      return this.reply(messageOrInteraction, 'Please provide a movie name to search.', isSlash);
    }

    const results = await this.radarrRequest(integration, '/movie/lookup', { term: query });

    if (!results || results.length === 0) {
      return this.reply(messageOrInteraction, `No movies found for "${query}".`, isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Radarr Search Results: ${query}`)
      .setDescription(results.slice(0, 5).map((movie, index) =>
        `${index + 1}. ${movie.title} (${movie.year || 'N/A'})`
      ).join('\n'))
      .setColor('#ffc230')
      .setFooter({ text: 'Powered by Radarr' });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Get upcoming movies calendar
   */
  async getCalendar(messageOrInteraction, isSlash, integration) {
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const movies = await this.radarrRequest(integration, '/calendar', {
      start: today,
      end: nextMonth
    });

    if (!movies || movies.length === 0) {
      return this.reply(messageOrInteraction, 'No upcoming movies in the next 30 days.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('Upcoming Movies (Next 30 Days)')
      .setDescription(movies.slice(0, 10).map((movie, index) => {
        const releaseDate = movie.digitalRelease
          ? new Date(movie.digitalRelease).toLocaleDateString()
          : new Date(movie.inCinemas).toLocaleDateString();
        return `${index + 1}. ${movie.title} (${releaseDate})`;
      }).join('\n'))
      .setColor('#ffc230')
      .setFooter({ text: `${movies.length} movie(s) releasing` });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  /**
   * Add movie to Radarr
   */
  async addMovie(messageOrInteraction, args, isSlash, integration) {
    return this.reply(messageOrInteraction, 'Adding movies is not yet implemented. Use the Radarr web interface.', isSlash);
  }

  /**
   * Make request to Radarr API
   */
  async radarrRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};

    if (!apiUrl || !apiKey) {
      throw new Error('Radarr API URL and API key are required');
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
      console.error('[RadarrIntegration] API Error:', error.message);
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

export default new RadarrIntegration();
