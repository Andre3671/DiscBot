<template>
  <div class="token-help">
    <div class="help-header">
      <h4>🔑 How to Get Your Discord Bot Token</h4>
      <button @click="$emit('close')" class="close-btn">✕</button>
    </div>

    <div class="help-content">
      <div class="step">
        <span class="step-number">1</span>
        <div class="step-content">
          <h5>Go to Discord Developer Portal</h5>
          <a href="https://discord.com/developers/applications" target="_blank" class="link">
            https://discord.com/developers/applications
          </a>
        </div>
      </div>

      <div class="step">
        <span class="step-number">2</span>
        <div class="step-content">
          <h5>Select or Create Your Application</h5>
          <p>If you don't have one yet, click "New Application"</p>
        </div>
      </div>

      <div class="step">
        <span class="step-number">3</span>
        <div class="step-content">
          <h5>Go to the "Bot" Section</h5>
          <p>Click on "Bot" in the left sidebar</p>
        </div>
      </div>

      <div class="step">
        <span class="step-number">4</span>
        <div class="step-content">
          <h5>Reset & Copy Your Token</h5>
          <p>Click "Reset Token" button, then copy the token that appears</p>
          <div class="warning">
            ⚠️ <strong>Important:</strong> Use the BOT TOKEN, not the Public Key!
          </div>
        </div>
      </div>

      <div class="step critical">
        <span class="step-number">5</span>
        <div class="step-content">
          <h5>⚠️ Enable Required Intents (CRITICAL!)</h5>
          <p>Scroll down and enable these under "Privileged Gateway Intents":</p>
          <ul>
            <li>✅ <strong>Presence Intent</strong></li>
            <li>✅ <strong>Server Members Intent</strong></li>
            <li>✅ <strong>Message Content Intent</strong></li>
          </ul>
          <div class="warning">
            Without these enabled, your bot will fail to start with "disallowed intents" error!
          </div>
          <p style="margin-top: 0.5rem;">Then click <strong>"Save Changes"</strong> at the bottom of the page.</p>
        </div>
      </div>

      <div class="step">
        <span class="step-number">6</span>
        <div class="step-content">
          <h5>Paste Token Here</h5>
          <p>The token looks like: <code>YOUR-BOT-TOKEN-GOES-HERE</code></p>
        </div>
      </div>

      <div class="comparison">
        <div class="correct">
          <h5>✅ Bot Token (CORRECT)</h5>
          <code>YOUR-BOT-TOKEN.GOES.HERE...</code>
          <p>Long string with dots, starts with letters/numbers</p>
        </div>
        <div class="incorrect">
          <h5>❌ Public Key (WRONG)</h5>
          <code>ed25519:1234567890abcdef...</code>
          <p>Shorter, often starts with "ed25519"</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['close']);
</script>

<style scoped>
.token-help {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #2f3136;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
  max-width: 700px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  z-index: 1000;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #40444b;
  position: sticky;
  top: 0;
  background: #2f3136;
}

.help-header h4 {
  color: #fff;
  margin: 0;
}

.close-btn {
  background: #40444b;
  color: #fff;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #ed4245;
}

.help-content {
  padding: 1.5rem;
}

.step {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #40444b;
}

.step:last-child {
  border-bottom: none;
}

.step.critical {
  background: #3d1f1f;
  border: 2px solid #ed4245;
  border-radius: 8px;
  padding: 1rem;
}

.step.critical .step-number {
  background: #ed4245;
}

.step.critical h5 {
  color: #ed4245;
}

.step.critical ul li {
  margin: 0.5rem 0;
}

.step.critical ul li strong {
  color: #fff;
}

.step-number {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  background: #5865f2;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.step-content {
  flex: 1;
}

.step-content h5 {
  color: #fff;
  margin: 0 0 0.5rem 0;
}

.step-content p {
  color: #b9bbbe;
  margin: 0.5rem 0;
  line-height: 1.5;
}

.step-content ul {
  color: #b9bbbe;
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.step-content li {
  margin: 0.25rem 0;
}

.link {
  color: #00b0f4;
  text-decoration: none;
  word-break: break-all;
}

.link:hover {
  text-decoration: underline;
}

code {
  background: #202225;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  color: #00b0f4;
  font-size: 0.9rem;
}

.warning {
  background: #faa81a;
  color: #000;
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1.5rem;
}

.correct,
.incorrect {
  padding: 1rem;
  border-radius: 4px;
  border: 2px solid;
}

.correct {
  background: #0e3d2e;
  border-color: #3ba55d;
}

.incorrect {
  background: #3d1419;
  border-color: #ed4245;
}

.correct h5,
.incorrect h5 {
  margin: 0 0 0.5rem 0;
}

.correct h5 {
  color: #3ba55d;
}

.incorrect h5 {
  color: #ed4245;
}

.correct code,
.incorrect code {
  display: block;
  margin: 0.5rem 0;
  word-break: break-all;
}

.correct p,
.incorrect p {
  font-size: 0.85rem;
  margin: 0.5rem 0 0 0;
}
</style>
