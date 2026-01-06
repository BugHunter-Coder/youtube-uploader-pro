# Quick Start Guide

## First Time Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   npm run python:install
   ```
   Or manually:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start everything:**
   ```bash
   npm run dev:full
   ```

This will start:
- Frontend dev server at `http://localhost:5173` (or similar)
- Python downloader service at `http://localhost:8000`

## Using with Supabase Edge Function

To use the local Python service with your Supabase Edge Function:

1. **Set environment variable in Supabase:**
   - Go to: Supabase Dashboard → Edge Functions → `youtube-download` → Settings
   - Add: `PYTHON_DOWNLOADER_URL` = `http://localhost:8000`
   
   **Note:** For production, you'll need to deploy the Python service to a public URL (Railway, Render, etc.)

2. **Or use ngrok for local testing:**
   ```bash
   # Install ngrok: https://ngrok.com/download
   ngrok http 8000
   # Use the ngrok URL in Supabase: https://xxxx.ngrok.io
   ```

## Troubleshooting

**Python not found:**
- Install Python 3.7+ from https://www.python.org/downloads/
- Make sure `python3` or `python` is in your PATH

**Python dependencies fail to install:**
- Try: `pip3 install -r requirements.txt` (or `pip install -r requirements.txt`)
- On macOS: `python3 -m pip install -r requirements.txt`

**Port 8000 already in use:**
- Change the port in `youtube_downloader_service.py`:
  ```python
   port = int(os.environ.get('PORT', 8001))  # Change to 8001
   ```

**Service won't start:**
- Check Python version: `python3 --version` (should be 3.7+)
- Check if yt-dlp is installed: `python3 -c "import yt_dlp"`
- Check service logs in the terminal

