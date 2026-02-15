<template>
  <div class="app">
    <nav class="navbar">
      <div class="navbar-brand">
        <h1>🤖 Discord Bot Builder</h1>
      </div>
      <div class="navbar-links">
        <router-link to="/">Dashboard</router-link>
        <router-link to="/status">Status</router-link>
        <router-link to="/settings">Settings</router-link>
      </div>
    </nav>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
// No specific logic needed yet
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: #202225;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.navbar-brand h1 {
  color: #5865f2;
  font-size: 1.5rem;
  font-weight: bold;
}

.navbar-links {
  display: flex;
  gap: 1.5rem;
}

.navbar-links a {
  color: #b9bbbe;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.navbar-links a:hover,
.navbar-links a.router-link-active {
  color: #fff;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}
</style>
