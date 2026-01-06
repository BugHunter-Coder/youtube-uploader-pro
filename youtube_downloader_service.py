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
import tempfile
import json
import requests

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
        # Use the same Python interpreter as this Flask process (works with local .venv)
        # Prefer progressive MP4 (no ffmpeg needed). These are usually itag 18 (360p) / 22 (720p).
        cmd = [
            sys.executable, '-m', 'yt_dlp',
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

def _open_url_stream(url):
    """
    Open a URL stream with a UA and a lenient SSL context for local-dev reliability.
    """
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, context=ctx)

def _download_to_tempfile(url, prefix="ytdlp_", suffix=".mp4"):
    """
    Download a URL to a temporary file and return (file_path, size_bytes, content_type).
    This avoids needing Content-Length for streaming uploads.
    """
    with _open_url_stream(url) as r:
        content_type = r.headers.get("Content-Type") or "video/mp4"
        fd, file_path = tempfile.mkstemp(prefix=prefix, suffix=suffix)
        size = 0
        try:
            with os.fdopen(fd, "wb") as f:
                while True:
                    chunk = r.read(1024 * 256)
                    if not chunk:
                        break
                    f.write(chunk)
                    size += len(chunk)
        except Exception:
            try:
                os.unlink(file_path)
            except Exception:
                pass
            raise
    return file_path, size, content_type

def _youtube_resumable_upload(access_token, file_path, file_size, content_type, title, description):
    """
    Upload a local file to YouTube using the resumable upload API.
    Returns the uploaded video ID.
    """
    metadata = {
        "snippet": {
            "title": (title or "")[:100],
            "description": (description or "")[:5000],
            "categoryId": "22",
        },
        "status": {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": False,
        },
    }

    init_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Upload-Content-Length": str(file_size),
        "X-Upload-Content-Type": content_type or "video/*",
    }

    init_resp = requests.post(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        headers=init_headers,
        data=json.dumps(metadata),
        timeout=60,
    )
    if not init_resp.ok:
        try:
            data = init_resp.json()
            msg = data.get("error", {}).get("message") or init_resp.text
        except Exception:
            msg = init_resp.text
        raise Exception(f"YouTube init failed (HTTP {init_resp.status_code}): {msg[:300]}")

    upload_url = init_resp.headers.get("Location")
    if not upload_url:
        raise Exception("YouTube init succeeded but no upload URL was returned (missing Location header)")

    with open(file_path, "rb") as f:
        upload_headers = {
            "Content-Type": content_type or "video/*",
            "Content-Length": str(file_size),
        }
        up_resp = requests.put(upload_url, headers=upload_headers, data=f, timeout=60 * 30)

    if not up_resp.ok:
        try:
            data = up_resp.json()
            msg = data.get("error", {}).get("message") or up_resp.text
        except Exception:
            msg = up_resp.text
        raise Exception(f"YouTube upload failed (HTTP {up_resp.status_code}): {msg[:300]}")

    try:
        result = up_resp.json()
    except Exception:
        raise Exception("YouTube upload succeeded but response was not JSON")

    video_id = result.get("id")
    if not video_id:
        raise Exception("YouTube upload succeeded but no video id was returned")

    return video_id


@app.route('/download-file', methods=['POST', 'GET'])
def download_file():
    """
    Streams an MP4 file to the browser.
    This is used for previewing/downloading from the frontend without CORS issues.
    """
    try:
        if request.method == 'GET':
            video_id = request.args.get('videoId') or request.args.get('video_id')
            video_url = request.args.get('url')
        else:
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
            with _open_url_stream(mp4_url) as r:
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

@app.route('/upload-to-youtube', methods=['POST'])
def upload_to_youtube():
    """
    Upload a YouTube video to the authenticated user's channel WITHOUT using Supabase Storage.
    Flow: yt-dlp gets a direct MP4 URL -> service downloads to temp file -> service uploads to YouTube.
    """
    tmp_path = None
    try:
        data = request.get_json() or {}
        access_token = data.get("accessToken") or data.get("access_token")
        video_id = data.get("videoId") or data.get("video_id")
        title = data.get("title") or ""
        description = data.get("description") or ""

        if not access_token:
            return jsonify({"error": "accessToken is required"}), 400
        if not video_id:
            return jsonify({"error": "videoId is required"}), 400

        mp4_url = get_download_url(video_id)
        if not mp4_url:
            return jsonify({"error": "Failed to get a direct MP4 URL"}), 500

        tmp_path, size_bytes, content_type = _download_to_tempfile(mp4_url, prefix=f"ytdlp_{video_id}_")
        uploaded_id = _youtube_resumable_upload(access_token, tmp_path, size_bytes, content_type, title, description)

        return jsonify({
            "success": True,
            "videoId": uploaded_id,
            "videoUrl": f"https://www.youtube.com/watch?v={uploaded_id}",
        })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in upload_to_youtube endpoint: {str(e)}", file=sys.stderr)
        print(error_trace, file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

@app.route('/upload-file-to-youtube', methods=['POST'])
def upload_file_to_youtube():
    """
    Upload a local file (multipart form-data) to YouTube WITHOUT using Supabase Storage.
    Expects fields: accessToken, title, description, file
    """
    tmp_path = None
    try:
        access_token = request.form.get("accessToken") or request.form.get("access_token")
        title = request.form.get("title") or ""
        description = request.form.get("description") or ""
        file = request.files.get("file")

        if not access_token:
            return jsonify({"error": "accessToken is required"}), 400
        if not file:
            return jsonify({"error": "file is required"}), 400

        # Save upload to temp file
        fd, tmp_path = tempfile.mkstemp(prefix="upload_", suffix=os.path.splitext(file.filename or "")[1] or ".mp4")
        os.close(fd)
        file.save(tmp_path)

        size_bytes = os.path.getsize(tmp_path)
        content_type = file.mimetype or "video/mp4"

        uploaded_id = _youtube_resumable_upload(access_token, tmp_path, size_bytes, content_type, title, description)
        return jsonify({
            "success": True,
            "videoId": uploaded_id,
            "videoUrl": f"https://www.youtube.com/watch?v={uploaded_id}",
        })
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in upload_file_to_youtube endpoint: {str(e)}", file=sys.stderr)
        print(error_trace, file=sys.stderr)
        return jsonify({"error": str(e)}), 500
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

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
                test_cmd = [sys.executable, '-m', 'yt_dlp', '--dump-json', f'https://www.youtube.com/watch?v={video_id}']
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

