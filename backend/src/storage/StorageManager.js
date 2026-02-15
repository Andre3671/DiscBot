import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOTS_DIR = path.join(__dirname, '../../../data/bots');
const LOGS_DIR = path.join(__dirname, '../../../data/logs');

class StorageManager {
  constructor() {
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(BOTS_DIR, { recursive: true });
      await fs.mkdir(LOGS_DIR, { recursive: true });
      console.log('[StorageManager] Data directories initialized');
    } catch (error) {
      console.error('[StorageManager] Error initializing directories:', error);
    }
  }

  /**
   * Read a bot configuration from file
   */
  async readBot(botId) {
    try {
      const filePath = path.join(BOTS_DIR, `${botId}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Bot with ID ${botId} not found`);
      }
      throw error;
    }
  }

  /**
   * Write bot configuration to file
   */
  async writeBot(botId, config) {
    try {
      const filePath = path.join(BOTS_DIR, `${botId}.json`);

      // Ensure the config has required fields
      const botConfig = {
        id: botId,
        name: config.name || 'Unnamed Bot',
        token: config.token || '',
        prefix: config.prefix || '!',
        status: config.status || 'offline',
        createdAt: config.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        commands: config.commands || [],
        events: config.events || [],
        integrations: config.integrations || [],
        settings: config.settings || {}
      };

      await fs.writeFile(filePath, JSON.stringify(botConfig, null, 2), 'utf8');
      return botConfig;
    } catch (error) {
      console.error(`[StorageManager] Error writing bot ${botId}:`, error);
      throw error;
    }
  }

  /**
   * List all bot configurations
   */
  async listBots() {
    try {
      const files = await fs.readdir(BOTS_DIR);
      const botFiles = files.filter(file => file.endsWith('.json'));

      const bots = await Promise.all(
        botFiles.map(async (file) => {
          const botId = file.replace('.json', '');
          try {
            return await this.readBot(botId);
          } catch (error) {
            console.error(`[StorageManager] Error reading bot ${botId}:`, error);
            return null;
          }
        })
      );

      return bots.filter(bot => bot !== null);
    } catch (error) {
      console.error('[StorageManager] Error listing bots:', error);
      return [];
    }
  }

  /**
   * Delete a bot configuration file
   */
  async deleteBot(botId) {
    try {
      const filePath = path.join(BOTS_DIR, `${botId}.json`);
      await fs.unlink(filePath);
      console.log(`[StorageManager] Deleted bot ${botId}`);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Bot with ID ${botId} not found`);
      }
      throw error;
    }
  }

  /**
   * Create a new bot with generated ID
   */
  async createBot(config) {
    const botId = uuidv4();
    await this.writeBot(botId, config);
    return await this.readBot(botId);
  }

  /**
   * Update specific fields of a bot config
   */
  async updateBot(botId, updates) {
    const currentConfig = await this.readBot(botId);
    const updatedConfig = { ...currentConfig, ...updates };
    return await this.writeBot(botId, updatedConfig);
  }

  /**
   * Check if a bot exists
   */
  async botExists(botId) {
    try {
      await this.readBot(botId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add a command to a bot
   */
  async addCommand(botId, command) {
    const bot = await this.readBot(botId);
    const commandWithId = {
      id: uuidv4(),
      ...command,
      createdAt: new Date().toISOString()
    };
    bot.commands.push(commandWithId);
    await this.writeBot(botId, bot);
    return commandWithId;
  }

  /**
   * Update a command
   */
  async updateCommand(botId, commandId, updates) {
    const bot = await this.readBot(botId);
    const commandIndex = bot.commands.findIndex(cmd => cmd.id === commandId);

    if (commandIndex === -1) {
      throw new Error(`Command with ID ${commandId} not found`);
    }

    bot.commands[commandIndex] = {
      ...bot.commands[commandIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.writeBot(botId, bot);
    return bot.commands[commandIndex];
  }

  /**
   * Delete a command
   */
  async deleteCommand(botId, commandId) {
    const bot = await this.readBot(botId);
    bot.commands = bot.commands.filter(cmd => cmd.id !== commandId);
    await this.writeBot(botId, bot);
    return true;
  }

  /**
   * Add an event to a bot
   */
  async addEvent(botId, event) {
    const bot = await this.readBot(botId);
    const eventWithId = {
      id: uuidv4(),
      ...event,
      createdAt: new Date().toISOString()
    };
    bot.events.push(eventWithId);
    await this.writeBot(botId, bot);
    return eventWithId;
  }

  /**
   * Update an event
   */
  async updateEvent(botId, eventId, updates) {
    const bot = await this.readBot(botId);
    const eventIndex = bot.events.findIndex(evt => evt.id === eventId);

    if (eventIndex === -1) {
      throw new Error(`Event with ID ${eventId} not found`);
    }

    bot.events[eventIndex] = {
      ...bot.events[eventIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.writeBot(botId, bot);
    return bot.events[eventIndex];
  }

  /**
   * Delete an event
   */
  async deleteEvent(botId, eventId) {
    const bot = await this.readBot(botId);
    bot.events = bot.events.filter(evt => evt.id !== eventId);
    await this.writeBot(botId, bot);
    return true;
  }

  /**
   * Add an integration to a bot
   */
  async addIntegration(botId, integration) {
    const bot = await this.readBot(botId);
    const integrationWithId = {
      id: uuidv4(),
      ...integration,
      createdAt: new Date().toISOString()
    };
    bot.integrations.push(integrationWithId);
    await this.writeBot(botId, bot);
    return integrationWithId;
  }

  /**
   * Update an integration
   */
  async updateIntegration(botId, integrationId, updates) {
    const bot = await this.readBot(botId);
    const integrationIndex = bot.integrations.findIndex(int => int.id === integrationId);

    if (integrationIndex === -1) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    bot.integrations[integrationIndex] = {
      ...bot.integrations[integrationIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.writeBot(botId, bot);
    return bot.integrations[integrationIndex];
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(botId, integrationId) {
    const bot = await this.readBot(botId);
    bot.integrations = bot.integrations.filter(int => int.id !== integrationId);
    await this.writeBot(botId, bot);
    return true;
  }

  /**
   * Write log entry
   */
  async writeLog(botId, logEntry) {
    try {
      const logFile = path.join(LOGS_DIR, `${botId}.log`);
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ${logEntry}\n`;
      await fs.appendFile(logFile, logLine, 'utf8');
    } catch (error) {
      console.error(`[StorageManager] Error writing log for bot ${botId}:`, error);
    }
  }

  /**
   * Read logs for a bot
   */
  async readLogs(botId, lines = 100) {
    try {
      const logFile = path.join(LOGS_DIR, `${botId}.log`);
      const data = await fs.readFile(logFile, 'utf8');
      const allLines = data.split('\n').filter(line => line.trim());
      return allLines.slice(-lines);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

export default new StorageManager();
