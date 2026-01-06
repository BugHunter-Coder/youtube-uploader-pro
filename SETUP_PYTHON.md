# Setup Python Downloader (REQUIRED)

The Python yt-dlp service is the **PRIMARY and REQUIRED** method for downloading YouTube videos. It's the most reliable way to handle all video types, including Shorts, age-restricted videos, and region-locked content.

## Quick Setup (5 minutes)

### Step 1: Start Python Service Locally

```bash
# In your project directory
npm run python:service
```

The service will start on `http://localhost:8000`

### Step 2: Expose with ngrok (for Supabase to access)

**Install ngrok:**
- Download from: https://ngrok.com/download
- Or: `brew install ngrok` (macOS)

**Run ngrok:**
```bash
ngrok http 8000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:8000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

### Step 3: Configure in Supabase

1. Go to **Supabase Dashboard**
2. Navigate to: **Edge Functions** → **youtube-download** → **Settings**
3. Click **Add new secret**
4. Add:
   - **Name**: `PYTHON_DOWNLOADER_URL`
   - **Value**: `https://your-ngrok-url.ngrok.io` (from Step 2)
5. Click **Save**

### Step 4: Test

Try downloading a video again. The system will now use Python yt-dlp as the primary method.

## Production Setup

For production, deploy the Python service instead of using ngrok:

### Option 1: Railway (Recommended)

1. Go to https://railway.app
2. Create new project
3. Add service → **Deploy from GitHub repo**
4. Select your repo
5. Railway will auto-detect Python
6. Add environment variable: `PORT=8000`
7. Deploy
8. Copy the Railway URL
9. Set `PYTHON_DOWNLOADER_URL` in Supabase to the Railway URL

### Option 2: Render

1. Go to https://render.com
2. Create new **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python youtube_downloader_service.py`
   - **Environment**: Python 3
5. Add environment variable: `PORT=8000`
6. Deploy
7. Copy the Render URL
8. Set `PYTHON_DOWNLOADER_URL` in Supabase

### Option 3: Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set port
fly secrets set PORT=8000

# Deploy
fly deploy
```

## Verify It's Working

Test the Python service:

```bash
# Test locally
curl -X POST http://localhost:8000/download \
  -H "Content-Type: application/json" \
  -d '{"videoId": "DJ3MytT2Ro4"}'

# Should return:
# {"downloadUrl": "https://...", "status": "ready", "videoId": "DJ3MytT2Ro4"}
```

## Why Python is Required

- ✅ **Most reliable**: yt-dlp is actively maintained and adapts to YouTube changes
- ✅ **Handles restrictions**: Better at downloading age-restricted, region-locked videos
- ✅ **Supports all formats**: Works with Shorts, regular videos, live streams
- ✅ **Better error messages**: Clear feedback when videos can't be downloaded
- ✅ **No rate limits**: Unlike public web services

## Troubleshooting

**"Python service not configured"**
- Make sure `PYTHON_DOWNLOADER_URL` is set in Supabase Edge Function settings
- Check that ngrok is running and the URL is correct

**"Connection refused"**
- Make sure Python service is running: `npm run python:service`
- Check ngrok is forwarding correctly: `curl http://localhost:8000/health`

**"Service timeout"**
- Python service might be slow. Increase timeout in Edge Function if needed
- Check Python service logs for errors

## Keep ngrok Running

For local development, you need to keep both running:
- Terminal 1: `npm run python:service` (Python service)
- Terminal 2: `ngrok http 8000` (ngrok tunnel)

Or use `npm run dev:full` to start Python service, then run ngrok separately.

