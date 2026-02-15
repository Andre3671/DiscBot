<template>
  <div class="status-page">
    <div class="page-header">
      <h2>📊 Bot Status Dashboard</h2>
      <button @click="refreshAll" class="btn btn-refresh">🔄 Refresh All</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🤖</div>
        <div class="stat-content">
          <div class="stat-value">{{ totalBots }}</div>
          <div class="stat-label">Total Bots</div>
        </div>
      </div>

      <div class="stat-card online">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ runningBots }}</div>
          <div class="stat-label">Running</div>
        </div>
      </div>

      <div class="stat-card offline">
        <div class="stat-icon">💤</div>
        <div class="stat-content">
          <div class="stat-value">{{ offlineBots }}</div>
          <div class="stat-label">Offline</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🌐</div>
        <div class="stat-content">
          <div class="stat-value">{{ totalGuilds }}</div>
          <div class="stat-label">Total Servers</div>
        </div>
      </div>
    </div>

    <div class="bots-status">
      <h3>Bot Status Details</h3>

      <div v-if="loading" class="loading">Loading bot status...</div>

      <div v-else-if="bots.length === 0" class="empty">
        No bots configured yet.
      </div>

      <div v-else class="status-list">
        <div
          v-for="bot in bots"
          :key="bot.id"
          :class="['status-item', getStatus(bot.id).running ? 'running' : 'stopped']"
        >
          <div class="status-header">
            <div class="status-title">
              <span :class="['status-indicator', getStatus(bot.id).running ? 'online' : 'offline']"></span>
              <h4>{{ bot.name }}</h4>
            </div>
            <div class="status-actions">
              <button
                v-if="!getStatus(bot.id).running"
                @click="startBot(bot.id)"
                class="btn-mini btn-success"
              >
                ▶ Start
              </button>
              <button
                v-else
                @click="stopBot(bot.id)"
                class="btn-mini btn-warning"
              >
                ⏸ Stop
              </button>
              <router-link :to="`/bot/${bot.id}`" class="btn-mini btn-primary">
                ⚙️
              </router-link>
            </div>
          </div>

          <div class="status-details">
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span :class="['detail-value', getStatus(bot.id).running ? 'text-success' : 'text-muted']">
                {{ getStatus(bot.id).running ? 'Online' : 'Offline' }}
              </span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Prefix:</span>
              <span class="detail-value">{{ bot.prefix }}</span>
            </div>

            <div v-if="getStatus(bot.id).running" class="detail-row">
              <span class="detail-label">Username:</span>
              <span class="detail-value">{{ getStatus(bot.id).username || 'N/A' }}</span>
            </div>

            <div v-if="getStatus(bot.id).running" class="detail-row">
              <span class="detail-label">Servers:</span>
              <span class="detail-value">{{ getStatus(bot.id).guilds || 0 }}</span>
            </div>

            <div v-if="getStatus(bot.id).running" class="detail-row">
              <span class="detail-label">Ping:</span>
              <span class="detail-value">{{ getStatus(bot.id).ping || 0 }}ms</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Commands:</span>
              <span class="detail-value">{{ bot.commands?.length || 0 }}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Events:</span>
              <span class="detail-value">{{ bot.events?.length || 0 }}</span>
            </div>

            <div class="detail-row">
              <span class="detail-label">Integrations:</span>
              <span class="detail-value">{{ bot.integrations?.length || 0 }}</span>
            </div>

            <div v-if="getStatus(bot.id).running && getStatus(bot.id).uptime" class="detail-row">
              <span class="detail-label">Uptime:</span>
              <span class="detail-value">{{ formatUptime(getStatus(bot.id).uptime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useBotStore } from '../stores/botStore';

const botStore = useBotStore();

const loading = ref(true);

const bots = computed(() => botStore.bots);
const botStatuses = computed(() => botStore.botStatuses);

const totalBots = computed(() => bots.value.length);
const runningBots = computed(() => {
  return bots.value.filter(bot => botStatuses.value[bot.id]?.running).length;
});
const offlineBots = computed(() => totalBots.value - runningBots.value);
const totalGuilds = computed(() => {
  return Object.values(botStatuses.value)
    .filter(status => status.running)
    .reduce((sum, status) => sum + (status.guilds || 0), 0);
});

onMounted(async () => {
  await refreshAll();
  botStore.initializeSocket();

  // Auto-refresh every 30 seconds
  setInterval(refreshAll, 30000);
});

async function refreshAll() {
  loading.value = true;
  try {
    await botStore.fetchBots();
    await botStore.fetchAllBotStatuses();
  } catch (error) {
    console.error('Failed to refresh:', error);
  } finally {
    loading.value = false;
  }
}

function getStatus(botId) {
  return botStatuses.value[botId] || { running: false };
}

async function startBot(botId) {
  try {
    await botStore.startBot(botId);
    await botStore.updateBotStatus(botId);
  } catch (error) {
    alert('Failed to start bot: ' + error.message);
  }
}

async function stopBot(botId) {
  try {
    await botStore.stopBot(botId);
    await botStore.updateBotStatus(botId);
  } catch (error) {
    alert('Failed to stop bot: ' + error.message);
  }
}

function formatUptime(ms) {
  if (!ms) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
</script>

<style scoped>
.status-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  color: #fff;
  margin: 0;
}

.btn-refresh {
  background: #5865f2;
  color: #fff;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-refresh:hover {
  opacity: 0.9;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #2f3136;
  padding: 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-left: 4px solid #5865f2;
}

.stat-card.online {
  border-left-color: #3ba55d;
}

.stat-card.offline {
  border-left-color: #747f8d;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.stat-label {
  color: #b9bbbe;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.bots-status {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
}

.bots-status h3 {
  color: #fff;
  margin: 0 0 1.5rem 0;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
  color: #72767d;
}

.status-list {
  display: grid;
  gap: 1rem;
}

.status-item {
  background: #40444b;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid #747f8d;
  transition: all 0.3s;
}

.status-item.running {
  border-left-color: #3ba55d;
}

.status-item:hover {
  transform: translateX(4px);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #2f3136;
}

.status-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.online {
  background: #3ba55d;
  box-shadow: 0 0 8px #3ba55d;
  animation: pulse 2s infinite;
}

.status-indicator.offline {
  background: #747f8d;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-title h4 {
  color: #fff;
  margin: 0;
  font-size: 1.1rem;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-mini {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-mini:hover {
  opacity: 0.9;
}

.btn-success {
  background: #3ba55d;
  color: #fff;
}

.btn-warning {
  background: #faa61a;
  color: #fff;
}

.btn-primary {
  background: #5865f2;
  color: #fff;
}

.status-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: #2f3136;
  border-radius: 4px;
}

.detail-label {
  color: #b9bbbe;
  font-size: 0.9rem;
}

.detail-value {
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
}

.text-success {
  color: #3ba55d !important;
}

.text-muted {
  color: #747f8d !important;
}
</style>
