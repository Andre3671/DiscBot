import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

class JellyfinIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'jellyfin');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Jellyfin integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'nowPlaying':
          await this.getNowPlaying(messageOrInteraction, isSlash, integration);
          break;
        case 'recentlyAdded':
          await this.getRecentlyAdded(messageOrInteraction, isSlash, integration);
          break;
        case 'search':
          await this.searchLibrary(messageOrInteraction, args, isSlash, integration);
          break;
        case 'stats':
          await this.getStats(messageOrInteraction, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Jellyfin action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[JellyfinIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while connecting to Jellyfin.', isSlash);
    }
  }

  async getNowPlaying(messageOrInteraction, isSlash, integration) {
    // Only sessions that have been active within the last 16 minutes
    const sessions = await this.jellyfinRequest(integration, '/Sessions', { ActiveWithinSeconds: 960 });
    const playing = (sessions || []).filter(s => s.NowPlayingItem);

    if (!playing.length) {
      return this.reply(messageOrInteraction, 'Nothing is currently playing on Jellyfin.', isSlash);
    }

    const { apiUrl, apiKey } = integration.config;
    const baseUrl = apiUrl.replace(/\/$/, '');

    const embeds = playing.slice(0, 10).map(session => {
      const item   = session.NowPlayingItem;
      const title  = item.SeriesName ? `${item.SeriesName} — ${item.Name}` : item.Name;
      const paused = session.PlayState?.IsPaused;

      const embed = new EmbedBuilder()
        .setTitle(`${paused ? '⏸' : '▶'} ${title}`)
        .setColor(paused ? '#747f8d' : '#00a4dc')
        .addFields(
          { name: '👤 User',   value: session.UserName || 'Unknown', inline: true },
          { name: '📱 Client', value: `${session.Client || 'Unknown'} · ${session.DeviceName || ''}`, inline: true }
        );

      if (session.PlayState?.PositionTicks && item.RunTimeTicks) {
        embed.addFields({
          name: '⏱ Progress',
          value: this.buildProgressBar(session.PlayState.PositionTicks, item.RunTimeTicks)
        });
      }

      // Poster: prefer item's own Primary, fall back to parent
      const imageId  = item.ImageTags?.Primary ? item.Id : (item.ParentId || item.Id);
      const imageTag = item.ImageTags?.Primary || item.ParentThumbImageTag;
      if (imageTag) {
        embed.setThumbnail(`${baseUrl}/Items/${imageId}/Images/Primary?tag=${imageTag}&api_key=${apiKey}`);
      }

      return embed;
    });

    const header = playing.length === 1 ? '1 active stream' : `${playing.length} active streams`;
    return this.reply(messageOrInteraction, {
      content: `🎬 **Now Playing on Jellyfin** — ${header}`,
      embeds
    }, isSlash);
  }

  async getRecentlyAdded(messageOrInteraction, isSlash, integration) {
    const data = await this.jellyfinRequest(integration, '/Items', {
      SortBy: 'DateCreated',
      SortOrder: 'Descending',
      Recursive: true,
      Limit: 10,
      IncludeItemTypes: 'Movie,Episode,Series',
      Fields: 'Overview,ImageTags'
    });

    const items = data?.Items || [];
    if (!items.length) {
      return this.reply(messageOrInteraction, 'No recently added items found.', isSlash);
    }

    const { apiUrl, apiKey } = integration.config;
    const baseUrl = apiUrl.replace(/\/$/, '');
    const serverName = integration.config.serverName || 'Jellyfin';
    const typeIcon = { Movie: '🎬', Episode: '📺', Series: '📺' };

    const embeds = items.map(item => {
      const title = item.SeriesName ? `${item.SeriesName} — ${item.Name}` : item.Name;
      const embed = new EmbedBuilder()
        .setTitle(`${typeIcon[item.Type] || '📁'} ${title}`)
        .setColor('#00a4dc')
        .setFooter({ text: serverName });

      if (item.ProductionYear) embed.addFields({ name: 'Year',   value: String(item.ProductionYear), inline: true });
      if (item.CommunityRating) embed.addFields({ name: 'Rating', value: `⭐ ${item.CommunityRating.toFixed(1)}`, inline: true });
      if (item.Overview) embed.setDescription(item.Overview.slice(0, 200) + (item.Overview.length > 200 ? '…' : ''));
      if (item.ImageTags?.Primary) {
        embed.setThumbnail(`${baseUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&api_key=${apiKey}`);
      }

      return embed;
    });

    return this.reply(messageOrInteraction, {
      content: `🆕 **Recently Added on Jellyfin**`,
      embeds
    }, isSlash);
  }

  async searchLibrary(messageOrInteraction, args, isSlash, integration) {
    const query = isSlash ? messageOrInteraction.options.getString('query') : args.join(' ');
    if (!query) return this.reply(messageOrInteraction, 'Please provide a search query.', isSlash);

    const data = await this.jellyfinRequest(integration, '/Items', {
      SearchTerm: query,
      Recursive: true,
      Limit: 5,
      IncludeItemTypes: 'Movie,Series,Episode',
      Fields: 'Overview,ImageTags'
    });

    const items = data?.Items || [];
    if (!items.length) {
      return this.reply(messageOrInteraction, `No results found for "${query}".`, isSlash);
    }

    const { apiUrl, apiKey } = integration.config;
    const baseUrl = apiUrl.replace(/\/$/, '');
    const typeIcon = { Movie: '🎬', Episode: '📺', Series: '📺' };

    const embeds = items.map(item => {
      const title = item.SeriesName ? `${item.SeriesName} — ${item.Name}` : item.Name;
      const embed = new EmbedBuilder()
        .setTitle(`${typeIcon[item.Type] || '📁'} ${title}`)
        .setColor('#00a4dc');

      if (item.ProductionYear)  embed.addFields({ name: 'Year',   value: String(item.ProductionYear), inline: true });
      if (item.CommunityRating) embed.addFields({ name: 'Rating', value: `⭐ ${item.CommunityRating.toFixed(1)}`, inline: true });
      if (item.Overview) embed.setDescription(item.Overview.slice(0, 200) + (item.Overview.length > 200 ? '…' : ''));
      if (item.ImageTags?.Primary) {
        embed.setThumbnail(`${baseUrl}/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}&api_key=${apiKey}`);
      }

      return embed;
    });

    return this.reply(messageOrInteraction, { embeds }, isSlash);
  }

  async getStats(messageOrInteraction, isSlash, integration) {
    const serverName = integration.config.serverName || 'Jellyfin';
    const data = await this.jellyfinRequest(integration, '/Library/MediaFolders');
    const folders = data?.Items || [];

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${serverName} — Library Stats`)
      .setColor('#00a4dc')
      .setFooter({ text: 'Powered by Jellyfin' })
      .setTimestamp();

    if (!folders.length) {
      embed.setDescription('No libraries found.');
      return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
    }

    const countTypeIcon = { movies: '🎬', tvshows: '📺', music: '🎵', books: '📚', photos: '🖼' };

    const counts = await Promise.all(folders.map(async folder => {
      try {
        const result = await this.jellyfinRequest(integration, '/Items', {
          parentId: folder.Id,
          Recursive: true,
          Limit: 0
        });
        const icon  = countTypeIcon[folder.CollectionType] || '📁';
        const count = result.TotalRecordCount ?? 0;
        return { name: `${icon} ${folder.Name}`, value: `${count} item${count !== 1 ? 's' : ''}`, inline: true };
      } catch {
        return { name: folder.Name, value: 'N/A', inline: true };
      }
    }));

    embed.addFields(...counts);
    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  buildProgressBar(positionTicks, runtimeTicks) {
    const pct    = Math.min(positionTicks / runtimeTicks, 1);
    const filled = Math.round(pct * 15);
    const bar    = '█'.repeat(filled) + '░'.repeat(15 - filled);
    // Jellyfin ticks are in 100-nanosecond intervals; divide by 10000 to get ms
    const elapsed = this.formatDuration(positionTicks / 10000);
    const total   = this.formatDuration(runtimeTicks / 10000);
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

  async jellyfinRequest(integration, endpoint, params = {}) {
    const { apiUrl, apiKey } = integration.config || {};
    if (!apiUrl || !apiKey) throw new Error('Jellyfin API URL and API key are required');
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      headers: { 'X-Emby-Token': apiKey },
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

export default new JellyfinIntegration();
