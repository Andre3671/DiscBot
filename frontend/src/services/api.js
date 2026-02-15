import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Bot API
export const botService = {
  async listBots() {
    const response = await api.get('/bots');
    return response.data.data;
  },

  async getBot(botId) {
    const response = await api.get(`/bots/${botId}`);
    return response.data.data;
  },

  async createBot(botData) {
    const response = await api.post('/bots', botData);
    return response.data.data;
  },

  async updateBot(botId, updates) {
    const response = await api.put(`/bots/${botId}`, updates);
    return response.data.data;
  },

  async deleteBot(botId) {
    const response = await api.delete(`/bots/${botId}`);
    return response.data;
  },

  async startBot(botId) {
    const response = await api.post(`/bots/${botId}/start`);
    return response.data;
  },

  async stopBot(botId) {
    const response = await api.post(`/bots/${botId}/stop`);
    return response.data;
  },

  async restartBot(botId) {
    const response = await api.post(`/bots/${botId}/restart`);
    return response.data;
  },

  async getBotStatus(botId) {
    const response = await api.get(`/bots/${botId}/status`);
    return response.data.data;
  },

  async getBotLogs(botId, lines = 100) {
    const response = await api.get(`/bots/${botId}/logs`, { params: { lines } });
    return response.data.data;
  }
};

// Command API
export const commandService = {
  async listCommands(botId) {
    const response = await api.get(`/bots/${botId}/commands`);
    return response.data.data;
  },

  async addCommand(botId, commandData) {
    const response = await api.post(`/bots/${botId}/commands`, commandData);
    return response.data.data;
  },

  async updateCommand(botId, commandId, updates) {
    const response = await api.put(`/bots/${botId}/commands/${commandId}`, updates);
    return response.data.data;
  },

  async deleteCommand(botId, commandId) {
    const response = await api.delete(`/bots/${botId}/commands/${commandId}`);
    return response.data;
  }
};

// Event API
export const eventService = {
  async listEvents(botId) {
    const response = await api.get(`/bots/${botId}/events`);
    return response.data.data;
  },

  async addEvent(botId, eventData) {
    const response = await api.post(`/bots/${botId}/events`, eventData);
    return response.data.data;
  },

  async updateEvent(botId, eventId, updates) {
    const response = await api.put(`/bots/${botId}/events/${eventId}`, updates);
    return response.data.data;
  },

  async deleteEvent(botId, eventId) {
    const response = await api.delete(`/bots/${botId}/events/${eventId}`);
    return response.data;
  }
};

// Integration API
export const integrationService = {
  async listIntegrations(botId) {
    const response = await api.get(`/bots/${botId}/integrations`);
    return response.data.data;
  },

  async addIntegration(botId, integrationData) {
    const response = await api.post(`/bots/${botId}/integrations`, integrationData);
    return response.data.data;
  },

  async updateIntegration(botId, integrationId, updates) {
    const response = await api.put(`/bots/${botId}/integrations/${integrationId}`, updates);
    return response.data.data;
  },

  async deleteIntegration(botId, integrationId) {
    const response = await api.delete(`/bots/${botId}/integrations/${integrationId}`);
    return response.data;
  }
};

export default api;
