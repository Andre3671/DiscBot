<template>
  <div class="bot-details">
    <div v-if="loading" class="loading">Loading bot details...</div>

    <div v-else-if="bot" class="bot-content">
      <div class="bot-header">
        <div>
          <h2>{{ bot.name }}</h2>
          <span :class="['status-badge', statusClass]">{{ statusText }}</span>
        </div>
        <div class="header-actions">
          <button
            v-if="!isRunning"
            @click="handleStart"
            class="btn btn-success"
          >
            ▶ Start Bot
          </button>
          <button
            v-else
            @click="handleStop"
            class="btn btn-warning"
          >
            ⏸ Stop Bot
          </button>
          <button @click="handleRestart" class="btn btn-info">
            🔄 Restart
          </button>
          <router-link to="/" class="btn btn-secondary">← Back</router-link>
        </div>
      </div>

      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="['tab', { active: activeTab === tab }]"
          @click="changeTab(tab)"
        >
          {{ tab }}
        </button>
      </div>

      <div class="tab-content">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'Overview'" class="overview">
          <div class="info-card">
            <div class="card-header">
              <h3>Bot Information</h3>
              <button @click="editingInfo = !editingInfo" class="btn-edit">
                {{ editingInfo ? 'Cancel' : 'Edit' }}
              </button>
            </div>

            <div v-if="!editingInfo">
              <div class="info-row">
                <span>ID:</span>
                <span>{{ bot.id }}</span>
              </div>
              <div class="info-row">
                <span>Name:</span>
                <span>{{ bot.name }}</span>
              </div>
              <div class="info-row">
                <span>Prefix:</span>
                <span>{{ bot.prefix }}</span>
              </div>
              <div class="info-row">
                <span>Commands:</span>
                <span>{{ bot.commands?.length || 0 }}</span>
              </div>
              <div class="info-row">
                <span>Events:</span>
                <span>{{ bot.events?.length || 0 }}</span>
              </div>
              <div class="info-row">
                <span>Integrations:</span>
                <span>{{ bot.integrations?.length || 0 }}</span>
              </div>
              <div class="info-row">
                <span>Created:</span>
                <span>{{ formatDate(bot.createdAt) }}</span>
              </div>
            </div>

            <form v-else @submit.prevent="handleUpdateInfo" class="edit-form">
              <div class="form-group">
                <label>Bot Name</label>
                <input v-model="editInfo.name" type="text" required />
              </div>
              <div class="form-group">
                <label>Prefix</label>
                <input v-model="editInfo.prefix" type="text" maxlength="3" />
              </div>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
          </div>

          <div v-if="status.running" class="info-card">
            <h3>Runtime Stats</h3>
            <div class="info-row">
              <span>Username:</span>
              <span>{{ status.username || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <span>Guilds:</span>
              <span>{{ status.guilds || 0 }}</span>
            </div>
            <div class="info-row">
              <span>Ping:</span>
              <span>{{ status.ping || 0 }}ms</span>
            </div>
          </div>
        </div>

        <!-- Commands Tab -->
        <div v-else-if="activeTab === 'Commands'" class="commands">
          <div class="tab-header">
            <h3>Commands ({{ bot.commands?.length || 0 }})</h3>
            <button @click="showCommandForm = true" class="btn btn-primary">
              + Add Command
            </button>
          </div>

          <CommandForm
            v-if="showCommandForm"
            :loading="submitting"
            @submit="handleAddCommand"
            @cancel="showCommandForm = false"
          />

          <p v-if="!showCommandForm && (!bot.commands || bot.commands.length === 0)" class="empty">
            No commands configured. Click "Add Command" to create your first command!
          </p>

          <div v-if="!showCommandForm && bot.commands && bot.commands.length > 0" class="command-list">
            <div v-for="cmd in bot.commands" :key="cmd.id" class="command-item">
              <div class="command-header">
                <div>
                  <h4>{{ cmd.name }}</h4>
                  <p>{{ cmd.description || 'No description' }}</p>
                  <div class="command-badges">
                    <span class="badge">{{ cmd.type || 'prefix' }}</span>
                    <span class="badge">{{ cmd.responseType }}</span>
                  </div>
                </div>
                <button @click="handleDeleteCommand(cmd.id)" class="btn-delete">
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Events Tab -->
        <div v-else-if="activeTab === 'Events'" class="events">
          <div class="tab-header">
            <h3>Events ({{ bot.events?.length || 0 }})</h3>
            <button @click="showEventForm = true" class="btn btn-primary">
              + Add Event
            </button>
          </div>

          <EventForm
            v-if="showEventForm"
            :loading="submitting"
            @submit="handleAddEvent"
            @cancel="showEventForm = false"
          />

          <p v-if="!showEventForm && (!bot.events || bot.events.length === 0)" class="empty">
            No events configured. Click "Add Event" to create your first event handler!
          </p>

          <div v-if="!showEventForm && bot.events && bot.events.length > 0" class="event-list">
            <div v-for="event in bot.events" :key="event.id" class="event-item">
              <div class="event-header">
                <div>
                  <h4>{{ event.name }}</h4>
                  <p>Event Type: <strong>{{ event.eventType }}</strong></p>
                  <p>Action: <strong>{{ event.action?.type }}</strong></p>
                </div>
                <button @click="handleDeleteEvent(event.id)" class="btn-delete">
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Integrations Tab -->
        <div v-else-if="activeTab === 'Integrations'" class="integrations">
          <div class="tab-header">
            <h3>Integrations ({{ bot.integrations?.length || 0 }})</h3>
            <button @click="showIntegrationForm = true" class="btn btn-primary">
              + Add Integration
            </button>
          </div>

          <IntegrationForm
            v-if="showIntegrationForm"
            :loading="submitting"
            :botId="bot.id"
            @submit="handleAddIntegration"
            @cancel="showIntegrationForm = false"
          />

          <p v-if="!showIntegrationForm && (!bot.integrations || bot.integrations.length === 0)" class="empty">
            No integrations configured. Add Plex, Sonarr, or Radarr integrations!
          </p>

          <div v-if="!showIntegrationForm && bot.integrations && bot.integrations.length > 0" class="integration-list">
            <div v-for="integration in bot.integrations" :key="integration.id" class="integration-item">
              <div class="integration-header">
                <div>
                  <h4>{{ integration.name || 'Unnamed integration' }}</h4>
                  <p>Service: <strong>{{ integration.service }}</strong></p>
                  <p>API URL: {{ integration.config?.apiUrl || 'Not configured' }}</p>
                  <p v-if="integration.config?.scheduler?.enabled" class="scheduler-active">
                    Newsletter: Active ({{ integration.config.scheduler.interval }})
                  </p>
                </div>
                <button @click="handleDeleteIntegration(integration.id)" class="btn-delete">
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Logs Tab -->
        <div v-else-if="activeTab === 'Logs'" class="logs">
          <div class="tab-header">
            <h3>Bot Logs</h3>
            <button @click="loadLogs" class="btn btn-secondary">🔄 Refresh</button>
          </div>
          <div class="logs-container">
            <div v-if="logs.length === 0" class="empty">No logs yet.</div>
            <div v-else class="log-entries">
              <div v-for="(log, index) in logs" :key="index" class="log-entry">
                {{ log }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useBotStore } from '../stores/botStore';
import { botService, commandService, eventService, integrationService } from '../services/api';
import CommandForm from '../components/CommandForm.vue';
import EventForm from '../components/EventForm.vue';
import IntegrationForm from '../components/IntegrationForm.vue';

const route = useRoute();
const botStore = useBotStore();

const loading = ref(true);
const submitting = ref(false);
const bot = ref(null);
const logs = ref([]);
const activeTab = ref('Overview');
const tabs = ['Overview', 'Commands', 'Events', 'Integrations', 'Logs'];

const showCommandForm = ref(false);
const showEventForm = ref(false);
const showIntegrationForm = ref(false);

const editingInfo = ref(false);
const editInfo = ref({ name: '', prefix: '' });

const status = computed(() => botStore.botStatuses[bot.value?.id] || {});
const isRunning = computed(() => status.value.running || false);
const statusText = computed(() => isRunning.value ? 'Online' : 'Offline');
const statusClass = computed(() => isRunning.value ? 'online' : 'offline');

onMounted(async () => {
  await loadBot();
});

async function loadBot() {
  try {
    loading.value = true;
    bot.value = await botStore.fetchBot(route.params.id);
    editInfo.value = {
      name: bot.value.name,
      prefix: bot.value.prefix
    };
    await botStore.updateBotStatus(route.params.id);
    botStore.subscribeToBot(route.params.id);
  } catch (error) {
    alert('Failed to load bot: ' + error.message);
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  try {
    logs.value = await botService.getBotLogs(bot.value.id);
  } catch (error) {
    console.error('Failed to load logs:', error);
  }
}

function changeTab(tab) {
  activeTab.value = tab;
  if (tab === 'Logs') {
    loadLogs();
  }
}

async function handleStart() {
  try {
    await botStore.startBot(bot.value.id);
    alert('Bot started!');
  } catch (error) {
    alert('Failed to start bot: ' + error.message);
  }
}

async function handleStop() {
  try {
    await botStore.stopBot(bot.value.id);
    alert('Bot stopped!');
  } catch (error) {
    alert('Failed to stop bot: ' + error.message);
  }
}

async function handleRestart() {
  try {
    await botStore.restartBot(bot.value.id);
    alert('Bot restarted!');
  } catch (error) {
    alert('Failed to restart bot: ' + error.message);
  }
}

async function handleUpdateInfo() {
  try {
    await botStore.updateBot(bot.value.id, {
      name: editInfo.value.name,
      prefix: editInfo.value.prefix
    });
    bot.value.name = editInfo.value.name;
    bot.value.prefix = editInfo.value.prefix;
    editingInfo.value = false;
    alert('Bot info updated!');
  } catch (error) {
    alert('Failed to update bot: ' + error.message);
  }
}

async function handleAddCommand(commandData) {
  try {
    submitting.value = true;
    await commandService.addCommand(bot.value.id, commandData);
    await loadBot();
    showCommandForm.value = false;
    alert('Command added successfully!');
  } catch (error) {
    alert('Failed to add command: ' + error.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteCommand(commandId) {
  if (!confirm('Are you sure you want to delete this command?')) return;

  try {
    await commandService.deleteCommand(bot.value.id, commandId);
    await loadBot();
    alert('Command deleted!');
  } catch (error) {
    alert('Failed to delete command: ' + error.message);
  }
}

async function handleAddEvent(eventData) {
  try {
    submitting.value = true;
    await eventService.addEvent(bot.value.id, eventData);
    await loadBot();
    showEventForm.value = false;
    alert('Event added successfully!');
  } catch (error) {
    alert('Failed to add event: ' + error.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) return;

  try {
    await eventService.deleteEvent(bot.value.id, eventId);
    await loadBot();
    alert('Event deleted!');
  } catch (error) {
    alert('Failed to delete event: ' + error.message);
  }
}

async function handleAddIntegration(integrationData) {
  try {
    submitting.value = true;
    await integrationService.addIntegration(bot.value.id, integrationData);
    await loadBot();
    showIntegrationForm.value = false;
    alert('Integration added successfully!');
  } catch (error) {
    alert('Failed to add integration: ' + error.message);
  } finally {
    submitting.value = false;
  }
}

async function handleDeleteIntegration(integrationId) {
  if (!confirm('Are you sure you want to delete this integration?')) return;

  try {
    await integrationService.deleteIntegration(bot.value.id, integrationId);
    await loadBot();
    alert('Integration deleted!');
  } catch (error) {
    alert('Failed to delete integration: ' + error.message);
  }
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
}
</script>

<style scoped>
.bot-details {
  max-width: 1200px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 3rem;
  background: #2f3136;
  border-radius: 8px;
}

.bot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.bot-header h2 {
  color: #fff;
  margin-bottom: 0.5rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.online {
  background: #3ba55d;
  color: #fff;
}

.status-badge.offline {
  background: #747f8d;
  color: #fff;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s;
}

.btn:hover {
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

.btn-info {
  background: #00b0f4;
  color: #fff;
}

.btn-secondary {
  background: #4f545c;
  color: #fff;
}

.btn-primary {
  background: #5865f2;
  color: #fff;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #40444b;
}

.tab {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  color: #b9bbbe;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.2s, border-color 0.2s;
}

.tab:hover {
  color: #fff;
}

.tab.active {
  color: #5865f2;
  border-bottom-color: #5865f2;
}

.tab-content {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
  min-height: 400px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.tab-header h3 {
  color: #fff;
  margin: 0;
}

.info-card {
  max-width: 600px;
  background: #40444b;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.info-card h3 {
  color: #fff;
  margin: 0;
}

.btn-edit {
  background: #5865f2;
  color: #fff;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid #2f3136;
}

.info-row span:first-child {
  color: #b9bbbe;
}

.info-row span:last-child {
  color: #fff;
  font-weight: 500;
}

.edit-form {
  margin-top: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  color: #b9bbbe;
  margin-bottom: 0.5rem;
}

.form-group input {
  width: 100%;
  padding: 0.5rem;
  background: #2f3136;
  border: 1px solid #202225;
  border-radius: 4px;
  color: #fff;
}

.empty {
  color: #72767d;
  text-align: center;
  padding: 2rem;
}

.command-list,
.event-list,
.integration-list {
  display: grid;
  gap: 1rem;
}

.command-item,
.event-item,
.integration-item {
  background: #40444b;
  padding: 1rem;
  border-radius: 4px;
}

.command-header,
.event-header,
.integration-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
}

.command-item h4,
.event-item h4,
.integration-item h4 {
  color: #fff;
  margin: 0 0 0.5rem 0;
}

.command-item p,
.event-item p,
.integration-item p {
  color: #b9bbbe;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.command-badges {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #5865f2;
  color: #fff;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-delete {
  background: #ed4245;
  color: #fff;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}

.logs-container {
  background: #202225;
  padding: 1rem;
  border-radius: 4px;
  max-height: 500px;
  overflow-y: auto;
}

.log-entries {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: #b9bbbe;
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid #2f3136;
}

.scheduler-active {
  color: #3ba55d;
  font-weight: 600;
}
</style>
