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
        </select>
      </div>

      <div class="form-group">
        <label>API URL *</label>
        <input
          v-model="formData.apiUrl"
          type="text"
          :placeholder="apiUrlPlaceholder"
          required
        />
        <small>{{ apiUrlHelp }}</small>
      </div>

      <div class="form-group">
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
import { ref, computed } from 'vue';

const props = defineProps({
  integration: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'cancel']);

const isEdit = !!props.integration;

const formData = ref({
  name: props.integration?.name || '',
  service: props.integration?.service || 'plex',
  apiUrl: props.integration?.config?.apiUrl || '',
  apiKey: props.integration?.config?.apiKey || '',
  serverName: props.integration?.config?.serverName || ''
});

const apiUrlPlaceholder = computed(() => {
  switch (formData.value.service) {
    case 'plex':
      return 'http://192.168.1.100:32400';
    case 'sonarr':
      return 'http://192.168.1.100:8989';
    case 'radarr':
      return 'http://192.168.1.100:7878';
    default:
      return 'http://your-server:port';
  }
});

const apiUrlHelp = computed(() => {
  switch (formData.value.service) {
    case 'plex':
      return 'Your Plex server URL (e.g., http://192.168.1.100:32400 or http://192.168.1.100:32400/)';
    case 'sonarr':
      return 'Your Sonarr URL (e.g., http://192.168.1.100:8989 - with or without trailing slash)';
    case 'radarr':
      return 'Your Radarr URL (e.g., http://192.168.1.100:7878 - with or without trailing slash)';
    default:
      return 'The base URL of your service (with or without trailing slash)';
  }
});

const apiKeyHelp = computed(() => {
  switch (formData.value.service) {
    case 'plex':
      return 'Find your Plex token in Settings > Account > Authorized Devices';
    case 'sonarr':
      return 'Find in Sonarr Settings > General > Security > API Key';
    case 'radarr':
      return 'Find in Radarr Settings > General > Security > API Key';
    default:
      return 'Your service API key or token';
  }
});

function handleSubmit() {
  const integration = {
    name: formData.value.name,
    service: formData.value.service,
    config: {
      apiUrl: formData.value.apiUrl,
      apiKey: formData.value.apiKey
    }
  };

  if (formData.value.service === 'plex' && formData.value.serverName) {
    integration.config.serverName = formData.value.serverName;
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
</style>
