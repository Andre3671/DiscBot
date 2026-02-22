import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class OverseerrIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'overseerr');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Overseerr integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'requests':
          await this.getRequests(messageOrInteraction, isSlash, integration, 'all');
          break;
        case 'pending':
          await this.getRequests(messageOrInteraction, isSlash, integration, 'pending');
          break;
        case 'search':
          await this.searchMedia(messageOrInteraction, args, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Overseerr action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[OverseerrIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Overseerr.', isSlash);
    }
  }

  async getRequests(messageOrInteraction, isSlash, integration, filter = 'all') {
    const data = await this.overseerrRequest(integration, '/request', { take: 10, filter, sort: 'added' });
    const results = data?.results || [];

    if (results.length === 0) {
      return this.reply(messageOrInteraction, filter === 'pending' ? 'No pending requests.' : 'No requests found.', isSlash);
    }

    const statusIcon  = { 1: '⏳', 2: '✅', 3: '❌', 4: '🟢', 5: '⬇️' };
    const statusLabel = { 1: 'Pending', 2: 'Approved', 3: 'Declined', 4: 'Available', 5: 'Processing' };
    const typeIcon    = { movie: '🎬', tv: '📺' };

    const embed = new EmbedBuilder()
      .setTitle(filter === 'pending' ? '⏳ Pending Requests' : '📋 Media Requests')
      .setColor('#f59e0b')
      .setTimestamp();

    embed.addFields(results.map(req => {
      const title     = req.media?.originalTitle || req.media?.title || 'Unknown';
      const icon      = statusIcon[req.status] || '❓';
      const status    = statusLabel[req.status] || 'Unknown';
      const type      = typeIcon[req.type] || '📁';
      const requester = req.requestedBy?.displayName || 'Unknown';
      return { name: `${type} ${title}`, value: `${icon} ${status} · by ${requester}`, inline: false };
    }));

    if (data.pageInfo?.results > 10) {
      embed.setFooter({ text: `Showing 10 of ${data.pageInfo.results} requests` });
    }
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async searchMedia(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash ? messageOrInteraction.options.getString('query') : args.join(' ');
    if (!query) return this.reply(messageOrInteraction, 'Please provide a search query.', isSlash);

    const data = await this.overseerrRequest(integration, '/search', { query });
    const results = (data?.results || []).filter(r => r.mediaType === 'movie' || r.mediaType === 'tv');

    if (results.length === 0) {
      return this.reply(messageOrInteraction, `No results found for "${query}".`, isSlash);
    }

    const mediaStatusLabel = { 2: '✅ Available', 3: '⬇️ Partial', 4: '⏳ Processing', 5: '📋 Requested' };

    const embeds = results.slice(0, 5).map(item => {
      const isMovie = item.mediaType === 'movie';
      const title   = isMovie ? item.title : item.name;
      const year    = (isMovie ? item.releaseDate : item.firstAirDate)?.slice(0, 4);
      const icon    = isMovie ? '🎬' : '📺';

      const embed = new EmbedBuilder()
        .setTitle(`${icon} ${title}`)
        .setColor('#f59e0b');

      if (year) embed.addFields({ name: 'Year', value: year, inline: true });
      if (item.voteAverage) embed.addFields({ name: 'Rating', value: `⭐ ${item.voteAverage.toFixed(1)}`, inline: true });

      const mediaStatus = item.mediaInfo?.status;
      if (mediaStatus && mediaStatusLabel[mediaStatus]) {
        embed.addFields({ name: 'Status', value: mediaStatusLabel[mediaStatus], inline: true });
      }
      if (item.overview) embed.setDescription(item.overview.slice(0, 200) + (item.overview.length > 200 ? '…' : ''));
      if (item.posterPath) embed.setThumbnail(`https://image.tmdb.org/t/p/w185${item.posterPath}`);

      return embed;
    });

    return this.reply(messageOrInteraction, { embeds }, isSlash);
  }

  async overseerrRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};
    if (!apiUrl || !apiKey) throw new Error('Overseerr API URL and API key are required');
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

export default new OverseerrIntegration();
