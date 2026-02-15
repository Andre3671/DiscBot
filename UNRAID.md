# Unraid Installation Guide

This guide will help you deploy Discord Bot Builder on Unraid.

## 🐳 Method 1: Using Docker Compose (Recommended)

### Step 1: Prepare the Files

1. Copy this entire `DiscBot` folder to your Unraid server (e.g., `/mnt/user/appdata/discbot/`)

2. SSH into your Unraid server and navigate to the folder:
   ```bash
   cd /mnt/user/appdata/discbot
   ```

3. Edit the `.env` file to set your desired port:
   ```bash
   nano .env
   ```

   Change `HOST_PORT` to your desired port:
   ```env
   PORT=3000
   HOST_PORT=8080  # Change this to any available port
   ```

### Step 2: Build and Run

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Step 3: Access the UI

Open your browser and go to:
```
http://YOUR-UNRAID-IP:8080
```

---

## 🎯 Method 2: Using Unraid Docker Template (Easy Setup)

### Step 1: Install the Template

**The included `unraid-template.xml` automatically configures everything for you!**

1. Copy `unraid-template.xml` to your Unraid server:
   ```bash
   cp unraid-template.xml /boot/config/plugins/dockerMan/templates-user/my-DiscBot.xml
   ```

2. Go to **Docker** tab in Unraid

3. Click **"Add Container"** → Select **"DiscBot"** from the template dropdown

4. The template automatically sets:
   - ✅ Network Type: **Bridge** (prevents port conflicts)
   - ✅ Port Mapping: Container `3000` → Host `9090` (customizable)
   - ✅ Volume: `/app/data/bots` → `/mnt/user/appdata/discbot/data/bots`
   - ✅ Volume: `/app/data/logs` → `/mnt/user/appdata/discbot/data/logs`
   - ✅ Environment variables (PORT, NODE_ENV, CORS_ORIGIN)

5. Click **"Show more settings..."** if you want to change the host port from 9090

6. Click **Apply** to start the container

**That's it!** No manual configuration needed.

---

### Alternative: Manual Setup (Without Template)

If you prefer to set it up manually:

**Container Settings:**

| Setting | Value |
|---------|-------|
| **Name** | `DiscBot` |
| **Repository** | `andreroygaard/discbot:latest` |
| **Network Type** | `Bridge` ⚠️ **IMPORTANT: Use Bridge, NOT Host** |
| **WebUI** | `http://[IP]:[PORT:9090]` |

**Port Mappings:**
Click "Show docker allocations..." to add:

| Container Port | Host Port | Type |
|---------------|-----------|------|
| `3000` | `9090` | TCP |

*Change host port `9090` to any available port*

**Path Mappings:**
Click "Show docker allocations..." to add:

| Container Path | Host Path | Type |
|---------------|-----------|------|
| `/app/data/bots` | `/mnt/user/appdata/discbot/data/bots` | RW |
| `/app/data/logs` | `/mnt/user/appdata/discbot/data/logs` | RW |

**Environment Variables:**

| Variable | Value |
|----------|-------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |

---

## 🔨 Building the Docker Image on Unraid

Before you can run the container, you need to build the Docker image:

1. SSH into your Unraid server

2. Navigate to the app directory:
   ```bash
   cd /mnt/user/appdata/discbot
   ```

3. Build the Docker image:
   ```bash
   docker build -t discbot-builder .
   ```

4. Wait for the build to complete (this may take a few minutes)

5. Verify the image was created:
   ```bash
   docker images | grep discbot
   ```

---

## 🎨 Accessing the Web UI

Once the container is running:

1. Find your Unraid server IP (e.g., `192.168.1.100`)
2. Open browser: `http://192.168.1.100:8080` (use your configured port)
3. You should see the Discord Bot Builder interface

---

## 📋 Managing Your Bots

### View Logs
```bash
docker logs -f discbot-builder
```

### Restart Container
```bash
docker restart discbot-builder
```

### Stop Container
```bash
docker stop discbot-builder
```

### Update Container
```bash
cd /mnt/user/appdata/discbot
docker-compose down
docker-compose pull
docker-compose up -d
```

---

## 🔧 Configuration

### Change Port

Edit `.env` file:
```env
HOST_PORT=9090  # Change to your desired port
```

Then restart:
```bash
docker-compose down && docker-compose up -d
```

### Backup Bot Configurations

Your bot configs are stored in:
```
/mnt/user/appdata/discbot/data/bots/
```

Simply copy this folder to backup all your bots!

---

## 🆘 Troubleshooting

### UI Not Loading

1. Check container is running:
   ```bash
   docker ps | grep discbot
   ```

2. Check logs for errors:
   ```bash
   docker logs discbot-builder
   ```

3. Verify frontend was built:
   ```bash
   ls -la /mnt/user/appdata/discbot/frontend/dist
   ```

### Port Already in Use Error (EADDRINUSE)

If you see "address already in use" error:

**Cause:** You're using **Host** network mode instead of **Bridge** mode.

**Solution:**
1. Edit the container in Unraid
2. Change **Network Type** from `Host` to `Bridge`
3. Make sure port mappings are configured (Container 3000 → Host 9090)
4. Click **Apply**

OR if using docker-compose, change `HOST_PORT` in `.env`:
```env
HOST_PORT=9091  # Try a different port
```

### Can't Connect to Discord

Make sure you:
1. Used the **Bot Token** (not Public Key)
2. Enabled **Privileged Gateway Intents** in Discord Developer Portal
3. Bot has proper permissions

---

## 📊 Resource Usage

Typical resource usage:
- **CPU**: ~5-10% when idle, 15-30% during bot operation
- **RAM**: ~200-300 MB
- **Disk**: ~500 MB for the image + bot data

---

## 🔄 Auto-Start on Boot

With `restart: unless-stopped` in docker-compose.yml, the container will automatically start when Unraid boots.

---

## 📝 Notes

- All bot configurations are stored as JSON files in `/app/data/bots/`
- Logs are written to `/app/data/logs/`
- The container runs on Node.js with Express and Vue.js
- Multiple bots can run simultaneously from a single container

---

## 🎉 Success!

You should now have Discord Bot Builder running on your Unraid server!

Visit the web UI and start creating your Discord bots! 🤖
