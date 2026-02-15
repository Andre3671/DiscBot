<template>
  <div class="create-bot">
    <h2>Create New Discord Bot</h2>

    <!-- Token Help Modal -->
    <div v-if="showTokenHelp" class="modal-overlay" @click="showTokenHelp = false">
      <div @click.stop>
        <TokenHelp @close="showTokenHelp = false" />
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="bot-form">
      <div class="form-group">
        <label for="name">Bot Name *</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          placeholder="My Awesome Bot"
          required
        />
      </div>

      <div class="form-group">
        <label for="token">
          Discord Bot Token *
          <button type="button" @click="showTokenHelp = true" class="help-btn">
            ❓ Help
          </button>
        </label>
        <input
          id="token"
          v-model="formData.token"
          type="password"
          placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.AbCdEf.GhIjKlMnOpQrStUvWxYz..."
          required
        />
        <small class="warning-text">
          ⚠️ Use the <strong>Bot Token</strong>, NOT the Public Key!
          <a href="https://discord.com/developers/applications" target="_blank">
            Get it here
          </a>
        </small>
      </div>

      <div class="form-group">
        <label for="prefix">Command Prefix</label>
        <input
          id="prefix"
          v-model="formData.prefix"
          type="text"
          placeholder="!"
          maxlength="3"
        />
        <small>The prefix for message commands (e.g., ! or $)</small>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="formData.autoStart" />
          Auto-start bot when server starts
        </label>
      </div>

      <div class="form-actions">
        <router-link to="/" class="btn btn-secondary">Cancel</router-link>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Creating...' : 'Create Bot' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useBotStore } from '../stores/botStore';
import TokenHelp from '../components/TokenHelp.vue';

const router = useRouter();
const botStore = useBotStore();

const loading = ref(false);
const showTokenHelp = ref(false);
const formData = ref({
  name: '',
  token: '',
  prefix: '!',
  autoStart: false
});

async function handleSubmit() {
  loading.value = true;

  try {
    const newBot = await botStore.createBot({
      name: formData.value.name,
      token: formData.value.token,
      prefix: formData.value.prefix,
      settings: {
        autoStart: formData.value.autoStart
      }
    });

    alert('Bot created successfully!');
    router.push(`/bot/${newBot.id}`);
  } catch (error) {
    alert('Failed to create bot: ' + error.message);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.create-bot {
  max-width: 600px;
  margin: 0 auto;
}

.create-bot h2 {
  color: #fff;
  margin-bottom: 2rem;
}

.bot-form {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
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

.form-group input[type="text"],
.form-group input[type="password"] {
  width: 100%;
  padding: 0.75rem;
  background: #40444b;
  border: 1px solid #202225;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
}

.form-group input[type="text"]:focus,
.form-group input[type="password"]:focus {
  outline: none;
  border-color: #5865f2;
}

.form-group input[type="checkbox"] {
  margin-right: 0.5rem;
}

.form-group small {
  display: block;
  color: #72767d;
  margin-top: 0.5rem;
  font-size: 0.85rem;
}

.form-group small a {
  color: #00b0f4;
  text-decoration: none;
}

.form-group small a:hover {
  text-decoration: underline;
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
  text-decoration: none;
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

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.help-btn {
  background: #5865f2;
  color: #fff;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  margin-left: 0.5rem;
  font-weight: 600;
}

.help-btn:hover {
  background: #4752c4;
}

.warning-text {
  background: #faa81a;
  color: #000;
  padding: 0.5rem;
  border-radius: 4px;
  display: block !important;
  margin-top: 0.5rem !important;
}

.warning-text strong {
  font-weight: 700;
}

.warning-text a {
  color: #000 !important;
  text-decoration: underline;
  font-weight: 600;
}
</style>
