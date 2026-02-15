import { EmbedBuilder, PermissionFlagsBits, REST, Routes } from 'discord.js';

class CommandHandler {
  constructor(client, config) {
    this.client = client;
    this.config = config;
    this.commands = new Map();

    this.setupHandlers();
    this.loadCommands(config);
    this.registerSlashCommands();
  }

  /**
   * Set up message and interaction handlers
   */
  setupHandlers() {
    // Handle prefix commands
    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      const prefix = this.config.prefix || '!';
      if (!message.content.startsWith(prefix)) return;

      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      await this.executeCommand(commandName, message, args);
    });

    // Handle slash commands
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const commandName = interaction.commandName;
      await this.executeSlashCommand(commandName, interaction);
    });
  }

  /**
   * Load commands from config
   */
  loadCommands(config) {
    this.commands.clear();

    if (!config.commands || config.commands.length === 0) {
      console.log(`[CommandHandler] No commands configured for bot ${config.id}`);
      return;
    }

    for (const cmd of config.commands) {
      this.commands.set(cmd.name.toLowerCase(), cmd);
    }

    console.log(`[CommandHandler] Loaded ${this.commands.size} command(s) for bot ${config.id}`);
  }

  /**
   * Reload commands (for hot-reload)
   */
  reloadCommands(config) {
    console.log(`[CommandHandler] Reloading commands for bot ${config.id}`);
    this.config = config;
    this.loadCommands(config);
    this.registerSlashCommands(); // Re-register slash commands
  }

  /**
   * Register slash commands with Discord
   */
  async registerSlashCommands() {
    try {
      const slashCommands = Array.from(this.commands.values())
        .filter(cmd => cmd.type === 'slash' || cmd.type === 'both')
        .map(cmd => ({
          name: cmd.name.toLowerCase(),
          description: cmd.description || 'No description',
          options: cmd.options || []
        }));

      if (slashCommands.length === 0) {
        console.log(`[CommandHandler] No slash commands to register for bot ${this.config.id}`);
        return;
      }

      const rest = new REST({ version: '10' }).setToken(this.config.token);

      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: slashCommands }
      );

      console.log(`[CommandHandler] Registered ${slashCommands.length} slash command(s)`);
    } catch (error) {
      console.error('[CommandHandler] Error registering slash commands:', error);
    }
  }

  /**
   * Execute prefix command
   */
  async executeCommand(commandName, message, args) {
    const command = this.commands.get(commandName);

    if (!command) return; // Command not found

    if (command.type === 'slash') return; // Only slash command

    console.log(`[CommandHandler] Executing command: ${commandName}`);

    try {
      // Check permissions if specified
      if (command.requiredPermissions && !message.member.permissions.has(command.requiredPermissions)) {
        return message.reply('You do not have permission to use this command.');
      }

      // Execute based on response type
      await this.executeCommandAction(command, message, args);

      // Log command execution
      const { default: BotManager } = await import('./BotManager.js');
      BotManager.emitCommand(this.config.id, commandName, message.author.tag);
    } catch (error) {
      console.error(`[CommandHandler] Error executing command ${commandName}:`, error);
      message.reply('An error occurred while executing the command.');
    }
  }

  /**
   * Execute slash command
   */
  async executeSlashCommand(commandName, interaction) {
    const command = this.commands.get(commandName);

    if (!command) {
      return interaction.reply({ content: 'Command not found.', ephemeral: true });
    }

    console.log(`[CommandHandler] Executing slash command: ${commandName}`);

    try {
      // Check permissions if specified
      if (command.requiredPermissions && !interaction.member.permissions.has(command.requiredPermissions)) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }

      // Execute based on response type
      await this.executeCommandAction(command, interaction, null, true);

      // Log command execution
      const { default: BotManager } = await import('./BotManager.js');
      BotManager.emitCommand(this.config.id, commandName, interaction.user.tag);
    } catch (error) {
      console.error(`[CommandHandler] Error executing slash command ${commandName}:`, error);

      if (interaction.replied || interaction.deferred) {
        interaction.followUp({ content: 'An error occurred while executing the command.', ephemeral: true });
      } else {
        interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
      }
    }
  }

  /**
   * Execute command action based on type
   */
  async executeCommandAction(command, messageOrInteraction, args, isSlash = false) {
    switch (command.responseType) {
      case 'text':
        await this.sendTextResponse(command, messageOrInteraction, isSlash);
        break;

      case 'embed':
        await this.sendEmbedResponse(command, messageOrInteraction, isSlash);
        break;

      case 'reaction':
        if (!isSlash) {
          await messageOrInteraction.react(command.reaction || '✅');
        }
        break;

      case 'moderation':
        await this.executeModerationAction(command, messageOrInteraction, args, isSlash);
        break;

      case 'integration':
        await this.executeIntegration(command, messageOrInteraction, args, isSlash);
        break;

      default:
        console.warn(`[CommandHandler] Unknown response type: ${command.responseType}`);
    }
  }

  /**
   * Send text response
   */
  async sendTextResponse(command, messageOrInteraction, isSlash) {
    const content = command.responseContent || 'No response configured.';

    if (isSlash) {
      await messageOrInteraction.reply(content);
    } else {
      await messageOrInteraction.reply(content);
    }
  }

  /**
   * Send embed response
   */
  async sendEmbedResponse(command, messageOrInteraction, isSlash) {
    const embedData = command.embedData || {};

    const embed = new EmbedBuilder()
      .setTitle(embedData.title || 'Embed')
      .setDescription(embedData.description || 'No description')
      .setColor(embedData.color || '#0099ff');

    if (embedData.fields) {
      embed.addFields(embedData.fields);
    }

    if (embedData.footer) {
      embed.setFooter({ text: embedData.footer });
    }

    if (embedData.thumbnail) {
      embed.setThumbnail(embedData.thumbnail);
    }

    if (embedData.image) {
      embed.setImage(embedData.image);
    }

    if (isSlash) {
      await messageOrInteraction.reply({ embeds: [embed] });
    } else {
      await messageOrInteraction.reply({ embeds: [embed] });
    }
  }

  /**
   * Execute moderation action
   */
  async executeModerationAction(command, messageOrInteraction, args, isSlash) {
    const { default: ModerationHandler } = await import('./moderation/ModerationHandler.js');
    await ModerationHandler.execute(command, messageOrInteraction, args, isSlash);
  }

  /**
   * Execute integration action
   */
  async executeIntegration(command, messageOrInteraction, args, isSlash) {
    const integrationService = command.integrationService; // e.g., 'plex', 'sonarr', 'radarr'

    let handler;
    switch (integrationService) {
      case 'plex':
        const { default: PlexIntegration } = await import('./integrations/PlexIntegration.js');
        handler = PlexIntegration;
        break;

      case 'sonarr':
        const { default: SonarrIntegration } = await import('./integrations/SonarrIntegration.js');
        handler = SonarrIntegration;
        break;

      case 'radarr':
        const { default: RadarrIntegration } = await import('./integrations/RadarrIntegration.js');
        handler = RadarrIntegration;
        break;

      default:
        return messageOrInteraction.reply('Integration not configured.');
    }

    await handler.execute(command, messageOrInteraction, args, isSlash, this.config);
  }
}

export default CommandHandler;
