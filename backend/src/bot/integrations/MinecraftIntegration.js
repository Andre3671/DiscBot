import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

// Uses the mcsrvstat.us public API — no API key required, but the server
// must be reachable from the internet (or use a public hostname).
class MinecraftIntegration {
  async execute(command, messageOrInteraction, args, isSlash, botConfig) {
    const integration = this.getIntegrationConfig(botConfig, 'minecraft');
    if (!integration) {
      return this.reply(messageOrInteraction, 'Minecraft integration not configured for this bot.', isSlash);
    }

    const action = command.integrationAction;
    try {
      switch (action) {
        case 'status':
          await this.getStatus(messageOrInteraction, isSlash, integration);
          break;
        case 'players':
          await this.getPlayers(messageOrInteraction, isSlash, integration);
          break;
        default:
          return this.reply(messageOrInteraction, `Unknown Minecraft action: ${action}`, isSlash);
      }
    } catch (error) {
      console.error('[MinecraftIntegration] Error:', error);
      return this.reply(messageOrInteraction, 'An error occurred while querying the Minecraft server.', isSlash);
    }
  }

  async getStatus(messageOrInteraction, isSlash, integration) {
    const { serverAddress, serverName } = integration.config || {};
    if (!serverAddress) throw new Error('No server address configured');

    const data = await this.queryServer(serverAddress);
    const displayName = serverName || serverAddress;

    if (!data.online) {
      const embed = new EmbedBuilder()
        .setTitle(`🔴 ${displayName}`)
        .setDescription('Server is currently offline.')
        .setColor('#ed4245')
        .setTimestamp();
      return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
    }

    const motd        = data.motd?.clean?.[0]?.trim() || '';
    const version     = data.version || data.protocol?.name || 'Unknown';
    const software    = data.software || '';
    const playersOnline = data.players?.online ?? 0;
    const playersMax    = data.players?.max ?? 0;

    const embed = new EmbedBuilder()
      .setTitle(`🟢 ${displayName}`)
      .setColor('#57f287')
      .addFields(
        { name: '👥 Players', value: `${playersOnline} / ${playersMax}`, inline: true },
        { name: '🎮 Version', value: software ? `${software} ${version}` : version, inline: true }
      )
      .setTimestamp();

    if (motd) embed.setDescription(`*${motd}*`);

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async getPlayers(messageOrInteraction, isSlash, integration) {
    const { serverAddress, serverName } = integration.config || {};
    if (!serverAddress) throw new Error('No server address configured');

    const data = await this.queryServer(serverAddress);
    const displayName = serverName || serverAddress;

    if (!data.online) {
      return this.reply(messageOrInteraction, `🔴 **${displayName}** is offline.`, isSlash);
    }

    const playersOnline = data.players?.online ?? 0;
    const playersMax    = data.players?.max ?? 0;
    const playerList    = data.players?.list || [];

    if (playersOnline === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`👥 ${displayName} — Players`)
        .setDescription('No players are currently online.')
        .setColor('#57f287')
        .setFooter({ text: `0 / ${playersMax} players` })
        .setTimestamp();
      return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
    }

    const embed = new EmbedBuilder()
      .setTitle(`👥 ${displayName} — Online Players`)
      .setColor('#57f287')
      .setFooter({ text: `${playersOnline} / ${playersMax} players` })
      .setTimestamp();

    if (playerList.length > 0) {
      embed.setDescription(playerList.map(p => `• ${p.name}`).join('\n'));
    } else {
      embed.setDescription(`${playersOnline} player(s) online.\n*(Server did not share player names)*`);
    }

    return this.reply(messageOrInteraction, { embeds: [embed] }, isSlash);
  }

  async queryServer(serverAddress) {
    const response = await axios.get(`https://api.mcsrvstat.us/3/${serverAddress}`, {
      timeout: 10000
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

export default new MinecraftIntegration();
