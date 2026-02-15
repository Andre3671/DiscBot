import { Client, GatewayIntentBits } from 'discord.js';
import storage from '../storage/StorageManager.js';
import CommandHandler from './CommandHandler.js';
import EventHandler from './EventHandler.js';
import PlexScheduler from './integrations/PlexScheduler.js';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOTS_DIR = path.join(__dirname, '../../../data/bots');

class BotManager {
  constructor() {
    this.bots = new Map(); // Map<botId, { client, config, commandHandler, eventHandler }>
    this.watcher = null;
    this.io = null; // Will be set by server.js
  }

  /**
   * Initialize the BotManager
   */
  async initialize() {
    console.log('[BotManager] Initializing...');

    // Import io from server
    try {
      const serverModule = await import('../server.js');
      this.io = serverModule.io;
    } catch (error) {
      console.log('[BotManager] Socket.io not yet available');
    }

    // Load and auto-start bots
    await this.loadAndStartBots();

    // Watch for config file changes
    this.watchConfigChanges();

    console.log('[BotManager] Initialized');
  }

  /**
   * Load all bot configs and start enabled bots
   */
  async loadAndStartBots() {
    try {
      const bots = await storage.listBots();
      console.log(`[BotManager] Found ${bots.length} bot configuration(s)`);

      for (const botConfig of bots) {
        if (botConfig.settings?.autoStart) {
          try {
            await this.startBot(botConfig.id);
          } catch (error) {
            console.error(`[BotManager] Error auto-starting bot ${botConfig.id}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('[BotManager] Error loading bots:', error);
    }
  }

  /**
   * Watch for config file changes and reload bots
   */
  watchConfigChanges() {
    this.watcher = chokidar.watch(`${BOTS_DIR}/*.json`, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', async (filePath) => {
      // Skip reload if PlexScheduler is writing (prevents reload loop)
      if (PlexScheduler.isWriting()) return;

      const botId = path.basename(filePath, '.json');
      console.log(`[BotManager] Config changed for bot ${botId}`);

      if (this.isRunning(botId)) {
        try {
          await this.reloadBotConfig(botId);
        } catch (error) {
          console.error(`[BotManager] Error reloading bot ${botId}:`, error.message);
        }
      }
    });

    console.log('[BotManager] Watching for config changes');
  }

  /**
   * Start a bot by ID
   */
  async startBot(botId) {
    if (this.isRunning(botId)) {
      throw new Error(`Bot ${botId} is already running`);
    }

    console.log(`[BotManager] Starting bot ${botId}...`);
    const botConfig = await storage.readBot(botId);

    if (!botConfig.token) {
      throw new Error('Bot token is required');
    }

    // Create Discord client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration
      ]
    });

    // Create handlers
    const commandHandler = new CommandHandler(client, botConfig);
    const eventHandler = new EventHandler(client, botConfig, this);

    // Set up error handling
    client.on('error', (error) => {
      console.error(`[Bot ${botId}] Error:`, error);
      this.emitLog(botId, `ERROR: ${error.message}`);
    });

    client.on('ready', () => {
      console.log(`[Bot ${botId}] Logged in as ${client.user.tag}`);
      this.emitLog(botId, `Bot ready as ${client.user.tag}`);
      storage.updateBot(botId, { status: 'online' });
      this.emitStatus(botId, 'online');
    });

    // Login to Discord
    try {
      await client.login(botConfig.token);

      // Store bot instance
      this.bots.set(botId, {
        client,
        config: botConfig,
        commandHandler,
        eventHandler
      });

      // Start Plex schedulers for this bot
      PlexScheduler.startForBot(botId, botConfig, client);

      console.log(`[BotManager] Bot ${botId} started successfully`);
      return true;
    } catch (error) {
      console.error(`[BotManager] Failed to start bot ${botId}:`, error.message);

      // Provide helpful error messages
      let errorMessage = error.message;
      if (error.message.includes('disallowed intents')) {
        errorMessage = 'PRIVILEGED INTENTS NOT ENABLED: Go to Discord Developer Portal → Bot → Enable "Message Content Intent", "Server Members Intent", and "Presence Intent" under Privileged Gateway Intents';
      } else if (error.message.includes('invalid token')) {
        errorMessage = 'INVALID TOKEN: Make sure you copied the Bot Token (not Public Key) from Discord Developer Portal → Bot → Reset Token';
      }

      this.emitLog(botId, `FAILED TO START: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  /**
   * Stop a bot by ID
   */
  async stopBot(botId) {
    if (!this.isRunning(botId)) {
      throw new Error(`Bot ${botId} is not running`);
    }

    console.log(`[BotManager] Stopping bot ${botId}...`);

    const botInstance = this.bots.get(botId);

    try {
      // Stop Plex schedulers for this bot
      PlexScheduler.stopForBot(botId);

      // Destroy Discord client
      botInstance.client.destroy();

      // Remove from map
      this.bots.delete(botId);

      // Update status
      await storage.updateBot(botId, { status: 'offline' });
      this.emitStatus(botId, 'offline');
      this.emitLog(botId, 'Bot stopped');

      console.log(`[BotManager] Bot ${botId} stopped successfully`);
      return true;
    } catch (error) {
      console.error(`[BotManager] Error stopping bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * Restart a bot (stop and start)
   */
  async restartBot(botId) {
    console.log(`[BotManager] Restarting bot ${botId}...`);

    if (this.isRunning(botId)) {
      await this.stopBot(botId);
    }

    await this.startBot(botId);
  }

  /**
   * Reload bot configuration without restart
   */
  async reloadBotConfig(botId) {
    if (!this.isRunning(botId)) {
      return;
    }

    console.log(`[BotManager] Reloading config for bot ${botId}...`);

    const newConfig = await storage.readBot(botId);
    const botInstance = this.bots.get(botId);

    // Update config
    botInstance.config = newConfig;

    // Reload handlers
    botInstance.commandHandler.reloadCommands(newConfig);
    botInstance.eventHandler.reloadEvents(newConfig);

    // Reload Plex schedulers with new config
    PlexScheduler.reloadForBot(botId, newConfig, botInstance.client);

    this.emitLog(botId, 'Configuration reloaded');
  }

  /**
   * Check if a bot is running
   */
  isRunning(botId) {
    return this.bots.has(botId);
  }

  /**
   * Get bot status
   */
  getBotStatus(botId) {
    const isRunning = this.isRunning(botId);

    if (!isRunning) {
      return {
        botId,
        running: false,
        status: 'offline'
      };
    }

    const botInstance = this.bots.get(botId);
    const client = botInstance.client;

    return {
      botId,
      running: true,
      status: 'online',
      username: client.user?.tag || 'Unknown',
      guilds: client.guilds.cache.size,
      uptime: client.uptime,
      ping: client.ws.ping
    };
  }

  /**
   * Get all running bots
   */
  getRunningBots() {
    return Array.from(this.bots.keys());
  }

  /**
   * Stop all bots (for graceful shutdown)
   */
  async stopAll() {
    console.log('[BotManager] Stopping all bots...');

    const stopPromises = Array.from(this.bots.keys()).map(botId =>
      this.stopBot(botId).catch(err => {
        console.error(`[BotManager] Error stopping bot ${botId}:`, err);
      })
    );

    await Promise.all(stopPromises);

    PlexScheduler.stopAll();

    if (this.watcher) {
      await this.watcher.close();
    }

    console.log('[BotManager] All bots stopped');
  }

  /**
   * Emit log event via Socket.io
   */
  emitLog(botId, message) {
    // Write to log file
    storage.writeLog(botId, message);

    // Emit via Socket.io
    if (this.io) {
      this.io.to(`bot-${botId}`).emit('bot:log', {
        botId,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Emit status change via Socket.io
   */
  emitStatus(botId, status) {
    if (this.io) {
      this.io.to(`bot-${botId}`).emit('bot:status', {
        botId,
        status,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Emit command execution log
   */
  emitCommand(botId, commandName, user) {
    const message = `Command executed: ${commandName} by ${user}`;
    this.emitLog(botId, message);

    if (this.io) {
      this.io.to(`bot-${botId}`).emit('bot:command', {
        botId,
        commandName,
        user,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Emit event trigger log
   */
  emitEvent(botId, eventType, data) {
    const message = `Event triggered: ${eventType}`;
    this.emitLog(botId, message);

    if (this.io) {
      this.io.to(`bot-${botId}`).emit('bot:event', {
        botId,
        eventType,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default new BotManager();
