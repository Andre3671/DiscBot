import { defineStore } from 'pinia';
import { botService } from '../services/api';
import { io } from 'socket.io-client';

export const useBotStore = defineStore('bots', {
  state: () => ({
    bots: [],
    currentBot: null,
    loading: false,
    error: null,
    socket: null,
    botStatuses: {}
  }),

  getters: {
    getBotById: (state) => (id) => {
      return state.bots.find(bot => bot.id === id);
    },

    runningBots: (state) => {
      return state.bots.filter(bot => state.botStatuses[bot.id]?.running);
    }
  },

  actions: {
    async fetchBots() {
      this.loading = true;
      this.error = null;

      try {
        this.bots = await botService.listBots();
      } catch (error) {
        this.error = error.message;
        console.error('Error fetching bots:', error);
      } finally {
        this.loading = false;
      }
    },

    async fetchBot(botId) {
      this.loading = true;
      this.error = null;

      try {
        this.currentBot = await botService.getBot(botId);
        return this.currentBot;
      } catch (error) {
        this.error = error.message;
        console.error('Error fetching bot:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createBot(botData) {
      this.loading = true;
      this.error = null;

      try {
        const newBot = await botService.createBot(botData);
        this.bots.push(newBot);
        return newBot;
      } catch (error) {
        this.error = error.message;
        console.error('Error creating bot:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateBot(botId, updates) {
      this.loading = true;
      this.error = null;

      try {
        const updatedBot = await botService.updateBot(botId, updates);

        const index = this.bots.findIndex(b => b.id === botId);
        if (index !== -1) {
          this.bots[index] = updatedBot;
        }

        if (this.currentBot?.id === botId) {
          this.currentBot = updatedBot;
        }

        return updatedBot;
      } catch (error) {
        this.error = error.message;
        console.error('Error updating bot:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async deleteBot(botId) {
      this.loading = true;
      this.error = null;

      try {
        await botService.deleteBot(botId);
        this.bots = this.bots.filter(b => b.id !== botId);

        if (this.currentBot?.id === botId) {
          this.currentBot = null;
        }
      } catch (error) {
        this.error = error.message;
        console.error('Error deleting bot:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async startBot(botId) {
      try {
        await botService.startBot(botId);
        await this.updateBotStatus(botId);
      } catch (error) {
        this.error = error.message;
        console.error('Error starting bot:', error);
        throw error;
      }
    },

    async stopBot(botId) {
      try {
        await botService.stopBot(botId);
        await this.updateBotStatus(botId);
      } catch (error) {
        this.error = error.message;
        console.error('Error stopping bot:', error);
        throw error;
      }
    },

    async restartBot(botId) {
      try {
        await botService.restartBot(botId);
        await this.updateBotStatus(botId);
      } catch (error) {
        this.error = error.message;
        console.error('Error restarting bot:', error);
        throw error;
      }
    },

    async updateBotStatus(botId) {
      try {
        const status = await botService.getBotStatus(botId);
        this.botStatuses[botId] = status;
      } catch (error) {
        console.error('Error fetching bot status:', error);
      }
    },

    async fetchAllBotStatuses() {
      for (const bot of this.bots) {
        await this.updateBotStatus(bot.id);
      }
    },

    initializeSocket() {
      if (this.socket) return;

      const socketUrl = window.location.origin;
      this.socket = io(socketUrl);

      this.socket.on('connect', () => {
        console.log('[Socket] Connected');
      });

      this.socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
      });

      this.socket.on('bot:status', (data) => {
        console.log('[Socket] Bot status update:', data);
        this.updateBotStatus(data.botId);
      });
    },

    subscribeToBot(botId) {
      if (this.socket) {
        this.socket.emit('subscribe', botId);
      }
    },

    unsubscribeFromBot(botId) {
      if (this.socket) {
        this.socket.emit('unsubscribe', botId);
      }
    },

    disconnectSocket() {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
    }
  }
});
