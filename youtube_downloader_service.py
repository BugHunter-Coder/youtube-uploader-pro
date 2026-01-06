#!/usr/bin/env python3
"""
HTTP Service for YouTube Video Downloader using yt-dlp
Run this as a separate service that the Supabase Edge Function can call
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import sys
import os
from flask import Response, stream_with_context
import urllib.request
import ssl
from urllib.parse import urlparse, parse_qs

app = Flask(__name__)
CORS(app)  # Enable CORS for Supabase Edge Function

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
        # Use python3 -m yt_dlp (most reliable)
        # Prefer progressive MP4 (no ffmpeg needed). These are usually itag 18 (360p) / 22 (720p).
        cmd = [
            'python3', '-m', 'yt_dlp',
            '--no-playlist',
            '--format', '18/22/best',
            '--get-url',
            '--no-warnings',
            video_url
        ]
        
        print(f"DEBUG: Running command: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            check=False
        )
        
        print(f"DEBUG: Return code: {result.returncode}")
        if result.stdout:
            print(f"DEBUG: stdout length: {len(result.stdout)}, first 200 chars: {result.stdout[:200]}")
        if result.stderr:
            print(f"DEBUG: stderr: {result.stderr[:200]}")
        
        if result.returncode == 0 and result.stdout.strip():
            download_url = result.stdout.strip().split('\n')[0]
            if download_url and (download_url.startswith('http://') or download_url.startswith('https://')):
                print(f"✅ Successfully got URL (length: {len(download_url)})")
                return download_url
            else:
                print(f"⚠️  URL validation failed: {download_url[:100] if download_url else 'None'}")
        else:
            print(f"⚠️  Command failed or no output. Return code: {result.returncode}")
            if result.stderr:
                print(f"   Stderr: {result.stderr[:300]}")
    
    except subprocess.TimeoutExpired:
        print("⚠️  yt-dlp command timed out", file=sys.stderr)
    except FileNotFoundError:
        print("⚠️  python3 not found", file=sys.stderr)
    except Exception as e:
        print(f"⚠️  Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    
    print("❌ Failed to get download URL", file=sys.stderr)
    return None


@app.route('/download-file', methods=['POST'])
def download_file():
    """
    Streams an MP4 file to the browser.
    This is used for previewing/downloading from the frontend without CORS issues.
    """
    try:
        data = request.get_json() or {}
        video_id = data.get('videoId') or data.get('video_id')
        video_url = data.get('url')

        if video_url and not video_id:
            video_id = extract_video_id(video_url)

        if not video_id:
            return jsonify({"error": "videoId or url parameter is required"}), 400

        mp4_url = get_download_url(video_id)
        if not mp4_url:
            return jsonify({"error": "Failed to get a direct MP4 URL"}), 500

        def generate():
            # Some local Python installs on macOS may not have system CA certs configured.
            # For local-dev reliability, we use an unverified SSL context when proxying.
            ctx = ssl._create_unverified_context()
            req = urllib.request.Request(
                mp4_url,
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(req, context=ctx) as r:
                while True:
                    chunk = r.read(1024 * 256)
                    if not chunk:
                        break
                    yield chunk

        headers = {
            "Content-Disposition": f'inline; filename="{video_id}.mp4"',
        }
        return Response(stream_with_context(generate()), mimetype="video/mp4", headers=headers)

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in download_file endpoint: {str(e)}", file=sys.stderr)
        print(error_trace, file=sys.stderr)
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/download', methods=['POST', 'GET'])
def download():
    """API endpoint to get download URL for a YouTube video"""
    try:
        if request.method == 'POST':
            data = request.get_json() or {}
            video_id = data.get('videoId') or data.get('video_id')
            video_url = data.get('url')
        else:
            video_id = request.args.get('videoId') or request.args.get('video_id')
            video_url = request.args.get('url')
        
        # Extract video ID from URL if provided
        if video_url and not video_id:
            video_id = extract_video_id(video_url)
        
        if not video_id:
            return jsonify({
                "error": "videoId or url parameter is required"
            }), 400
        
        print(f"DEBUG: Getting download URL for video_id: {video_id}")
        download_url = get_download_url(video_id)
        print(f"DEBUG: get_download_url returned: {download_url[:100] if download_url else 'None'}")
        
        if download_url:
            print(f"DEBUG: Returning success with downloadUrl")
            return jsonify({
                "downloadUrl": download_url,
                "status": "ready",
                "videoId": video_id
            })
        else:
            print(f"DEBUG: download_url is None, getting error details...")
            # Get more detailed error info
            error_msg = "Failed to get download URL"
            try:
                # Try one more time with verbose output to get error
                test_cmd = ['python3', '-m', 'yt_dlp', '--dump-json', f'https://www.youtube.com/watch?v={video_id}']
                test_result = subprocess.run(test_cmd, capture_output=True, text=True, timeout=10)
                if test_result.returncode != 0 and test_result.stderr:
                    error_details = test_result.stderr[:300]
                    if 'Private video' in error_details or 'private' in error_details.lower():
                        error_msg = "Video is private or restricted"
                    elif 'unavailable' in error_details.lower():
                        error_msg = "Video is unavailable"
                    else:
                        error_msg = f"yt-dlp error: {error_details}"
            except:
                pass
            
            return jsonify({
                "error": error_msg
            }), 500
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in download endpoint: {str(e)}")
        print(f"Traceback: {error_trace}")
        return jsonify({
            "error": f"Internal server error: {str(e)}",
            "traceback": error_trace
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "youtube-downloader"})

if __name__ == '__main__':
    # Run on port 8000 by default
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=False)

