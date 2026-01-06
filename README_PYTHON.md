# Python YouTube Downloader Service

This project includes a Python-based YouTube downloader using `yt-dlp`, which is the most reliable method for downloading YouTube videos.

## Setup

### Option 1: Run as a Local Service

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the service:**
   ```bash
   python youtube_downloader_service.py
   ```
   
   The service will run on `http://localhost:8000` by default.

3. **Set the environment variable in Supabase Edge Function:**
   - Go to your Supabase project → Edge Functions → `youtube-download` → Settings
   - Add environment variable: `PYTHON_DOWNLOADER_URL` = `http://your-server:8000`
   - Or if running locally with ngrok: `https://your-ngrok-url.ngrok.io`

### Option 2: Deploy to a Cloud Service

#### Deploy to Railway/Render/Fly.io:

1. **Create a new service** and upload the Python files:
   - `youtube_downloader_service.py`
   - `requirements.txt`

2. **Set environment variables:**
   - `PORT` (optional, defaults to 8000)

3. **Get the service URL** and set it in Supabase Edge Function:
   - `PYTHON_DOWNLOADER_URL` = `https://your-service-url.com`

#### Deploy to Heroku:

1. **Create a Procfile:**
   ```
   web: python youtube_downloader_service.py
   ```

2. **Deploy:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   heroku create your-app-name
   git push heroku main
   ```

3. **Set environment variable in Supabase:**
   - `PYTHON_DOWNLOADER_URL` = `https://your-app-name.herokuapp.com`

## Usage

### As a Standalone Script

```bash
python youtube_downloader.py "DJ3MytT2Ro4"
# or
python youtube_downloader.py "https://youtube.com/shorts/DJ3MytT2Ro4"
```

### As an HTTP Service

The service provides a REST API:

**POST /download**
```json
{
  "videoId": "DJ3MytT2Ro4"
}
```

**Response:**
```json
{
  "downloadUrl": "https://...",
  "status": "ready",
  "videoId": "DJ3MytT2Ro4"
}
```

**GET /download?videoId=DJ3MytT2Ro4**

**GET /health** - Health check endpoint

## Integration with Supabase Edge Function

Once the Python service is deployed and the `PYTHON_DOWNLOADER_URL` environment variable is set, the Edge Function will automatically try the Python service first before falling back to other downloader services.

## Advantages of Python/yt-dlp

- **Most reliable**: yt-dlp is the most actively maintained YouTube downloader
- **Handles restrictions**: Better at handling age-restricted, region-locked, and private videos
- **Multiple formats**: Supports various video and audio formats
- **Regular updates**: Automatically adapts to YouTube changes

## Troubleshooting

1. **"yt-dlp not found"**: Install with `pip install yt-dlp`
2. **Service not responding**: Check that the service is running and accessible
3. **Timeout errors**: Increase timeout in Edge Function or service configuration
4. **CORS errors**: The Flask service includes CORS, but ensure your deployment allows it

