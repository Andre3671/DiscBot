import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class ReadarrIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'readarr');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Readarr integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'search':
          await this.searchBook(messageOrInteraction, args, isSlash, integration);
          break;
        case 'calendar':
          await this.getCalendar(messageOrInteraction, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Readarr action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[ReadarrIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Readarr.', isSlash);
    }
  }

  async searchBook(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash ? messageOrInteraction.options.getString('query') : args.join(' ');
    if (!query) return this.reply(messageOrInteraction, 'Please provide a search query.', isSlash);

    const results = await this.readarrRequest(integration, '/book/lookup', { term: query });
    if (!results || results.length === 0) {
      return this.reply(messageOrInteraction, `No books found for "${query}".`, isSlash);
    }

    const embeds = results.slice(0, 5).map(book => {
      const embed = new EmbedBuilder()
        .setTitle(`📚 ${book.title}`)
        .setColor('#8b4513');

      const authorName = book.author?.authorName || book.authorTitle;
      if (authorName) embed.addFields({ name: 'Author', value: authorName, inline: true });
      if (book.releaseDate) embed.addFields({ name: 'Released', value: new Date(book.releaseDate).getFullYear().toString(), inline: true });
      if (book.ratings?.value) embed.addFields({ name: 'Rating', value: `⭐ ${book.ratings.value.toFixed(1)}`, inline: true });
      if (book.overview) embed.setDescription(book.overview.slice(0, 200) + (book.overview.length > 200 ? '…' : ''));
      if (book.remoteCover) embed.setThumbnail(book.remoteCover);

      return embed;
    });

    return this.reply(messageOrInteraction, { embeds }, isSlash);
  }

  async getCalendar(messageOrInteraction, isSlash, integration) {
    const start = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const books = await this.readarrRequest(integration, '/calendar', { start, end, includeAuthor: true });
    if (!books || books.length === 0) {
      return this.reply(messageOrInteraction, 'No upcoming book releases in the next 30 days.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('📚 Upcoming Book Releases')
      .setColor('#8b4513')
      .setTimestamp();

    const fields = books.slice(0, 10).map(book => {
      const author = book.author?.authorName || 'Unknown Author';
      const date = book.releaseDate ? new Date(book.releaseDate).toLocaleDateString() : 'TBA';
      return { name: book.title, value: `by ${author} · ${date}`, inline: false };
    });

    embed.addFields(...fields);
    if (books.length > 10) embed.setFooter({ text: `Showing 10 of ${books.length} upcoming releases` });
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async readarrRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};
    if (!apiUrl || !apiKey) throw new Error('Readarr API URL and API key are required');
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

export default new ReadarrIntegration();
