<template>
  <div class="settings">
    <h2>Settings</h2>

    <div class="settings-card">
      <h3>Application Settings</h3>
      <p>
        This is a placeholder for application settings. Future features may include:
      </p>
      <ul>
        <li>User authentication</li>
        <li>Global bot defaults</li>
        <li>Webhook configurations</li>
        <li>API keys management</li>
        <li>Notification preferences</li>
      </ul>
    </div>

    <div class="settings-card">
      <h3>About</h3>
      <p>Discord Bot Builder v1.0.0</p>
      <p>Build and manage multiple Discord bots with an easy-to-use interface.</p>
      <p style="margin-top: 1rem; color: #72767d; font-size: 0.9rem;">
        Bot configurations are stored locally in the <code>data/bots/</code> directory as JSON files.
      </p>
    </div>
  </div>
</template>

<script setup>
// No specific logic needed for this simple settings page
</script>

<style scoped>
.settings {
  max-width: 800px;
  margin: 0 auto;
}

.settings h2 {
  color: #fff;
  margin-bottom: 2rem;
}

.settings-card {
  background: #2f3136;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.settings-card h3 {
  color: #fff;
  margin-bottom: 1rem;
}

.settings-card p {
  color: #b9bbbe;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.settings-card ul {
  color: #b9bbbe;
  margin-left: 1.5rem;
  line-height: 1.8;
}

.settings-card code {
  background: #202225;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  color: #00b0f4;
}
</style>
