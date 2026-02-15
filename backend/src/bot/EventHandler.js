import { EmbedBuilder } from 'discord.js';

class EventHandler {
  constructor(client, config, botManager) {
    this.client = client;
    this.config = config;
    this.botManager = botManager;
    this.activeListeners = new Map();

    this.loadEvents(config);
  }

  /**
   * Load events from config
   */
  loadEvents(config) {
    // Remove existing listeners
    this.removeAllListeners();

    if (!config.events || config.events.length === 0) {
      console.log(`[EventHandler] No events configured for bot ${config.id}`);
      return;
    }

    for (const event of config.events) {
      this.attachEventListener(event);
    }

    console.log(`[EventHandler] Loaded ${config.events.length} event(s) for bot ${config.id}`);
  }

  /**
   * Reload events (for hot-reload)
   */
  reloadEvents(config) {
    console.log(`[EventHandler] Reloading events for bot ${config.id}`);
    this.config = config;
    this.loadEvents(config);
  }

  /**
   * Attach event listener
   */
  attachEventListener(event) {
    const eventType = event.eventType;

    const listener = (...args) => {
      this.handleEvent(event, ...args);
    };

    this.client.on(eventType, listener);
    this.activeListeners.set(event.id, { eventType, listener });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    for (const [eventId, { eventType, listener }] of this.activeListeners) {
      this.client.removeListener(eventType, listener);
    }
    this.activeListeners.clear();
  }

  /**
   * Handle event trigger
   */
  async handleEvent(event, ...args) {
    console.log(`[EventHandler] Event triggered: ${event.eventType}`);

    try {
      switch (event.eventType) {
        case 'messageCreate':
          await this.handleMessageCreate(event, args[0]);
          break;

        case 'messageDelete':
          await this.handleMessageDelete(event, args[0]);
          break;

        case 'messageUpdate':
          await this.handleMessageUpdate(event, args[0], args[1]);
          break;

        case 'guildMemberAdd':
          await this.handleGuildMemberAdd(event, args[0]);
          break;

        case 'guildMemberRemove':
          await this.handleGuildMemberRemove(event, args[0]);
          break;

        case 'messageReactionAdd':
          await this.handleMessageReactionAdd(event, args[0], args[1]);
          break;

        case 'messageReactionRemove':
          await this.handleMessageReactionRemove(event, args[0], args[1]);
          break;

        default:
          console.warn(`[EventHandler] Unhandled event type: ${event.eventType}`);
      }

      // Emit event log
      this.botManager.emitEvent(this.config.id, event.eventType, {
        eventName: event.name
      });
    } catch (error) {
      console.error(`[EventHandler] Error handling event ${event.eventType}:`, error);
    }
  }

  /**
   * Handle messageCreate event
   */
  async handleMessageCreate(event, message) {
    if (message.author.bot) return;

    await this.executeEventAction(event, message.channel, {
      user: message.author,
      message: message.content
    });
  }

  /**
   * Handle messageDelete event
   */
  async handleMessageDelete(event, message) {
    const logChannel = event.config?.logChannelId;
    if (!logChannel) return;

    const channel = await this.client.channels.fetch(logChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Message Deleted')
      .setDescription(`Message by ${message.author?.tag || 'Unknown'} was deleted`)
      .addFields(
        { name: 'Content', value: message.content || 'No content' },
        { name: 'Channel', value: message.channel.name }
      )
      .setColor('#ff0000')
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Handle messageUpdate event
   */
  async handleMessageUpdate(event, oldMessage, newMessage) {
    if (newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const logChannel = event.config?.logChannelId;
    if (!logChannel) return;

    const channel = await this.client.channels.fetch(logChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Message Edited')
      .setDescription(`Message by ${newMessage.author.tag} was edited`)
      .addFields(
        { name: 'Before', value: oldMessage.content || 'No content' },
        { name: 'After', value: newMessage.content || 'No content' },
        { name: 'Channel', value: newMessage.channel.name }
      )
      .setColor('#ffaa00')
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Handle guildMemberAdd event
   */
  async handleGuildMemberAdd(event, member) {
    const welcomeChannel = event.config?.welcomeChannelId;
    if (!welcomeChannel) return;

    const channel = await this.client.channels.fetch(welcomeChannel);
    if (!channel) return;

    await this.executeEventAction(event, channel, {
      user: member.user,
      memberCount: member.guild.memberCount
    });
  }

  /**
   * Handle guildMemberRemove event
   */
  async handleGuildMemberRemove(event, member) {
    const logChannel = event.config?.logChannelId;
    if (!logChannel) return;

    const channel = await this.client.channels.fetch(logChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('Member Left')
      .setDescription(`${member.user.tag} left the server`)
      .setColor('#ff0000')
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  /**
   * Handle messageReactionAdd event
   */
  async handleMessageReactionAdd(event, reaction, user) {
    if (user.bot) return;

    // Handle role reactions or other custom logic
    if (event.config?.roleReactions) {
      await this.handleRoleReaction(event, reaction, user, 'add');
    }
  }

  /**
   * Handle messageReactionRemove event
   */
  async handleMessageReactionRemove(event, reaction, user) {
    if (user.bot) return;

    // Handle role reactions
    if (event.config?.roleReactions) {
      await this.handleRoleReaction(event, reaction, user, 'remove');
    }
  }

  /**
   * Handle role reactions
   */
  async handleRoleReaction(event, reaction, user, action) {
    const roleReactions = event.config.roleReactions;
    const emoji = reaction.emoji.name;

    const roleConfig = roleReactions.find(rr => rr.emoji === emoji);
    if (!roleConfig) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(roleConfig.roleId);

    if (!role) return;

    if (action === 'add') {
      await member.roles.add(role);
      console.log(`[EventHandler] Added role ${role.name} to ${user.tag}`);
    } else {
      await member.roles.remove(role);
      console.log(`[EventHandler] Removed role ${role.name} from ${user.tag}`);
    }
  }

  /**
   * Execute event action
   */
  async executeEventAction(event, channel, context) {
    if (!event.action) return;

    switch (event.action.type) {
      case 'sendMessage':
        let message = event.action.message || 'Event triggered';

        // Replace placeholders
        message = message
          .replace('{user}', context.user?.tag || 'Unknown')
          .replace('{memberCount}', context.memberCount || '0');

        await channel.send(message);
        break;

      case 'sendEmbed':
        const embedData = event.action.embedData || {};
        const embed = new EmbedBuilder()
          .setTitle(embedData.title || 'Event')
          .setDescription(embedData.description || 'An event occurred')
          .setColor(embedData.color || '#0099ff');

        if (embedData.fields) {
          embed.addFields(embedData.fields);
        }

        await channel.send({ embeds: [embed] });
        break;

      case 'assignRole':
        if (context.user && event.action.roleId) {
          const guild = channel.guild;
          const member = await guild.members.fetch(context.user.id);
          const role = guild.roles.cache.get(event.action.roleId);

          if (role) {
            await member.roles.add(role);
          }
        }
        break;

      default:
        console.warn(`[EventHandler] Unknown action type: ${event.action.type}`);
    }
  }
}

export default EventHandler;
