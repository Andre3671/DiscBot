<template>
  <div class="dashboard">
    <div class="dashboard-header">
      <h2>Your Discord Bots</h2>
      <router-link to="/bot/new" class="btn-primary">+ Create New Bot</router-link>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading bots...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>Error: {{ error }}</p>
    </div>

    <div v-else-if="bots.length === 0" class="empty-state">
      <p>No bots yet. Create your first Discord bot to get started!</p>
      <router-link to="/bot/new" class="btn-primary">Create Bot</router-link>
    </div>

    <div v-else class="bot-grid">
      <BotCard
        v-for="bot in bots"
        :key="bot.id"
        :bot="bot"
        :status="botStatuses[bot.id]"
        @start="handleStart"
        @stop="handleStop"
        @delete="handleDelete"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue';
import { useBotStore } from '../stores/botStore';
import BotCard from '../components/BotCard.vue';

const botStore = useBotStore();

const bots = computed(() => botStore.bots);
const loading = computed(() => botStore.loading);
const error = computed(() => botStore.error);
const botStatuses = computed(() => botStore.botStatuses);

onMounted(async () => {
  await botStore.fetchBots();
  await botStore.fetchAllBotStatuses();
  botStore.initializeSocket();
});

async function handleStart(botId) {
  try {
    await botStore.startBot(botId);
    alert('Bot started successfully!');
  } catch (error) {
    alert('Failed to start bot: ' + error.message);
  }
}

async function handleStop(botId) {
  try {
    await botStore.stopBot(botId);
    alert('Bot stopped successfully!');
  } catch (error) {
    alert('Failed to stop bot: ' + error.message);
  }
}

async function handleDelete(botId) {
  if (confirm('Are you sure you want to delete this bot?')) {
    try {
      await botStore.deleteBot(botId);
      alert('Bot deleted successfully!');
    } catch (error) {
      alert('Failed to delete bot: ' + error.message);
    }
  }
}
</script>

<style scoped>
.dashboard {
  width: 100%;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h2 {
  color: #fff;
  font-size: 2rem;
}

.btn-primary {
  background: #5865f2;
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #4752c4;
}

.loading, .error, .empty-state {
  text-align: center;
  padding: 3rem;
  background: #2f3136;
  border-radius: 8px;
}

.error {
  color: #ed4245;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.bot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}
</style>
