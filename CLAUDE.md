# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DiscBot is a web-based Discord bot management platform that lets users create, configure, and run multiple Discord bots simultaneously through a browser UI. No database — all bot configurations are stored as JSON files in `data/bots/`.

## Development Commands

### Backend (Node.js/Express — `backend/`)
```bash
cd backend
npm install
npm run dev       # Start with nodemon (hot reload)
npm start         # Production start
```

### Frontend (Vue 3/Vite — `frontend/`)
```bash
cd frontend
npm install
npm run dev       # Vite dev server (proxies API to backend)
npm run build     # Build to frontend/dist/
npm run preview   # Preview production build
```

### Docker
```bash
docker compose up --build    # Build and run full stack
docker compose up -d         # Run detached
docker compose down
```

The Dockerfile is a multi-stage build: stage 1 builds the Vue frontend, stage 2 runs the backend and serves the built frontend as static files.

## Architecture

### Data Flow
```
Vue 3 Frontend (Pinia + Axios)
  ↓ HTTP REST (/api/*)
Express Backend → StorageManager → data/bots/{botId}.json
  ↓ BotManager
discord.js clients (one per bot)
  ↓ Socket.io (real-time)
Frontend Pinia store → UI updates
```

### Backend Structure (`backend/src/`)

- **`server.js`** — Express + Socket.io setup, serves frontend SPA in production, catches all routes for Vue Router
- **`bot/BotManager.js`** — Central orchestrator. Manages discord.js client lifecycle, uses `chokidar` to file-watch bot configs for hot reload, emits Socket.io events (logs, status, commands, events). Each bot gets its own `CommandHandler`, `EventHandler`, and `PlexScheduler`.
- **`bot/CommandHandler.js`** — Handles prefix and slash commands. Registers slash commands via Discord REST API. Dispatches to `ModerationHandler` or integration services based on `responseType`.
- **`bot/EventHandler.js`** — Attaches/detaches discord.js event listeners dynamically. Supports: `messageCreate`, `messageDelete`, `messageUpdate`, `guildMemberAdd`, `guildMemberRemove`, `messageReactionAdd`, `messageReactionRemove`.
- **`bot/moderation/ModerationHandler.js`** — Executes moderation actions (kick, ban, unban, timeout, purge, warn) with permission validation.
- **`bot/integrations/`** — Plex, Sonarr, Radarr integrations. `PlexScheduler.js` uses `node-cron` to periodically announce new Plex content to a Discord channel; tracks announced items in the bot's integration config to avoid duplicates.
- **`storage/StorageManager.js`** — All file I/O. Reads/writes `data/bots/{id}.json`, appends to `data/logs/{id}.log`. Generates UUIDs, manages timestamps.
- **`api/routes/bots.js`** — REST endpoints for bot/command/event/integration CRUD plus start/stop/restart/status/logs/channels actions.

### Bot Config Schema (`data/bots/{id}.json`)
```json
{
  "id": "uuid",
  "name": "string",
  "token": "string",
  "prefix": "string",
  "status": "online|offline",
  "settings": { "autoStart": true },
  "commands": [...],
  "events": [...],
  "integrations": [...]
}
```

Command `responseType` values: `text`, `embed`, `reaction`, `moderation`, `integration`.
Command `type` values: `prefix`, `slash`, `both`.

### Frontend Structure (`frontend/src/`)

- **`stores/botStore.js`** (Pinia) — Single store for all bot state. Handles Socket.io subscription to `bot-{botId}` rooms for real-time updates.
- **`services/api.js`** — Axios client (baseURL `/api`) with service objects: `botService`, `commandService`, `eventService`, `integrationService`.
- **`router/index.js`** — Routes: `/` (Dashboard), `/bot/new` (CreateBot), `/bot/:id` (BotDetails), `/status`, `/settings`.
- **`views/BotDetails.vue`** — Main configuration view where commands, events, and integrations are managed per-bot.
- **`components/IntegrationForm.vue`** — Handles Plex/Sonarr/Radarr integration configuration including scheduler settings.

### Real-time Updates (Socket.io)
The frontend subscribes to room `bot-{botId}`. BotManager emits:
- `bot-log` — Log lines
- `bot-status` — Online/offline status changes
- `bot-command` — Command executions
- `bot-event` — Discord event triggers

### Hot Reload
BotManager uses `chokidar` to watch `data/bots/`. When a config file changes externally, it calls `reloadBotConfig()` — reloading commands/events without a full bot restart (unless token changed). PlexScheduler has a write-flag guard to prevent triggering reload loops when it writes back `announcedIds`.

## Key Conventions

- **ES Modules throughout** — both backend and frontend use `"type": "module"`. Use `import`/`export`, not `require`.
- **No database** — never add a database dependency; all persistence goes through `StorageManager`.
- **Integration pattern** — new integrations go in `backend/src/bot/integrations/`, get registered in `CommandHandler` and `BotManager`, and have a config section under a bot's `integrations` array in JSON.
- **Slash commands** — must be registered via Discord REST API (done in `CommandHandler.registerSlashCommands()`). After adding new slash command types, the registration logic may need updating.
- **Environment** — `PORT` controls the server port (default 3000). Frontend Vite dev server proxies `/api` and `/socket.io` to the backend.
