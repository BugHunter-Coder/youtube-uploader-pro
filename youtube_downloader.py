#!/usr/bin/env python3
"""
YouTube Video Downloader using yt-dlp
This service can be called via HTTP API or used as a standalone service
"""

import json
import sys
import os
from urllib.parse import urlparse, parse_qs
import subprocess
import tempfile
import shutil

def extract_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    if 'youtu.be' in url:
        return url.split('/')[-1].split('?')[0]
    elif 'youtube.com/watch' in url:
        parsed = urlparse(url)
        return parse_qs(parsed.query).get('v', [None])[0]
    elif 'youtube.com/shorts' in url:
        return url.split('/shorts/')[-1].split('?')[0]
    return None

def get_download_url(video_id):
    """
    Get direct download URL for a YouTube video using yt-dlp
    Returns the best quality video URL
    """
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
    try:
        # Use yt-dlp to get video info and extract URL
        # Format: best video+audio or best video only
        cmd = [
            'yt-dlp',
            '--no-playlist',
            '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            '--get-url',
            '--no-warnings',
            video_url
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            check=False
        )
        
        if result.returncode == 0 and result.stdout.strip():
            # yt-dlp may return multiple URLs (video + audio), get the first one
            urls = result.stdout.strip().split('\n')
            return urls[0] if urls else None
        
        # If that fails, try getting just the best single file
        cmd_simple = [
            'yt-dlp',
            '--no-playlist',
            '--format', 'best',
            '--get-url',
            '--no-warnings',
            video_url
        ]
        
        result_simple = subprocess.run(
            cmd_simple,
            capture_output=True,
            text=True,
            timeout=30,
            check=False
        )
        
        if result_simple.returncode == 0 and result_simple.stdout.strip():
            return result_simple.stdout.strip().split('\n')[0]
        
        return None
        
    except subprocess.TimeoutExpired:
        print("yt-dlp command timed out", file=sys.stderr)
        return None
    except FileNotFoundError:
        print("yt-dlp not found. Install with: pip install yt-dlp", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error getting download URL: {e}", file=sys.stderr)
        return None

def main():
    """Main function - can be used as CLI or HTTP service"""
    if len(sys.argv) > 1:
        # CLI mode
        video_id_or_url = sys.argv[1]
        
        # Extract video ID if URL provided
        if 'youtube.com' in video_id_or_url or 'youtu.be' in video_id_or_url:
            video_id = extract_video_id(video_id_or_url)
        else:
            video_id = video_id_or_url
        
        if not video_id:
            print(json.dumps({"error": "Invalid YouTube URL or video ID"}), file=sys.stderr)
            sys.exit(1)
        
        download_url = get_download_url(video_id)
        
        if download_url:
            print(json.dumps({"downloadUrl": download_url, "status": "ready"}))
            sys.exit(0)
        else:
            print(json.dumps({"error": "Failed to get download URL"}), file=sys.stderr)
            sys.exit(1)
    else:
        # HTTP service mode (if run as server)
        print(json.dumps({"error": "Please provide video ID or URL as argument"}))
        sys.exit(1)

if __name__ == "__main__":
    main()

