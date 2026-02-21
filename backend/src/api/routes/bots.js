import express from 'express';
import { ChannelType } from 'discord.js';
import storage from '../../storage/StorageManager.js';

const router = express.Router();

/**
 * GET /api/bots
 * List all bots
 */
router.get('/', async (req, res) => {
  try {
    const bots = await storage.listBots();
    res.json({ success: true, data: bots });
  } catch (error) {
    console.error('[API] Error listing bots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bots/:id
 * Get bot details
 */
router.get('/:id', async (req, res) => {
  try {
    const bot = await storage.readBot(req.params.id);
    res.json({ success: true, data: bot });
  } catch (error) {
    console.error(`[API] Error getting bot ${req.params.id}:`, error);
    res.status(404).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots
 * Create new bot
 */
router.post('/', async (req, res) => {
  try {
    const { name, token, prefix, settings } = req.body;

    if (!name || !token) {
      return res.status(400).json({
        success: false,
        error: 'Name and token are required'
      });
    }

    const bot = await storage.createBot({
      name,
      token,
      prefix: prefix || '!',
      settings: settings || {}
    });

    res.status(201).json({ success: true, data: bot });
  } catch (error) {
    console.error('[API] Error creating bot:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/bots/:id
 * Update bot configuration
 */
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    delete updates.id; // Prevent ID changes
    delete updates.createdAt; // Prevent timestamp changes

    const bot = await storage.updateBot(req.params.id, updates);
    res.json({ success: true, data: bot });
  } catch (error) {
    console.error(`[API] Error updating bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/bots/:id
 * Delete bot
 */
router.delete('/:id', async (req, res) => {
  try {
    // Import BotManager dynamically to avoid circular dependency
    const { default: BotManager } = await import('../../bot/BotManager.js');

    // Stop bot if running
    if (BotManager.isRunning(req.params.id)) {
      await BotManager.stopBot(req.params.id);
    }

    await storage.deleteBot(req.params.id);
    res.json({ success: true, message: 'Bot deleted successfully' });
  } catch (error) {
    console.error(`[API] Error deleting bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/start
 * Start bot instance
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { default: BotManager } = await import('../../bot/BotManager.js');

    await BotManager.startBot(req.params.id);
    res.json({ success: true, message: 'Bot started successfully' });
  } catch (error) {
    console.error(`[API] Error starting bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/stop
 * Stop bot instance
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { default: BotManager } = await import('../../bot/BotManager.js');

    await BotManager.stopBot(req.params.id);
    res.json({ success: true, message: 'Bot stopped successfully' });
  } catch (error) {
    console.error(`[API] Error stopping bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/restart
 * Restart bot instance
 */
router.post('/:id/restart', async (req, res) => {
  try {
    const { default: BotManager } = await import('../../bot/BotManager.js');

    await BotManager.restartBot(req.params.id);
    res.json({ success: true, message: 'Bot restarted successfully' });
  } catch (error) {
    console.error(`[API] Error restarting bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bots/:id/status
 * Get bot runtime status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { default: BotManager } = await import('../../bot/BotManager.js');

    const status = BotManager.getBotStatus(req.params.id);
    res.json({ success: true, data: status });
  } catch (error) {
    console.error(`[API] Error getting bot status ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bots/:id/logs
 * Get bot logs
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const logs = await storage.readLogs(req.params.id, lines);
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error(`[API] Error getting bot logs ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bots/:id/channels
 * Get available text channels for the bot (bot must be running)
 */
router.get('/:id/channels', async (req, res) => {
  try {
    const { default: BotManager } = await import('../../bot/BotManager.js');

    if (!BotManager.isRunning(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Bot must be running to fetch channels'
      });
    }

    const botInstance = BotManager.bots.get(req.params.id);
    const client = botInstance.client;

    // Fetch all guilds and their channels via API (cache may be empty on first request)
    const guilds = await client.guilds.fetch();
    const channels = [];
    for (const [, oauthGuild] of guilds) {
      const guild = await client.guilds.fetch(oauthGuild.id);
      const guildChannels = await guild.channels.fetch();
      guildChannels.forEach(ch => {
        if (ch && (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)) {
          channels.push({ id: ch.id, name: ch.name, guild: guild.name });
        }
      });
    }

    console.log(`[API] Returning ${channels.length} text channels`);
    res.json({ success: true, data: channels });
  } catch (error) {
    console.error(`[API] Error fetching channels for bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== Commands Routes ==========

/**
 * GET /api/bots/:id/commands
 * List all commands for a bot
 */
router.get('/:id/commands', async (req, res) => {
  try {
    const bot = await storage.readBot(req.params.id);
    res.json({ success: true, data: bot.commands });
  } catch (error) {
    console.error(`[API] Error listing commands for bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/commands
 * Add command to bot
 */
router.post('/:id/commands', async (req, res) => {
  try {
    const command = await storage.addCommand(req.params.id, req.body);
    res.status(201).json({ success: true, data: command });
  } catch (error) {
    console.error(`[API] Error adding command to bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/bots/:id/commands/:cmdId
 * Update command
 */
router.put('/:id/commands/:cmdId', async (req, res) => {
  try {
    const command = await storage.updateCommand(req.params.id, req.params.cmdId, req.body);
    res.json({ success: true, data: command });
  } catch (error) {
    console.error(`[API] Error updating command ${req.params.cmdId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/bots/:id/commands/:cmdId
 * Delete command
 */
router.delete('/:id/commands/:cmdId', async (req, res) => {
  try {
    await storage.deleteCommand(req.params.id, req.params.cmdId);
    res.json({ success: true, message: 'Command deleted successfully' });
  } catch (error) {
    console.error(`[API] Error deleting command ${req.params.cmdId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== Events Routes ==========

/**
 * GET /api/bots/:id/events
 * List all events for a bot
 */
router.get('/:id/events', async (req, res) => {
  try {
    const bot = await storage.readBot(req.params.id);
    res.json({ success: true, data: bot.events });
  } catch (error) {
    console.error(`[API] Error listing events for bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/events
 * Add event to bot
 */
router.post('/:id/events', async (req, res) => {
  try {
    const event = await storage.addEvent(req.params.id, req.body);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error(`[API] Error adding event to bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/bots/:id/events/:eventId
 * Update event
 */
router.put('/:id/events/:eventId', async (req, res) => {
  try {
    const event = await storage.updateEvent(req.params.id, req.params.eventId, req.body);
    res.json({ success: true, data: event });
  } catch (error) {
    console.error(`[API] Error updating event ${req.params.eventId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/bots/:id/events/:eventId
 * Delete event
 */
router.delete('/:id/events/:eventId', async (req, res) => {
  try {
    await storage.deleteEvent(req.params.id, req.params.eventId);
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error(`[API] Error deleting event ${req.params.eventId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== Integrations Routes ==========

/**
 * GET /api/bots/:id/integrations
 * List all integrations for a bot
 */
router.get('/:id/integrations', async (req, res) => {
  try {
    const bot = await storage.readBot(req.params.id);
    res.json({ success: true, data: bot.integrations });
  } catch (error) {
    console.error(`[API] Error listing integrations for bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/integrations
 * Add integration to bot
 */
router.post('/:id/integrations', async (req, res) => {
  try {
    const integration = await storage.addIntegration(req.params.id, req.body);
    res.status(201).json({ success: true, data: integration });
  } catch (error) {
    console.error(`[API] Error adding integration to bot ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/bots/:id/integrations/:intId
 * Update integration
 */
router.put('/:id/integrations/:intId', async (req, res) => {
  try {
    const integration = await storage.updateIntegration(req.params.id, req.params.intId, req.body);
    res.json({ success: true, data: integration });
  } catch (error) {
    console.error(`[API] Error updating integration ${req.params.intId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/bots/:id/integrations/:intId
 * Delete integration
 */
router.delete('/:id/integrations/:intId', async (req, res) => {
  try {
    await storage.deleteIntegration(req.params.id, req.params.intId);
    res.json({ success: true, message: 'Integration deleted successfully' });
  } catch (error) {
    console.error(`[API] Error deleting integration ${req.params.intId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bots/:id/integrations/:intId/test-newsletter
 * Trigger a manual test of the Plex newsletter scheduler
 */
router.post('/:id/integrations/:intId/test-newsletter', async (req, res) => {
  try {
    const { default: BotManager } = await import('../../bot/BotManager.js');
    const { default: PlexScheduler } = await import('../../bot/integrations/PlexScheduler.js');

    if (!BotManager.isRunning(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Bot must be running to send a test newsletter' });
    }

    const botInstance = BotManager.bots.get(req.params.id);
    const result = await PlexScheduler.testCheck(req.params.id, req.params.intId, botInstance.client);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(`[API] Error running test newsletter for integration ${req.params.intId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
