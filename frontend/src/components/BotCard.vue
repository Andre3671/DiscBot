<template>
  <div class="bot-card">
    <div class="bot-card-header">
      <h3>{{ bot.name }}</h3>
      <span :class="['status-badge', statusClass]">
        {{ statusText }}
      </span>
    </div>

    <div class="bot-card-info">
      <div class="info-row">
        <span class="label">Prefix:</span>
        <span class="value">{{ bot.prefix }}</span>
      </div>
      <div class="info-row">
        <span class="label">Commands:</span>
        <span class="value">{{ bot.commands?.length || 0 }}</span>
      </div>
      <div class="info-row">
        <span class="label">Events:</span>
        <span class="value">{{ bot.events?.length || 0 }}</span>
      </div>
      <div class="info-row">
        <span class="label">Created:</span>
        <span class="value">{{ formatDate(bot.createdAt) }}</span>
      </div>
    </div>

    <div class="bot-card-actions">
      <button
        v-if="!isRunning"
        @click="$emit('start', bot.id)"
        class="btn btn-success"
      >
        ▶ Start
      </button>
      <button
        v-else
        @click="$emit('stop', bot.id)"
        class="btn btn-warning"
      >
        ⏸ Stop
      </button>

      <router-link :to="`/bot/${bot.id}`" class="btn btn-primary">
        ⚙ Configure
      </router-link>

      <button
        @click="$emit('delete', bot.id)"
        class="btn btn-danger"
      >
        🗑 Delete
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  bot: {
    type: Object,
    required: true
  },
  status: {
    type: Object,
    default: null
  }
});

defineEmits(['start', 'stop', 'delete']);

const isRunning = computed(() => props.status?.running || false);
const statusText = computed(() => isRunning.value ? 'Online' : 'Offline');
const statusClass = computed(() => isRunning.value ? 'online' : 'offline');

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}
</script>

<style scoped>
.bot-card {
  background: #2f3136;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s, box-shadow 0.2s;
}

.bot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.bot-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1rem;
  border-bottom: 1px solid #40444b;
}

.bot-card-header h3 {
  color: #fff;
  margin: 0;
  font-size: 1.25rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.online {
  background: #3ba55d;
  color: #fff;
}

.status-badge.offline {
  background: #747f8d;
  color: #fff;
}

.bot-card-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.info-row .label {
  color: #b9bbbe;
}

.info-row .value {
  color: #fff;
  font-weight: 500;
}

.bot-card-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  text-decoration: none;
  text-align: center;
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

.btn-primary {
  background: #5865f2;
  color: #fff;
}

.btn-danger {
  background: #ed4245;
  color: #fff;
}
</style>
