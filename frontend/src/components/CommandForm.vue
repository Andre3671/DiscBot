<template>
  <div class="command-form">
    <h3>{{ isEdit ? 'Edit Command' : 'Add Command' }}</h3>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Command Name *</label>
        <input
          v-model="formData.name"
          type="text"
          placeholder="hello"
          required
        />
      </div>

      <div class="form-group">
        <label>Description</label>
        <input
          v-model="formData.description"
          type="text"
          placeholder="Says hello to the user"
        />
      </div>

      <div class="form-group">
        <label>Command Type *</label>
        <select v-model="formData.type" required>
          <option value="prefix">Prefix Only (!command)</option>
          <option value="slash">Slash Only (/command)</option>
          <option value="both">Both</option>
        </select>
      </div>

      <div class="form-group">
        <label>Response Type *</label>
        <select v-model="formData.responseType" required>
          <option value="text">Text Message</option>
          <option value="embed">Embed Message</option>
          <option value="moderation">Moderation Action</option>
          <option value="integration">Integration</option>
        </select>
      </div>

      <!-- Text Response -->
      <div v-if="formData.responseType === 'text'" class="form-group">
        <label>Response Message *</label>
        <textarea
          v-model="formData.responseContent"
          placeholder="Hello! Welcome to the server!"
          rows="3"
          required
        ></textarea>
      </div>

      <!-- Embed Response -->
      <div v-if="formData.responseType === 'embed'" class="embed-config">
        <div class="form-group">
          <label>Embed Title</label>
          <input v-model="embedData.title" type="text" placeholder="Embed Title" />
        </div>
        <div class="form-group">
          <label>Embed Description</label>
          <textarea v-model="embedData.description" rows="3" placeholder="Embed description"></textarea>
        </div>
        <div class="form-group">
          <label>Embed Color (hex)</label>
          <input v-model="embedData.color" type="text" placeholder="#0099ff" />
        </div>
      </div>

      <!-- Moderation Action -->
      <div v-if="formData.responseType === 'moderation'" class="form-group">
        <label>Moderation Action *</label>
        <select v-model="formData.moderationAction" required>
          <option value="kick">Kick Member</option>
          <option value="ban">Ban Member</option>
          <option value="unban">Unban Member</option>
          <option value="timeout">Timeout Member</option>
          <option value="purge">Purge Messages</option>
          <option value="warn">Warn Member</option>
        </select>
      </div>

      <!-- Integration -->
      <div v-if="formData.responseType === 'integration'" class="integration-config">
        <div class="form-group">
          <label>Service *</label>
          <select v-model="formData.integrationService" required>
            <option value="plex">Plex</option>
            <option value="sonarr">Sonarr</option>
            <option value="radarr">Radarr</option>
            <option value="lidarr">Lidarr</option>
            <option value="readarr">Readarr</option>
            <option value="overseerr">Overseerr</option>
          </select>
        </div>
        <div class="form-group">
          <label>Action *</label>
          <select v-model="formData.integrationAction" required>
            <template v-if="formData.integrationService === 'plex'">
              <option value="nowPlaying">Now Playing</option>
              <option value="recentlyAdded">Recently Added</option>
              <option value="onDeck">On Deck</option>
              <option value="search">Search Library</option>
              <option value="stats">Library Stats</option>
            </template>
            <template v-else-if="formData.integrationService === 'sonarr'">
              <option value="calendar">Calendar</option>
              <option value="search">Search</option>
            </template>
            <template v-else-if="formData.integrationService === 'radarr'">
              <option value="calendar">Calendar</option>
              <option value="search">Search</option>
            </template>
            <template v-else-if="formData.integrationService === 'lidarr'">
              <option value="search">Search Artists</option>
              <option value="calendar">Upcoming Releases</option>
              <option value="queue">Download Queue</option>
            </template>
            <template v-else-if="formData.integrationService === 'readarr'">
              <option value="search">Search Books</option>
              <option value="calendar">Upcoming Releases</option>
            </template>
            <template v-else-if="formData.integrationService === 'overseerr'">
              <option value="requests">All Requests</option>
              <option value="pending">Pending Requests</option>
              <option value="search">Search Media</option>
            </template>
          </select>
        </div>
      </div>

      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save Command' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const SERVICE_DEFAULT_ACTION = {
  plex: 'nowPlaying',
  sonarr: 'calendar',
  radarr: 'calendar',
  lidarr: 'search',
  readarr: 'search',
  overseerr: 'requests'
};

const props = defineProps({
  command: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'cancel']);

const isEdit = !!props.command;

const formData = ref({
  name: props.command?.name || '',
  description: props.command?.description || '',
  type: props.command?.type || 'prefix',
  responseType: props.command?.responseType || 'text',
  responseContent: props.command?.responseContent || '',
  moderationAction: props.command?.moderationAction || 'kick',
  integrationService: props.command?.integrationService || 'plex',
  integrationAction: props.command?.integrationAction || 'search'
});

const embedData = ref({
  title: props.command?.embedData?.title || '',
  description: props.command?.embedData?.description || '',
  color: props.command?.embedData?.color || '#0099ff'
});

watch(() => formData.value.integrationService, (service) => {
  formData.value.integrationAction = SERVICE_DEFAULT_ACTION[service] || 'search';
});

function handleSubmit() {
  const command = { ...formData.value };

  if (command.responseType === 'embed') {
    command.embedData = { ...embedData.value };
  }

  emit('submit', command);
}
</script>

<style scoped>
.command-form {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.command-form h3 {
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
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  background: #40444b;
  border: 1px solid #202225;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #5865f2;
}

.embed-config,
.integration-config {
  background: #40444b;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
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
