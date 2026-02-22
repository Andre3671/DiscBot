import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class ProwlarrIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'prowlarr');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Prowlarr integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'indexers':
          await this.getIndexers(messageOrInteraction, isSlash, integration);
          break;
        case 'stats':
          await this.getStats(messageOrInteraction, isSlash, integration);
          break;
        case 'search':
          await this.searchIndexers(messageOrInteraction, args, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Prowlarr action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[ProwlarrIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Prowlarr.', isSlash);
    }
  }

  async getIndexers(messageOrInteraction, isSlash, integration) {
    const indexers = await this.prowlarrRequest(integration, '/indexer');
    if (!indexers || !indexers.length) {
      return this.reply(messageOrInteraction, 'No indexers configured in Prowlarr.', isSlash);
    }

    const enabled  = indexers.filter(i => i.enable);
    const disabled = indexers.filter(i => !i.enable);

    const embed = new EmbedBuilder()
      .setTitle('🔍 Prowlarr Indexers')
      .setColor('#f97316')
      .setTimestamp();

    if (enabled.length) {
      embed.addFields({
        name: `✅ Enabled (${enabled.length})`,
        value: enabled.slice(0, 20).map(i => {
          const proto = i.protocol === 'usenet' ? '📰' : '🧲';
          return `${proto} ${i.name}`;
        }).join('\n'),
        inline: false
      });
    }

    if (disabled.length) {
      embed.addFields({
        name: `❌ Disabled (${disabled.length})`,
        value: disabled.slice(0, 10).map(i => i.name).join(', '),
        inline: false
      });
    }

    embed.setFooter({ text: `${indexers.length} total indexers` });
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async getStats(messageOrInteraction, isSlash, integration) {
    const data = await this.prowlarrRequest(integration, '/indexerstats');
    const stats = data?.indexers || [];

    if (!stats.length) {
      return this.reply(messageOrInteraction, 'No indexer statistics available.', isSlash);
    }

    // Sort by number of successful queries descending
    stats.sort((a, b) => (b.numberOfSuccessfulQueries || 0) - (a.numberOfSuccessfulQueries || 0));

    const embed = new EmbedBuilder()
      .setTitle('📊 Prowlarr Indexer Stats')
      .setColor('#f97316')
      .setTimestamp();

    const fields = stats.slice(0, 10).map(s => {
      const total   = (s.numberOfSuccessfulQueries || 0) + (s.numberOfFailedQueries || 0);
      const pct     = total > 0 ? Math.round((s.numberOfSuccessfulQueries / total) * 100) : 0;
      const avgMs   = s.averageResponseTime ? `${Math.round(s.averageResponseTime)}ms` : '?';
      const grabs   = s.numberOfSuccessfulGrabs || 0;
      return {
        name: s.indexerName,
        value: `✅ ${pct}% success · ⏱ ${avgMs} avg · ⬇️ ${grabs} grabs`,
        inline: false
      };
    });

    embed.addFields(...fields);
    if (stats.length > 10) embed.setFooter({ text: `Showing top 10 of ${stats.length} indexers` });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async searchIndexers(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash ? messageOrInteraction.options.getString('query') : args.join(' ');
    if (!query) return this.reply(messageOrInteraction, 'Please provide a search query.', isSlash);

    // indexerIds=-2 means all indexers
    const results = await this.prowlarrRequest(integration, '/search', {
      query,
      indexerIds: -2,
      type: 'search',
      limit: 10
    });

    if (!results || !results.length) {
      return this.reply(messageOrInteraction, `No results found for "${query}".`, isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search: ${query}`)
      .setColor('#f97316')
      .setTimestamp();

    embed.addFields(results.slice(0, 10).map(result => {
      const size    = result.size ? this.formatSize(result.size) : '?';
      const seeders = result.seeders != null ? `🌱 ${result.seeders}` : '';
      const indexer = result.indexer || 'Unknown';
      return {
        name: result.title.slice(0, 100),
        value: `${indexer} · ${size}${seeders ? ' · ' + seeders : ''}`,
        inline: false
      };
    }));

    if (results.length > 10) embed.setFooter({ text: `Showing 10 of ${results.length} results` });
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  formatSize(bytes) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  }

  async prowlarrRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};
    if (!apiUrl || !apiKey) throw new Error('Prowlarr API URL and API key are required');
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

export default new ProwlarrIntegration();
