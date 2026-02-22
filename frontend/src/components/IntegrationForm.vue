<template>
  <div class="integration-form">
    <h3>{{ isEdit ? 'Edit Integration' : 'Add Integration' }}</h3>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Integration Name *</label>
        <input
          v-model="formData.name"
          type="text"
          placeholder="My Plex Server"
          required
        />
      </div>

      <div class="form-group">
        <label>Service *</label>
        <select v-model="formData.service" required>
          <option value="plex">Plex Media Server</option>
          <option value="sonarr">Sonarr</option>
          <option value="radarr">Radarr</option>
          <option value="lidarr">Lidarr</option>
          <option value="readarr">Readarr</option>
          <option value="overseerr">Overseerr</option>
          <option value="starboard">Starboard</option>
        </select>
      </div>

      <!-- Starboard config -->
      <div v-if="formData.service === 'starboard'" class="scheduler-section">
        <h4>Starboard Settings</h4>
        <small class="scheduler-help">Pin popular messages to a dedicated channel when they reach a reaction threshold.</small>

        <div class="form-group">
          <label>Starboard Channel *</label>
          <select v-if="channels.length" v-model="formData.starboardChannelId" required>
            <option value="" disabled>Select a channel</option>
            <option v-for="ch in channels" :key="ch.id" :value="ch.id">
              #{{ ch.name }} ({{ ch.guild }})
            </option>
          </select>
          <input
            v-else
            v-model="formData.starboardChannelId"
            type="text"
            placeholder="Paste channel ID"
            required
          />
          <small v-if="channelError" style="color: #ed4245;">{{ channelError }}</small>
        </div>

        <div class="form-group">
          <label>Reaction Emoji</label>
          <input v-model="formData.starboardEmoji" type="text" placeholder="⭐" />
          <small>The emoji that triggers the starboard (default: ⭐)</small>
        </div>

        <div class="form-group">
          <label>Reaction Threshold</label>
          <input v-model.number="formData.starboardThreshold" type="number" min="1" max="100" placeholder="3" />
          <small>Number of reactions needed to post to starboard</small>
        </div>
      </div>

      <div v-if="formData.service !== 'starboard'" class="form-group">
        <label>API URL *</label>
        <input
          v-model="formData.apiUrl"
          type="text"
          :placeholder="apiUrlPlaceholder"
          required
        />
        <small>{{ apiUrlHelp }}</small>
      </div>

      <div v-if="formData.service !== 'starboard'" class="form-group">
        <label>API Key / Token *</label>
        <input
          v-model="formData.apiKey"
          type="password"
          placeholder="Your API key or token"
          required
        />
        <small>{{ apiKeyHelp }}</small>
      </div>

      <div v-if="formData.service === 'plex'" class="form-group">
        <label>Server Name (optional)</label>
        <input
          v-model="formData.serverName"
          type="text"
          placeholder="My Plex Server"
        />
      </div>

      <!-- Plex Newsletter Scheduler -->
      <div v-if="formData.service === 'plex'" class="scheduler-section">
        <h4>Newsletter Scheduler</h4>
        <small class="scheduler-help">Automatically post new Plex additions to a Discord channel.</small>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="formData.schedulerEnabled" />
            Enable Newsletter Scheduler
          </label>
        </div>

        <div v-if="formData.schedulerEnabled">
          <div class="form-group">
            <label>Discord Channel *</label>
            <select v-if="channels.length" v-model="formData.schedulerChannelId" :required="formData.schedulerEnabled">
              <option value="" disabled>Select a channel</option>
              <option v-for="ch in channels" :key="ch.id" :value="ch.id">
                #{{ ch.name }} ({{ ch.guild }})
              </option>
            </select>
            <input
              v-else
              v-model="formData.schedulerChannelId"
              type="text"
              placeholder="Paste channel ID (right-click channel in Discord → Copy ID)"
              :required="formData.schedulerEnabled"
            />
            <small v-if="channelError" style="color: #ed4245;">{{ channelError }} — paste the channel ID manually instead.</small>
            <small v-else-if="!channels.length">Enable Developer Mode in Discord (Settings → App Settings → Advanced) to copy channel IDs.</small>
          </div>

          <div class="form-group">
            <label>Check Interval *</label>
            <select v-model="formData.schedulerInterval" :required="formData.schedulerEnabled">
              <option value="hourly">Every Hour</option>
              <option value="every6h">Every 6 Hours</option>
              <option value="daily">Daily (9:00 AM)</option>
              <option value="weekly">Weekly (Monday 9:00 AM)</option>
            </select>
          </div>

        </div>

        <div v-if="isEdit && formData.schedulerChannelId" class="form-group">
          <button type="button" class="btn btn-test" :disabled="testLoading" @click="handleTestNewsletter">
            {{ testLoading ? 'Sending...' : 'Send Test Newsletter' }}
          </button>
          <small v-if="testResult" :class="testResult.ok ? 'test-ok' : 'test-error'">
            {{ testResult.message }}
          </small>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save Integration' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { botService, integrationService } from '../services/api';

const props = defineProps({
  integration: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  botId: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['submit', 'cancel']);

const isEdit = !!props.integration;

const formData = ref({
  name: props.integration?.name || '',
  service: props.integration?.service || 'plex',
  apiUrl: props.integration?.config?.apiUrl || '',
  apiKey: props.integration?.config?.apiKey || '',
  serverName: props.integration?.config?.serverName || '',
  schedulerEnabled: props.integration?.config?.scheduler?.enabled || false,
  schedulerChannelId: props.integration?.config?.scheduler?.channelId || '',
  schedulerInterval: props.integration?.config?.scheduler?.interval || 'daily',
  starboardChannelId: props.integration?.config?.channelId || '',
  starboardEmoji: props.integration?.config?.emoji || '⭐',
  starboardThreshold: props.integration?.config?.threshold || 3
});

const channels = ref([]);
const channelError = ref('');
const testLoading = ref(false);
const testResult = ref(null);

onMounted(async () => {
  if (props.botId) {
    try {
      const result = await botService.getBotChannels(props.botId);
      channels.value = result || [];
      console.log('Loaded channels:', channels.value.length);
    } catch (err) {
      channelError.value = err.response?.data?.error || err.message;
      console.warn('Could not load channels:', channelError.value);
    }
  }
});

const apiUrlPlaceholder = computed(() => {
  switch (formData.value.service) {
    case 'plex':      return 'http://192.168.1.100:32400';
    case 'sonarr':    return 'http://192.168.1.100:8989';
    case 'radarr':    return 'http://192.168.1.100:7878';
    case 'lidarr':    return 'http://192.168.1.100:8686';
    case 'readarr':   return 'http://192.168.1.100:8787';
    case 'overseerr': return 'http://192.168.1.100:5055';
    default:          return 'http://your-server:port';
  }
});

const apiUrlHelp = computed(() => {
  switch (formData.value.service) {
    case 'plex':      return 'Your Plex server URL (e.g., http://192.168.1.100:32400)';
    case 'sonarr':    return 'Your Sonarr URL (e.g., http://192.168.1.100:8989)';
    case 'radarr':    return 'Your Radarr URL (e.g., http://192.168.1.100:7878)';
    case 'lidarr':    return 'Your Lidarr URL (e.g., http://192.168.1.100:8686)';
    case 'readarr':   return 'Your Readarr URL (e.g., http://192.168.1.100:8787)';
    case 'overseerr': return 'Your Overseerr URL (e.g., http://192.168.1.100:5055)';
    default:          return 'The base URL of your service';
  }
});

const apiKeyHelp = computed(() => {
  switch (formData.value.service) {
    case 'plex':      return 'Find your Plex token in Settings > Account > Authorized Devices';
    case 'sonarr':    return 'Find in Sonarr Settings > General > Security > API Key';
    case 'radarr':    return 'Find in Radarr Settings > General > Security > API Key';
    case 'lidarr':    return 'Find in Lidarr Settings > General > Security > API Key';
    case 'readarr':   return 'Find in Readarr Settings > General > Security > API Key';
    case 'overseerr': return 'Find in Overseerr Settings > General > API Key';
    default:          return 'Your service API key or token';
  }
});

async function handleTestNewsletter() {
  testResult.value = null;
  testLoading.value = true;
  try {
    const result = await integrationService.testNewsletter(props.botId, props.integration.id);
    testResult.value = { ok: true, message: result.data.message };
  } catch (err) {
    testResult.value = { ok: false, message: err.response?.data?.error || err.message };
  } finally {
    testLoading.value = false;
  }
}

function handleSubmit() {
  const integration = {
    name: formData.value.name,
    service: formData.value.service,
    config: {}
  };

  if (formData.value.service === 'starboard') {
    integration.config = {
      channelId: formData.value.starboardChannelId,
      emoji: formData.value.starboardEmoji || '⭐',
      threshold: formData.value.starboardThreshold || 3,
      postedMessageIds: props.integration?.config?.postedMessageIds || []
    };
  } else {
    integration.config = {
      apiUrl: formData.value.apiUrl,
      apiKey: formData.value.apiKey
    };
    if (formData.value.service === 'plex') {
      if (formData.value.serverName) {
        integration.config.serverName = formData.value.serverName;
      }
      integration.config.scheduler = {
        enabled: formData.value.schedulerEnabled,
        channelId: formData.value.schedulerChannelId,
        interval: formData.value.schedulerInterval,
        lastChecked: props.integration?.config?.scheduler?.lastChecked || null,
        announcedIds: props.integration?.config?.scheduler?.announcedIds || []
      };
    }
  }

  emit('submit', integration);
}
</script>

<style scoped>
.integration-form {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.integration-form h3 {
  color: #fff;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: #b9bbbe;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: #40444b;
  border: 1px solid #202225;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #5865f2;
}

.form-group small {
  display: block;
  color: #72767d;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 2rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #5865f2;
  color: #fff;
}

.btn-secondary {
  background: #4f545c;
  color: #fff;
}

.scheduler-section {
  border-top: 1px solid #40444b;
  padding-top: 1.5rem;
  margin-top: 1rem;
}

.scheduler-section h4 {
  color: #fff;
  margin-bottom: 0.25rem;
}

.scheduler-help {
  display: block;
  color: #72767d;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #b9bbbe;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

.btn-test {
  background: #4f545c;
  color: #fff;
}

.test-ok {
  color: #57f287;
}

.test-error {
  color: #ed4245;
}
</style>
