# Troubleshooting "Unable to process this video" Error

If you're getting the error "Unable to process this video. The video may be restricted, private, or unavailable for download.", here's how to fix it:

## Quick Fixes

### 1. **Use the Python Service (Most Reliable)**

The Python yt-dlp service is the most reliable way to download videos. Set it up:

**Option A: Local Development**
```bash
# Start Python service
npm run python:service

# In another terminal, expose it with ngrok
ngrok http 8000

# Set in Supabase Edge Function settings:
# PYTHON_DOWNLOADER_URL = https://your-ngrok-url.ngrok.io
```

**Option B: Deploy Python Service**
- Deploy `youtube_downloader_service.py` to Railway, Render, or Fly.io
- Set `PYTHON_DOWNLOADER_URL` in Supabase to your deployed service URL

### 2. **Check Video Accessibility**

The error might be accurate if:
- Video is **private** - Make it public or unlisted
- Video is **age-restricted** - Some downloaders can't handle this
- Video is **region-locked** - May not be accessible from your server location
- Video has **download restrictions** - Some creators disable downloads

### 3. **Use Local File Upload Instead**

If downloading isn't working:
1. Download the video manually using a desktop tool
2. Use the **Local File** tab in the app
3. Upload the file directly

### 4. **Check Supabase Edge Function Logs**

1. Go to Supabase Dashboard → Edge Functions → `youtube-download` → Logs
2. Look for error messages showing which services failed
3. The logs will show:
   - Which services were tried
   - Why each service failed
   - If it's a restriction issue or a service issue

## Common Issues

### "Python service not configured"
- **Fix**: Set `PYTHON_DOWNLOADER_URL` environment variable in Supabase Edge Function settings
- **Local**: Use ngrok to expose localhost:8000
- **Production**: Deploy Python service to a cloud provider

### "All downloader services failed"
- **Possible causes**:
  - All web services are blocked/rate-limited
  - Video is actually restricted
  - Network issues from Supabase servers
  
- **Solutions**:
  1. Configure Python service (most reliable)
  2. Try a different video to test if it's video-specific
  3. Wait a few minutes and retry (rate limiting)

### "Connection refused" (Python service)
- **Fix**: Make sure Python service is running: `npm run python:service`
- **Check**: `curl http://localhost:8000/health` should return `{"status":"ok"}`

## Testing

Test your setup:
```bash
# Test Python service locally
curl -X POST http://localhost:8000/download \
  -H "Content-Type: application/json" \
  -d '{"videoId": "DJ3MytT2Ro4"}'

# Should return: {"downloadUrl": "...", "status": "ready"}
```

## Best Practice

For production, always configure the Python yt-dlp service:
1. Most reliable (handles restrictions better)
2. Actively maintained
3. Works with most video types
4. Better error messages

See `README_PYTHON.md` for detailed setup instructions.

