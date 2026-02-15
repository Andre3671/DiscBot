<template>
  <div class="event-form">
    <h3>{{ isEdit ? 'Edit Event' : 'Add Event' }}</h3>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Event Name *</label>
        <input
          v-model="formData.name"
          type="text"
          placeholder="Welcome New Members"
          required
        />
      </div>

      <div class="form-group">
        <label>Discord Event Type *</label>
        <select v-model="formData.eventType" required>
          <option value="guildMemberAdd">Member Join</option>
          <option value="guildMemberRemove">Member Leave</option>
          <option value="messageCreate">Message Created</option>
          <option value="messageDelete">Message Deleted</option>
          <option value="messageUpdate">Message Edited</option>
          <option value="messageReactionAdd">Reaction Added</option>
          <option value="messageReactionRemove">Reaction Removed</option>
        </select>
      </div>

      <div class="form-group">
        <label>Action Type *</label>
        <select v-model="formData.actionType" required>
          <option value="sendMessage">Send Message</option>
          <option value="sendEmbed">Send Embed</option>
          <option value="assignRole">Assign Role</option>
        </select>
      </div>

      <!-- Send Message -->
      <div v-if="formData.actionType === 'sendMessage'" class="form-group">
        <label>Message *</label>
        <textarea
          v-model="formData.message"
          placeholder="Welcome {user} to the server! We now have {memberCount} members!"
          rows="3"
          required
        ></textarea>
        <small>Available placeholders: {user}, {memberCount}</small>
      </div>

      <!-- Send Embed -->
      <div v-if="formData.actionType === 'sendEmbed'" class="embed-config">
        <div class="form-group">
          <label>Embed Title</label>
          <input v-model="embedData.title" type="text" placeholder="Welcome!" />
        </div>
        <div class="form-group">
          <label>Embed Description</label>
          <textarea v-model="embedData.description" rows="3" placeholder="Welcome to the server!"></textarea>
        </div>
        <div class="form-group">
          <label>Embed Color (hex)</label>
          <input v-model="embedData.color" type="text" placeholder="#00ff00" />
        </div>
      </div>

      <!-- Channel Configuration -->
      <div v-if="['guildMemberAdd'].includes(formData.eventType)" class="form-group">
        <label>Welcome Channel ID</label>
        <input
          v-model="formData.welcomeChannelId"
          type="text"
          placeholder="123456789012345678"
        />
        <small>The channel where welcome messages will be sent</small>
      </div>

      <div v-if="['messageDelete', 'messageUpdate', 'guildMemberRemove'].includes(formData.eventType)" class="form-group">
        <label>Log Channel ID</label>
        <input
          v-model="formData.logChannelId"
          type="text"
          placeholder="123456789012345678"
        />
        <small>The channel where events will be logged</small>
      </div>

      <!-- Role Assignment -->
      <div v-if="formData.actionType === 'assignRole'" class="form-group">
        <label>Role ID *</label>
        <input
          v-model="formData.roleId"
          type="text"
          placeholder="123456789012345678"
          required
        />
        <small>The role to assign to users</small>
      </div>

      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Saving...' : 'Save Event' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  event: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['submit', 'cancel']);

const isEdit = !!props.event;

const formData = ref({
  name: props.event?.name || '',
  eventType: props.event?.eventType || 'guildMemberAdd',
  actionType: props.event?.action?.type || 'sendMessage',
  message: props.event?.action?.message || '',
  welcomeChannelId: props.event?.config?.welcomeChannelId || '',
  logChannelId: props.event?.config?.logChannelId || '',
  roleId: props.event?.action?.roleId || ''
});

const embedData = ref({
  title: props.event?.action?.embedData?.title || '',
  description: props.event?.action?.embedData?.description || '',
  color: props.event?.action?.embedData?.color || '#00ff00'
});

function handleSubmit() {
  const event = {
    name: formData.value.name,
    eventType: formData.value.eventType,
    action: {
      type: formData.value.actionType
    },
    config: {}
  };

  if (formData.value.actionType === 'sendMessage') {
    event.action.message = formData.value.message;
  } else if (formData.value.actionType === 'sendEmbed') {
    event.action.embedData = { ...embedData.value };
  } else if (formData.value.actionType === 'assignRole') {
    event.action.roleId = formData.value.roleId;
  }

  if (formData.value.welcomeChannelId) {
    event.config.welcomeChannelId = formData.value.welcomeChannelId;
  }

  if (formData.value.logChannelId) {
    event.config.logChannelId = formData.value.logChannelId;
  }

  emit('submit', event);
}
</script>

<style scoped>
.event-form {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.event-form h3 {
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

.form-group small {
  display: block;
  color: #72767d;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.embed-config {
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
