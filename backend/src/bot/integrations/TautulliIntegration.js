import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class TautulliIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'tautulli');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Tautulli integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'activity':
          await this.getActivity(messageOrInteraction, isSlash, integration);
          break;
        case 'history':
          await this.getHistory(messageOrInteraction, isSlash, integration);
          break;
        case 'stats':
          await this.getStats(messageOrInteraction, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Tautulli action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[TautulliIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Tautulli.', isSlash);
    }
  }

  async getActivity(messageOrInteraction, isSlash, integration) {
    const data = await this.tautulliRequest(integration, 'get_activity');
    const sessions = data?.sessions || [];

    if (!sessions.length) {
      return this.reply(messageOrInteraction, 'Nothing is currently playing on Plex.', isSlash);
    }

    const embeds = sessions.slice(0, 10).map(session => {
      const paused = session.state === 'paused';
      const stateIcon = paused ? '⏸' : session.state === 'buffering' ? '⏳' : '▶';

      const embed = new EmbedBuilder()
        .setTitle(`${stateIcon} ${session.full_title || session.title}`)
        .setColor(paused ? '#747f8d' : '#e5a00d')
        .addFields(
          { name: '👤 User',   value: session.friendly_name || session.user || 'Unknown', inline: true },
          { name: '📱 Player', value: session.player || 'Unknown', inline: true },
          { name: '📡 Stream', value: session.transcode_decision === 'direct play' ? 'Direct Play' : `Transcode (${session.video_resolution || '?'})`, inline: true }
        );

      const pct = parseInt(session.progress_percent) || 0;
      if (pct > 0) {
        const filled = Math.round(pct / 100 * 15);
        const bar = '█'.repeat(filled) + '░'.repeat(15 - filled);
        embed.addFields({ name: '⏱ Progress', value: `${bar} ${pct}%` });
      }

      if (session.thumb) {
        const { apiUrl, apiKey } = integration.config;
        const baseUrl = apiUrl.replace(/\/$/, '');
        embed.setThumbnail(`${baseUrl}/api/v2?apikey=${apiKey}&cmd=pms_image_proxy&img=${encodeURIComponent(session.thumb)}`);
      }

      return embed;
    });

    const streamCount = data.stream_count || sessions.length;
    const header = streamCount === 1 ? '1 active stream' : `${streamCount} active streams`;
    return this.reply(messageOrInteraction, {
      content: `📊 **Tautulli — Now Playing** — ${header}`,
      embeds
    }, isSlash);
  }

  async getHistory(messageOrInteraction, isSlash, integration) {
    const data = await this.tautulliRequest(integration, 'get_history', { length: 10, order_column: 'date', order_dir: 'desc' });
    const records = data?.data || [];

    if (!records.length) {
      return this.reply(messageOrInteraction, 'No watch history found.', isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Recent Watch History')
      .setColor('#e5a00d')
      .setTimestamp();

    embed.addFields(records.slice(0, 10).map(record => {
      const date   = record.date ? new Date(record.date * 1000).toLocaleDateString() : 'Unknown';
      const pct    = record.percent_complete ? `${Math.round(record.percent_complete)}%` : '?%';
      const user   = record.friendly_name || record.user || 'Unknown';
      return { name: record.full_title || record.title || 'Unknown', value: `${user} · ${pct} · ${date}`, inline: false };
    }));

    const total = data.recordsTotal ?? records.length;
    if (total > 10) embed.setFooter({ text: `Showing 10 of ${total} entries` });

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async getStats(messageOrInteraction, isSlash, integration) {
    const [librariesData, usersData] = await Promise.all([
      this.tautulliRequest(integration, 'get_libraries'),
      this.tautulliRequest(integration, 'get_users_table', { length: 5, order_column: 'last_seen', order_dir: 'desc' })
    ]);

    const libraries = Array.isArray(librariesData) ? librariesData : [];
    const users     = usersData?.data || [];

    const embed = new EmbedBuilder()
      .setTitle('📊 Tautulli — Stats')
      .setColor('#e5a00d')
      .setTimestamp();

    if (libraries.length) {
      const typeIcon = { movie: '🎬', show: '📺', artist: '🎵' };
      const libFields = libraries.slice(0, 6).map(lib => ({
        name: `${typeIcon[lib.section_type] || '📁'} ${lib.section_name}`,
        value: `${lib.count ?? '?'} items`,
        inline: true
      }));
      embed.addFields({ name: '📚 Libraries', value: '\u200b', inline: false }, ...libFields);
    }

    if (users.length) {
      const userFields = users.slice(0, 5).map(u => {
        const lastSeen = u.last_seen ? new Date(u.last_seen * 1000).toLocaleDateString() : 'Never';
        return { name: u.friendly_name || u.username || 'Unknown', value: `Last seen: ${lastSeen}`, inline: true };
      });
      embed.addFields({ name: '👥 Recent Users', value: '\u200b', inline: false }, ...userFields);
    }

    if (!libraries.length && !users.length) {
      embed.setDescription('No data available.');
    }

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async tautulliRequest(integration, cmd, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};
    if (!apiUrl || !apiKey) throw new Error('Tautulli API URL and API key are required');
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const response = await axios.get(`${baseUrl}/api/v2`, {
      params: { apikey: apiKey, cmd, ...params }
    });
    const body = response.data?.response;
    if (body?.result !== 'success') throw new Error(body?.message || 'Tautulli API error');
    return body.data;
  }

  getIntegrationConfig(botConfig, serviceName) {
    return botConfig.integrations?.find(int => int.service === serviceName);
  }

  async reply(messageOrInteraction, content, isSlash) {
    return messageOrInteraction.reply(content);
  }
}

export default new TautulliIntegration();
