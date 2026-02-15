# Discord Bot Builder

A comprehensive Docker-based application for creating, customizing, and managing multiple Discord bots with an easy-to-use web interface.

## Features

- **Multi-Bot Management**: Run multiple Discord bots simultaneously
- **Web Interface**: Modern Vue.js UI for easy configuration
- **Command System**: Support for both prefix commands and slash commands
- **Event Handlers**: Configure Discord event handlers (member join, message delete, etc.)
- **Moderation Tools**: Built-in moderation commands (kick, ban, timeout, purge)
- **Integrations**: Connect to Plex, Sonarr, and Radarr
- **Real-time Logs**: Live bot logs via Socket.io
- **File-Based Storage**: All configurations stored as JSON files (no database required)
- **Docker Ready**: Single container deployment with docker-compose

## Architecture

- **Frontend**: Vue.js 3 + Vite
- **Backend**: Node.js + Express
- **Bot Framework**: discord.js v14
- **Storage**: Local JSON files
- **Real-time**: Socket.io

## Prerequisites

- Docker and Docker Compose
- Discord Bot Token ([Get one here](https://discord.com/developers/applications))

## Quick Start

### Using Docker Compose (Recommended)

1. Clone or download this repository

2. Build and start the application:
   ```bash
   docker-compose up -d
   ```

3. Access the web interface at [http://localhost:3000](http://localhost:3000)

4. Create your first bot:
   - Click "Create New Bot"
   - Enter a name and your Discord bot token
   - Configure prefix and settings
   - Click "Create Bot"

5. Start your bot and invite it to your Discord server!

### Using Docker Directly

```bash
# Build the image
docker build -t discbot-builder .

# Run the container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name discbot-builder \
  discbot-builder
```

## Development Setup

### Backend Development

```bash
cd backend
npm install
npm run dev
```

The backend will run on [http://localhost:3000](http://localhost:3000)

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server will run on [http://localhost:5173](http://localhost:5173)

## Configuration

### Bot Configuration Files

Bot configurations are stored in `data/bots/` as JSON files. Each bot has its own file named `{bot-id}.json`.

Example bot configuration:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Bot",
  "token": "YOUR_BOT_TOKEN",
  "prefix": "!",
  "status": "offline",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "commands": [
    {
      "id": "cmd-1",
      "name": "hello",
      "type": "both",
      "responseType": "text",
      "responseContent": "Hello! 👋",
      "description": "Says hello"
    }
  ],
  "events": [
    {
      "id": "evt-1",
      "eventType": "guildMemberAdd",
      "name": "Welcome New Members",
      "action": {
        "type": "sendMessage",
        "message": "Welcome {user} to the server!"
      },
      "config": {
        "welcomeChannelId": "YOUR_CHANNEL_ID"
      }
    }
  ],
  "integrations": [
    {
      "id": "int-1",
      "service": "plex",
      "name": "My Plex Server",
      "config": {
        "apiUrl": "http://plex-server:32400",
        "apiKey": "YOUR_PLEX_TOKEN"
      }
    }
  ],
  "settings": {
    "autoStart": true
  }
}
```

### Adding Commands

Commands can be added via the API or by editing the bot's JSON file:

#### Prefix Command Example

```json
{
  "id": "unique-id",
  "name": "ping",
  "type": "prefix",
  "responseType": "text",
  "responseContent": "Pong! 🏓"
}
```

#### Slash Command Example

```json
{
  "id": "unique-id",
  "name": "info",
  "type": "slash",
  "responseType": "embed",
  "description": "Show server information",
  "embedData": {
    "title": "Server Info",
    "description": "Information about this server",
    "color": "#5865f2"
  }
}
```

#### Moderation Command Example

```json
{
  "id": "unique-id",
  "name": "kick",
  "type": "both",
  "responseType": "moderation",
  "moderationAction": "kick",
  "requiredPermissions": "KickMembers"
}
```

### Event Handlers

Configure event handlers to respond to Discord events:

```json
{
  "id": "unique-id",
  "eventType": "messageDelete",
  "name": "Log Deleted Messages",
  "action": {
    "type": "sendEmbed"
  },
  "config": {
    "logChannelId": "YOUR_LOG_CHANNEL_ID"
  }
}
```

Supported event types:
- `messageCreate`
- `messageDelete`
- `messageUpdate`
- `guildMemberAdd`
- `guildMemberRemove`
- `messageReactionAdd`
- `messageReactionRemove`

### Integrations

#### Plex Integration

```json
{
  "service": "plex",
  "name": "My Plex Server",
  "config": {
    "apiUrl": "http://your-plex-server:32400",
    "apiKey": "YOUR_PLEX_TOKEN"
  }
}
```

Commands:
- Search library
- Get now playing
- Get server stats

#### Sonarr Integration

```json
{
  "service": "sonarr",
  "name": "Sonarr",
  "config": {
    "apiUrl": "http://your-sonarr:8989",
    "apiKey": "YOUR_SONARR_API_KEY"
  }
}
```

#### Radarr Integration

```json
{
  "service": "radarr",
  "name": "Radarr",
  "config": {
    "apiUrl": "http://your-radarr:7878",
    "apiKey": "YOUR_RADARR_API_KEY"
  }
}
```

## API Endpoints

### Bot Management

- `GET /api/bots` - List all bots
- `POST /api/bots` - Create new bot
- `GET /api/bots/:id` - Get bot details
- `PUT /api/bots/:id` - Update bot
- `DELETE /api/bots/:id` - Delete bot
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/stop` - Stop bot
- `GET /api/bots/:id/status` - Get bot status
- `GET /api/bots/:id/logs` - Get bot logs

### Commands

- `GET /api/bots/:id/commands` - List commands
- `POST /api/bots/:id/commands` - Add command
- `PUT /api/bots/:id/commands/:cmdId` - Update command
- `DELETE /api/bots/:id/commands/:cmdId` - Delete command

### Events

- `GET /api/bots/:id/events` - List events
- `POST /api/bots/:id/events` - Add event
- `PUT /api/bots/:id/events/:eventId` - Update event
- `DELETE /api/bots/:id/events/:eventId` - Delete event

### Integrations

- `GET /api/bots/:id/integrations` - List integrations
- `POST /api/bots/:id/integrations` - Add integration
- `PUT /api/bots/:id/integrations/:intId` - Update integration
- `DELETE /api/bots/:id/integrations/:intId` - Delete integration

## Socket.io Events

Connect to Socket.io for real-time updates:

```javascript
const socket = io('http://localhost:3000');

// Subscribe to bot events
socket.emit('subscribe', 'bot-id');

// Listen for logs
socket.on('bot:log', (data) => {
  console.log(data.message);
});

// Listen for status changes
socket.on('bot:status', (data) => {
  console.log(`Bot ${data.botId} is now ${data.status}`);
});
```

## Troubleshooting

### Bot won't start

1. Check that your Discord bot token is correct
2. Ensure your bot has proper permissions in the Discord Developer Portal
3. Check logs: `docker logs discbot-builder`

### Can't access web interface

1. Ensure the container is running: `docker ps`
2. Check port mapping: port 3000 should be exposed
3. Try accessing [http://localhost:3000/api/health](http://localhost:3000/api/health)

### Bots not persisting

1. Ensure the volume is mounted correctly
2. Check that `data/bots/` directory exists
3. Verify file permissions

## Project Structure

```
DiscBot/
├── backend/              # Node.js backend
│   ├── src/
│   │   ├── api/         # Express API routes
│   │   ├── bot/         # Bot runtime and handlers
│   │   ├── storage/     # File-based storage
│   │   └── server.js    # Main server file
│   └── package.json
├── frontend/            # Vue.js frontend
│   ├── src/
│   │   ├── components/  # Vue components
│   │   ├── views/       # Page views
│   │   ├── stores/      # Pinia stores
│   │   ├── services/    # API services
│   │   └── router/      # Vue Router
│   └── package.json
├── data/                # Persistent data
│   ├── bots/           # Bot configurations
│   └── logs/           # Bot logs
├── Dockerfile          # Multi-stage Docker build
├── docker-compose.yml  # Docker Compose config
└── README.md
```

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## License

MIT License

## Support

For issues and questions, please open an issue on the repository.

---

Built with ❤️ using Vue.js, Express, and discord.js
