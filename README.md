# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

**Requirements:**
- Node.js & `npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Python 3.7+ - [download from python.org](https://www.python.org/downloads/)

**Setup and Run:**

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install all dependencies (Node.js and Python)
npm run setup
# This installs Node.js dependencies AND Python dependencies automatically

# Step 4: Start both frontend and Python service together
npm run dev:full

# OR start them separately:
# Frontend only:
npm run dev

# Python service only:
npm run python:service

# Step 5: (Optional) Configure Python service URL for local development
# Create a .env file in project root with:
# VITE_PYTHON_DOWNLOADER_URL=http://localhost:8000
# 
# The app will automatically try Python service first, then fall back to Edge Function
```

**Available Scripts:**
- `npm run dev` - Start frontend development server only
- `npm run dev:full` - Start both frontend AND Python service together (recommended)
- `npm run python:service` - Start Python YouTube downloader service only
- `npm run python:install` - Install Python dependencies only
- `npm run setup` - Install all dependencies (Node.js + Python)

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Supabase Edge Functions (YouTube download)

The `youtube-download` edge function:
1. Gets a download URL from multiple alternative downloader services (tries each in sequence)
2. **Downloads the video file** from that URL
3. **Stores it in Supabase Storage** (bucket: `downloads` by default)
4. Returns a signed/public URL to the stored video file

**Downloader Services (tried in order):**

🔴 **REQUIRED: Python yt-dlp Service** - PRIMARY method, most reliable
- **Setup**: See `SETUP_PYTHON.md` for quick setup guide
- **Why required**: Handles all video types (Shorts, age-restricted, region-locked)
- **Configuration**: Set `PYTHON_DOWNLOADER_URL` in Supabase Edge Function settings

**Fallback Services** (only used if Python fails):
2. **VidsSave** - Web service (less reliable)
3. **Y2Mate** - Alternative downloader
4. **SaveFrom** - API-based downloader
5. **Loader.to** - Another alternative service
6. **YTDownloader** - Additional fallback
7. **YTMP3** - Video download service
8. **Cobalt** - Last resort (requires configuration)

**⚠️ Important**: Without Python service configured, downloads will likely fail. See `SETUP_PYTHON.md` for setup instructions.

**Required Configuration:**

- **Storage bucket**: Create a bucket named `downloads` (or set `DOWNLOAD_BUCKET` env var)
- **Environment variables** (in Supabase Edge Function settings):
  - `SUPABASE_URL`: Your Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for Storage access)
  - `DOWNLOAD_BUCKET` (optional): Storage bucket name (default: `downloads`)
  - `PYTHON_DOWNLOADER_URL` (optional): URL to Python yt-dlp service (recommended for best reliability)
  - `COBALT_URLS` (optional): Comma-separated Cobalt instance URLs
  - `COBALT_AUTH_JWT` (optional): Bearer token if Cobalt requires auth

**Important**: The function uses a Cobalt-compatible backend. Public Cobalt instances are frequently blocked/rate-limited, may require auth, or may change behavior. For reliable operation you should provide your own instance and configure `COBALT_URLS`.

If Cobalt instances fail, the UI will show an error like:
`Unable to get a download URL...` with the last provider failure reason.

## Direct File URL mode

The **Direct File URL** tab expects a **direct downloadable video file URL**, not a YouTube page URL.

- Supported file extensions: `.mp4`, `.mov`, `.webm`, `.mkv`, `.m4v`
- URL must be reachable by the Supabase Edge Function (server-to-server fetch)
- For best reliability, your host should send a `Content-Length` header (enables streaming uploads)

Examples of URLs that work:
- A signed S3 URL to an `.mp4`
- A CDN URL ending in `.mp4`

Examples that do NOT work:
- `youtube.com/...` / `youtu.be/...` links (these are not direct media files)

## Local file upload mode (recommended)

If you want to avoid downloading from YouTube entirely, use **Local File** mode in the UI:

1. Select a video file from your computer
2. The app uploads it to **Supabase Storage**
3. The backend uploads it to your YouTube channel via OAuth

Required config:

- **Storage bucket**: create a bucket (default name: `uploads`)
- **`VITE_UPLOAD_BUCKET`** (optional): override the bucket name used by the frontend

Note: If your bucket is private, the app will try to use a signed URL. Your Storage policies must allow uploads and signed URL creation for your anon client.
