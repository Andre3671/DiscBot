import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class LidarrIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'lidarr');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Lidarr integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'search':
          await this.searchArtist(messageOrInteraction, args, isSlash, integration);
          break;
        case 'calendar':
          await this.getCalendar(messageOrInteraction, isSlash, integration);
          break;
        case 'queue':
          await this.getQueue(messageOrInteraction, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Lidarr action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[LidarrIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Lidarr.', isSlash);
    }
  }

  async searchArtist(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash ? messageOrInteraction.options.getString('query') : args.join(' ');
    if (!query) return this.reply(messageOrInteraction, 'Please provide a search query.', isSlash);

    const results = await this.lidarrRequest(integration, '/artist/lookup', { term: query });
    if (!results || results.length === 0) {
      return this.reply(messageOrInteraction, `No artists found for "${query}".`, isSlash);
    }

    const embeds = results.slice(0, 5).map(artist => {
      const embed = new EmbedBuilder()
        .setTitle(`🎵 ${artist.artistName}`)
        .setColor('#1db954')
        .addFields({ name: 'Type', value: artist.artistType || 'Artist', inline: true });

      if (artist.disambiguation) embed.addFields({ name: 'Also known as', value: artist.disambiguation, inline: true });
      if (artist.genres?.length) embed.addFields({ name: 'Genres', value: artist.genres.slice(0, 5).join(', '), inline: true });
      if (artist.overview) embed.setDescription(artist.overview.slice(0, 200) + (artist.overview.length > 200 ? '…' : ''));
      if (artist.remotePoster) embed.setThumbnail(artist.remotePoster);

      return embed;
    });

    return this.reply(messageOrInteraction, { embeds }, isSlash);
  }

  async getCalendar(messageOrInteraction, isSlash, integration) {
    const start = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const releases = await this.lidarrRequest(integration, '/calendar', { start, end, includeArtist: true });
    if (!releases || releases.length === 0) {
      return this.reply(messageOrInteraction, 'No upcoming music releases in the next 30 days.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎵 Upcoming Music Releases')
      .setColor('#1db954')
      .setTimestamp();

    const fields = releases.slice(0, 10).map(release => {
      const artist = release.artist?.artistName || 'Unknown Artist';
      const date = release.releaseDate ? new Date(release.releaseDate).toLocaleDateString() : 'TBA';
      const type = release.albumType || 'Release';
      return { name: `${artist} — ${release.title}`, value: `${type} · ${date}`, inline: false };
    });

    embed.addFields(...fields);
    if (releases.length > 10) embed.setFooter({ text: `Showing 10 of ${releases.length} upcoming releases` });
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async getQueue(messageOrInteraction, isSlash, integration) {
    const data = await this.lidarrRequest(integration, '/queue');
    const records = data?.records || data || [];

    if (!records.length) {
      return this.reply(messageOrInteraction, '✅ Lidarr download queue is empty.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('⬇️ Lidarr Download Queue')
      .setColor('#1db954')
      .setTimestamp();

    const fields = records.slice(0, 10).map(item => {
      const pct = item.size > 0 ? Math.round(((item.size - (item.sizeleft || 0)) / item.size) * 100) : 0;
      return { name: item.title || 'Unknown', value: `${item.status || 'unknown'} · ${pct}%`, inline: true };
    });

    embed.addFields(...fields);
    if (records.length > 10) embed.setFooter({ text: `Showing 10 of ${records.length} items` });
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async lidarrRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};
    if (!apiUrl || !apiKey) throw new Error('Lidarr API URL and API key are required');
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const response = await axios.get(`${baseUrl}/api/v1${endpoint}`, {
      headers: { 'X-Api-Key': apiKey },
      params
    });
    return response.data;
  }

  getIntegrationConfig(botConfig, serviceName) {
    return botConfig.integrations?.find(int => int.service === serviceName);
  }

  async reply(messageOrInteraction, content, isSlash) {
    return messageOrInteraction.reply(content);
  }
}

export default new LidarrIntegration();
