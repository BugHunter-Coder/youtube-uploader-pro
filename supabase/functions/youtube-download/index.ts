import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client for Storage access
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const STORAGE_BUCKET = Deno.env.get("DOWNLOAD_BUCKET") || "downloads";

/**
 * NOTE:
 * This function depends on a third-party "downloader" service (Cobalt).
 *
 * Relying on random public instances is unreliable (rate limits, Cloudflare, TLS issues,
 * auth requirements can change). For production, set:
 * - COBALT_URLS: comma-separated list of Cobalt base URLs (e.g. "https://api.cobalt.tools")
 * - COBALT_AUTH_JWT (optional): if your instance requires auth
 */
const DEFAULT_PUBLIC_COBALT_INSTANCES = [
  // These are best-effort fallbacks only. Prefer configuring COBALT_URLS.
  "https://api.cobalt.tools",
  "https://cobalt.api.timelessnesses.me",
  "https://cobalt-api.kwiatekmiki.com",
  // Additional fallback instances
  "https://api.cobalt.tools/api/json",
];

const COBALT_URLS =
  (Deno.env.get("COBALT_URLS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const COBALT_AUTH_JWT = Deno.env.get("COBALT_AUTH_JWT") || "";

// Python yt-dlp service URL (if deployed separately)
// Set PYTHON_DOWNLOADER_URL environment variable in Supabase Edge Function settings
// For local testing, use ngrok: ngrok http 8000, then set the ngrok URL
const PYTHON_DOWNLOADER_URL = Deno.env.get("PYTHON_DOWNLOADER_URL") || "";

type CobaltFailure = {
  instance: string;
  status?: number;
  code?: string;
  message: string;
};

function isProbablyHtml(s: string) {
  const t = s.trim().toLowerCase();
  return t.startsWith("<!doctype html") || t.startsWith("<html");
}

async function tryDownloadFromPythonService(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  if (!PYTHON_DOWNLOADER_URL) {
    return null; // Python service not configured
  }

  try {
    console.log(`Trying Python yt-dlp service for video: ${videoId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for Python
    
    try {
      const response = await fetch(`${PYTHON_DOWNLOADER_URL}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Python service returned ${response.status}`);
        return null;
      }
      
      const data = await response.json().catch(() => null);
      if (data && data.downloadUrl) {
        console.log(`Python yt-dlp service found download URL`);
        return { downloadUrl: data.downloadUrl };
      }
      
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      console.log(`Python service failed: ${isTimeout ? "timeout" : err}`);
      return null;
    }
  } catch (err) {
    console.log(`Python service error:`, err);
    return null;
  }
}

async function tryDownloadFromY2Mate(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Trying Y2Mate for video: ${videoId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      // Y2Mate API endpoint
      const response = await fetch(`https://www.y2mate.com/mates/analyzeV2/ajax`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://www.y2mate.com/",
        },
        body: `url=${encodeURIComponent(videoUrl)}`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Y2Mate returned ${response.status}`);
        return null;
      }
      
      const data = await response.json().catch(() => null);
      if (data && data.links && data.links.mp4) {
        const mp4Links = data.links.mp4;
        // Get the highest quality available
        const bestQuality = Object.keys(mp4Links).sort().reverse()[0];
        if (mp4Links[bestQuality] && mp4Links[bestQuality].url) {
          console.log(`Y2Mate found download URL`);
          return { downloadUrl: mp4Links[bestQuality].url };
        }
      }
      
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`Y2Mate failed:`, err);
      return null;
    }
  } catch (err) {
    console.log(`Y2Mate error:`, err);
    return null;
  }
}

async function tryDownloadFromSaveFrom(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Trying SaveFrom for video: ${videoId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      const response = await fetch(`https://api.savefrom.net/api/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({ url: videoUrl }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`SaveFrom returned ${response.status}`);
        return null;
      }
      
      const data = await response.json().catch(() => null);
      if (data && data.url) {
        console.log(`SaveFrom found download URL`);
        return { downloadUrl: data.url };
      }
      
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`SaveFrom failed:`, err);
      return null;
    }
  } catch (err) {
    console.log(`SaveFrom error:`, err);
    return null;
  }
}

async function tryDownloadFromYtMp3(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Trying YTMP3 for video: ${videoId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      const response = await fetch(`https://ytmp3.cc/api/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://ytmp3.cc/",
        },
        body: `url=${encodeURIComponent(videoUrl)}&format=mp4`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`YTMP3 returned ${response.status}`);
        return null;
      }
      
      const data = await response.json().catch(() => null);
      if (data && (data.url || data.downloadUrl || data.link)) {
        const url = data.url || data.downloadUrl || data.link;
        if (url && typeof url === "string") {
          console.log(`YTMP3 found download URL`);
          return { downloadUrl: url };
        }
      }
      
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`YTMP3 failed:`, err);
      return null;
    }
  } catch (err) {
    console.log(`YTMP3 error:`, err);
    return null;
  }
}

async function tryDownloadFromYtDownloader(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Trying YTDownloader for video: ${videoId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      // Try multiple YTDownloader endpoints
      const endpoints = [
        `https://ytdownload.com/api/button/mp4/${videoId}`,
        `https://api.ytdownload.com/video/${videoId}`,
        `https://www.ytdownload.com/api/convert`,
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: endpoint.includes("convert") ? "POST" : "GET",
            headers: {
              "Content-Type": endpoint.includes("convert") ? "application/json" : undefined,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            body: endpoint.includes("convert") ? JSON.stringify({ url: videoUrl }) : undefined,
            signal: controller.signal,
          });
          
          if (response.ok) {
            const data = await response.json().catch(() => null);
            if (data && (data.url || data.downloadUrl || data.videoUrl)) {
              const url = data.url || data.downloadUrl || data.videoUrl;
              if (url && typeof url === "string") {
                console.log(`YTDownloader found download URL`);
                return { downloadUrl: url };
              }
            }
          }
        } catch {
          continue;
        }
      }
      
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`YTDownloader failed:`, err);
      return null;
    }
  } catch (err) {
    console.log(`YTDownloader error:`, err);
    return null;
  }
}

async function tryDownloadFromLoader(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Trying Loader.to for video: ${videoId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      const response = await fetch(`https://loader.to/ajax/download.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://loader.to/",
        },
        body: `url=${encodeURIComponent(videoUrl)}&format=mp4`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.log(`Loader.to returned ${response.status}`);
        return null;
      }
      
      const html = await response.text();
      // Parse HTML for download link
      const match = html.match(/href=["']([^"']*\.mp4[^"']*)["']/i) || 
                   html.match(/data-url=["']([^"']*\.mp4[^"']*)["']/i);
      
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith("//")) url = "https:" + url;
        if (url.startsWith("/")) url = "https://loader.to" + url;
        console.log(`Loader.to found download URL`);
        return { downloadUrl: url };
      }
      
      return null;
    } catch (err) {
      clearTimeout(timeoutId);
      console.log(`Loader.to failed:`, err);
      return null;
    }
  } catch (err) {
    console.log(`Loader.to error:`, err);
    return null;
  }
}

async function tryDownloadFromVidsSave(
  videoId: string,
): Promise<{ downloadUrl: string } | null> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Trying VidsSave for video: ${videoId}`);
    
    // VidsSave API endpoint
    const vidsSaveUrl = "https://vidssave.com/yt";
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    try {
      // Try POST request first
      const response = await fetch(vidsSaveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://vidssave.com/",
        },
        body: `url=${encodeURIComponent(videoUrl)}`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`VidsSave returned ${response.status}`);
        return null;
      }
      
      const html = await response.text();
      
      // Try to find JSON response first (if API returns JSON)
      try {
        const jsonData = JSON.parse(html);
        if (jsonData.url || jsonData.downloadUrl || jsonData.videoUrl || jsonData.link) {
          const url = jsonData.url || jsonData.downloadUrl || jsonData.videoUrl || jsonData.link;
          if (url && typeof url === "string") {
            console.log(`VidsSave found download URL in JSON`);
            return { downloadUrl: url };
          }
        }
        // Check for nested structure
        if (jsonData.data && (jsonData.data.url || jsonData.data.downloadUrl)) {
          const url = jsonData.data.url || jsonData.data.downloadUrl;
          if (url && typeof url === "string") {
            console.log(`VidsSave found download URL in JSON data`);
            return { downloadUrl: url };
          }
        }
      } catch {
        // Not JSON, continue to HTML parsing
      }
      
      // Parse HTML response to find download links
      // VidsSave typically returns HTML with download links
      // Look for various patterns of download URLs
      const patterns = [
        /href=["']([^"']*\.mp4[^"']*)["']/i,
        /data-url=["']([^"']*\.mp4[^"']*)["']/i,
        /download.*?href=["']([^"']*\.mp4[^"']*)["']/i,
        /<a[^>]*href=["']([^"']*download[^"']*\.mp4[^"']*)["']/i,
        /"url":\s*["']([^"']*\.mp4[^"']*)["']/i,
        /downloadUrl["']?\s*[:=]\s*["']([^"']*\.mp4[^"']*)["']/i,
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          let downloadUrl = match[1].trim();
          // Clean up URL (remove HTML entities, etc.)
          downloadUrl = downloadUrl.replace(/&amp;/g, "&").replace(/&#x2F;/g, "/");
          
          // Make sure it's a full URL
          if (downloadUrl.startsWith("//")) {
            downloadUrl = "https:" + downloadUrl;
          } else if (downloadUrl.startsWith("/")) {
            downloadUrl = "https://vidssave.com" + downloadUrl;
          } else if (!downloadUrl.startsWith("http")) {
            // Skip relative URLs that aren't absolute
        continue;
          }
          
          // Verify it looks like a video URL
          if (downloadUrl.includes(".mp4") || downloadUrl.includes("video") || downloadUrl.includes("download")) {
            console.log(`VidsSave found download URL: ${downloadUrl.substring(0, 100)}...`);
            return { downloadUrl };
          }
        }
      }
      
      // Try alternative VidsSave endpoints
      const altEndpoints = [
        `https://vidssave.com/api/ajaxSearch`,
        `https://vidssave.com/api/convert`,
        `https://api.vidssave.com/yt`,
      ];
      
      for (const endpoint of altEndpoints) {
        try {
          const altResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Referer": "https://vidssave.com/",
            },
            body: `url=${encodeURIComponent(videoUrl)}`,
            signal: controller.signal,
          });
          
          if (altResponse.ok) {
            const altData = await altResponse.text();
            // Try JSON first
            try {
              const json = JSON.parse(altData);
              if (json.url || json.downloadUrl || json.videoUrl) {
                const url = json.url || json.downloadUrl || json.videoUrl;
                if (url && typeof url === "string") {
                  console.log(`VidsSave found download URL via ${endpoint}`);
                  return { downloadUrl: url };
                }
              }
            } catch {
              // Not JSON, try HTML parsing
              const altMatch = altData.match(/href=["']([^"']*\.mp4[^"']*)["']/i) || 
                               altData.match(/data-url=["']([^"']*\.mp4[^"']*)["']/i);
              if (altMatch && altMatch[1]) {
                let url = altMatch[1];
                if (url.startsWith("//")) url = "https:" + url;
                if (url.startsWith("/")) url = "https://vidssave.com" + url;
                console.log(`VidsSave found download URL via ${endpoint}`);
                return { downloadUrl: url };
              }
            }
          }
        } catch {
          // Continue to next endpoint
          continue;
        }
      }
      
      // Try GET request with URL parameter
      const getResponse = await fetch(`${vidsSaveUrl}?url=${encodeURIComponent(videoUrl)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://vidssave.com/",
        },
        signal: controller.signal,
      });
      
      if (getResponse.ok) {
        const getHtml = await getResponse.text();
        const getMp4Match = getHtml.match(/href=["']([^"']*\.mp4[^"']*)["']/i) || 
                           getHtml.match(/data-url=["']([^"']*\.mp4[^"']*)["']/i);
        
        if (getMp4Match && getMp4Match[1]) {
          let downloadUrl = getMp4Match[1];
          if (downloadUrl.startsWith("//")) {
            downloadUrl = "https:" + downloadUrl;
          } else if (downloadUrl.startsWith("/")) {
            downloadUrl = "https://vidssave.com" + downloadUrl;
          }
          console.log(`VidsSave found download URL via GET`);
          return { downloadUrl };
        }
      }
      
      console.log(`VidsSave: No download URL found in response`);
      return null;
      
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      console.log(`VidsSave failed: ${isTimeout ? "timeout" : err}`);
      return null;
    }
  } catch (err) {
    console.log(`VidsSave error:`, err);
    return null;
  }
}

async function tryDownloadFromCobalt(
  videoId: string,
): Promise<{ downloadUrl: string } | { failures: CobaltFailure[] }> {
  const instances = COBALT_URLS.length > 0 ? COBALT_URLS : DEFAULT_PUBLIC_COBALT_INSTANCES;
  const failures: CobaltFailure[] = [];

  // Try different quality settings if first attempt fails
  const qualitySettings = ["1080", "720", "480", "360", "best"];

  for (const instance of instances) {
    // Try each quality setting for this instance
    for (const quality of qualitySettings) {
      try {
        console.log(`Trying Cobalt instance: ${instance} with quality: ${quality}`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
        
        try {
          const requestBody: any = {
            url: `https://www.youtube.com/watch?v=${videoId}`,
            filenameStyle: "basic",
            downloadMode: "auto",
          };
          
          // Only set videoQuality if not "best"
          if (quality !== "best") {
            requestBody.videoQuality = quality;
          }
          
          const response = await fetch(instance, {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              ...(COBALT_AUTH_JWT ? { "Authorization": `Bearer ${COBALT_AUTH_JWT}` } : {}),
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        
          clearTimeout(timeoutId);

          if (!response.ok) {
            let body = "";
            try {
              body = await response.text();
            } catch {
              // ignore
            }
            failures.push({
              instance,
              status: response.status,
              message: isProbablyHtml(body)
                ? `HTTP ${response.status} (non-JSON/HTML response; likely blocked by Cloudflare or not an API endpoint)`
                : `HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
            });
            console.log(`Instance ${instance} returned ${response.status}`);
            continue; // Try next quality
          }

          const data = await response.json().catch(async () => {
            const body = await response.text().catch(() => "");
            throw new Error(body ? `Non-JSON response: ${body.slice(0, 200)}` : "Non-JSON response");
          });
      console.log(`Instance ${instance} response:`, JSON.stringify(data).slice(0, 200));

      if (data.status === "error") {
            const code = data?.error?.code;
            const msg = data?.text || data?.error?.message || data?.error?.text || "Cobalt returned status=error";
            
            // Check for specific error messages that indicate video restrictions
            const isRestrictedError = 
              msg.toLowerCase().includes("restricted") ||
              msg.toLowerCase().includes("private") ||
              msg.toLowerCase().includes("unavailable") ||
              msg.toLowerCase().includes("age-restricted") ||
              code === "error.video.restricted" ||
              code === "error.video.private" ||
              code === "error.video.unavailable";
            
            failures.push({
              instance,
              code,
              message: code ? `${code}${msg ? `: ${msg}` : ""}` : msg,
            });
            
            // If it's a video restriction error, log it but continue trying other instances/qualities
            if (isRestrictedError) {
              console.log(`Instance ${instance} at quality ${quality} - Video restriction detected: ${msg}`);
            } else {
              console.log(`Instance ${instance} at quality ${quality} error: ${code || msg}`);
            }
            continue; // Try next quality
      }

      // v8 API returns url directly or in picker
      if (data.url) {
            console.log(`Success with instance ${instance} at quality ${quality}`);
        return { downloadUrl: data.url };
      }

      if (data.picker && data.picker.length > 0) {
        const videoOption = data.picker.find((p: any) => p.type === "video") || data.picker[0];
        if (videoOption?.url) {
              console.log(`Success with instance ${instance} at quality ${quality} (from picker)`);
          return { downloadUrl: videoOption.url };
        }
      }

      // Legacy v7 format
      if (data.status === "redirect" || data.status === "stream") {
            console.log(`Success with instance ${instance} at quality ${quality} (legacy format)`);
        return { downloadUrl: data.url };
      }

          // If we got here, the response was OK but no URL found - try next quality
          console.log(`Instance ${instance} at quality ${quality}: No URL in response, trying next quality`);
          continue;
        } catch (err) {
          clearTimeout(timeoutId);
          const isTimeout = err instanceof Error && err.name === "AbortError";
          // Only log timeout/network errors, not video restriction errors (those are logged above)
          if (!isTimeout) {
            console.log(`Instance ${instance} at quality ${quality} failed:`, err);
          }
          // Continue to next quality setting
          continue;
        }
    } catch (err) {
        // Outer catch for instance-level errors
        console.log(`Instance ${instance} failed at quality ${quality}:`, err);
        // Continue to next quality
      continue;
      }
    }
    
    // If we've tried all quality settings for this instance, log it
    console.log(`Instance ${instance}: All quality settings exhausted`);
  }

  return { failures };
}

async function downloadAndStoreVideo(
  cobaltUrl: string,
  videoId: string,
): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  console.log(`Downloading video from Cobalt URL: ${cobaltUrl.substring(0, 100)}...`);

  // Fetch the video file from Cobalt
  const videoResponse = await fetch(cobaltUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://www.youtube.com/",
    },
  });

  if (!videoResponse.ok) {
    const body = await videoResponse.text().catch(() => "");
    throw new Error(
      `Failed to download video file (HTTP ${videoResponse.status}).${body ? ` ${body.slice(0, 200)}` : ""}`
    );
  }

  const contentType = videoResponse.headers.get("content-type") || "video/mp4";
  const contentLength = videoResponse.headers.get("content-length");
  const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

  console.log(`Video file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB, type: ${contentType}`);

  // Determine file extension from content type or default to mp4
  let ext = "mp4";
  if (contentType.includes("webm")) ext = "webm";
  else if (contentType.includes("quicktime") || contentType.includes("mov")) ext = "mov";
  else if (contentType.includes("x-matroska")) ext = "mkv";

  // Create a unique path in Storage
  const storagePath = `videos/${videoId}-${Date.now()}.${ext}`;

  // Stream the video directly to Storage
  console.log(`Uploading to Storage bucket "${STORAGE_BUCKET}" at path: ${storagePath}`);

  // Read the video as a blob (for Supabase Storage upload)
  const videoBlob = await videoResponse.blob();
  const videoArrayBuffer = await videoBlob.arrayBuffer();
  const videoUint8Array = new Uint8Array(videoArrayBuffer);

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, videoUint8Array, {
      contentType: contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    throw new Error(
      `Failed to upload video to Storage: ${uploadError.message}. Ensure bucket "${STORAGE_BUCKET}" exists and allows uploads.`
    );
  }

  console.log(`Video uploaded successfully to Storage: ${storagePath}`);

  // Generate a signed URL (valid for 1 hour) or get public URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry

  if (!signedError && signedData?.signedUrl) {
    console.log("Generated signed URL for video");
    return signedData.signedUrl;
  }

  // Fallback to public URL if signed URL fails
  const { data: publicData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  if (publicData?.publicUrl) {
    console.log("Using public URL for video");
    return publicData.publicUrl;
  }

  throw new Error("Failed to generate accessible URL for uploaded video");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error("videoId is required");
    }

    console.log(`Attempting to download and store video: ${videoId}`);

    // Python yt-dlp is the PRIMARY and REQUIRED downloader
    // It's the most reliable method for downloading YouTube videos
    let downloadUrl: string | null = null;
    const serviceFailures: string[] = [];
    
    // STEP 1: Try Python yt-dlp service FIRST (required for reliable downloads)
    if (PYTHON_DOWNLOADER_URL) {
      console.log(`🎯 Using Python yt-dlp service (PRIMARY METHOD) at ${PYTHON_DOWNLOADER_URL}...`);
      try {
        const result = await tryDownloadFromPythonService(videoId);
        
        if (result && "downloadUrl" in result) {
          downloadUrl = result.downloadUrl;
          console.log(`✅ SUCCESS! Python yt-dlp service provided download URL`);
        } else {
          serviceFailures.push(`Python yt-dlp: No download URL returned`);
          console.log(`❌ Python yt-dlp service failed, trying fallback services...`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        serviceFailures.push(`Python yt-dlp: ${errorMsg}`);
        console.log(`❌ Python yt-dlp service error: ${errorMsg}`);
      }
    } else {
      console.log(`⚠️  WARNING: Python yt-dlp service not configured!`);
      console.log(`   Set PYTHON_DOWNLOADER_URL in Supabase Edge Function settings.`);
      console.log(`   Falling back to less reliable web services...`);
      serviceFailures.push(`Python yt-dlp: Not configured (PYTHON_DOWNLOADER_URL not set)`);
    }
    
    // STEP 2: Fallback to web services only if Python failed or not configured
    if (!downloadUrl) {
      console.log(`\nTrying fallback web services (less reliable)...`);
      const fallbackDownloaders = [
        { name: "VidsSave", fn: tryDownloadFromVidsSave },
        { name: "Y2Mate", fn: tryDownloadFromY2Mate },
        { name: "SaveFrom", fn: tryDownloadFromSaveFrom },
        { name: "Loader.to", fn: tryDownloadFromLoader },
        { name: "YTDownloader", fn: tryDownloadFromYtDownloader },
        { name: "YTMP3", fn: tryDownloadFromYtMp3 },
      ];
      
      for (const downloader of fallbackDownloaders) {
        console.log(`Trying ${downloader.name} downloader...`);
        try {
          const result = await downloader.fn(videoId);
          
          if (result && "downloadUrl" in result) {
            downloadUrl = result.downloadUrl;
            console.log(`✅ Successfully got download URL from ${downloader.name} (fallback)`);
            break;
          } else {
            serviceFailures.push(`${downloader.name}: No download URL returned`);
            console.log(`❌ ${downloader.name} failed, trying next service...`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          serviceFailures.push(`${downloader.name}: ${errorMsg}`);
          console.log(`❌ ${downloader.name} error: ${errorMsg}`);
        }
      }
    }
    
    // If all alternative services failed, try Cobalt as last resort
    if (!downloadUrl) {
      console.log("All alternative downloaders failed, trying Cobalt as last resort...");
      const result = await tryDownloadFromCobalt(videoId);

      if (!("downloadUrl" in result)) {
        // If all instances fail, return the most actionable failure.
        const failures = result.failures || [];
        
        // Check if any failure indicates video restrictions
        const restrictedError = failures.find((f) => 
          f.message.toLowerCase().includes("restricted") ||
          f.message.toLowerCase().includes("private") ||
          f.message.toLowerCase().includes("unavailable") ||
          f.message.toLowerCase().includes("age-restricted") ||
          f.code === "error.video.restricted" ||
          f.code === "error.video.private" ||
          f.code === "error.video.unavailable"
        );
        
        if (restrictedError) {
          // Log all attempts before throwing restricted error
          console.error("Video restriction detected. All service attempts:");
          console.error("Web service failures:", serviceFailures);
          console.error("Cobalt failures:", failures);
          
          throw new Error(
            `Unable to process this video. The video may be restricted, private, age-restricted, or unavailable for download.\n\nDetails: ${restrictedError.message}\n\nTried ${serviceFailures.length + failures.length} downloader services, all reported restrictions.\n\nIf this is your own video, try:\n1. Making sure the video is public\n2. Configuring PYTHON_DOWNLOADER_URL with a local yt-dlp service\n3. Using the Local File upload option instead`
          );
        }
        
        const missingJwt = failures.find((f) => f.code === "error.api.auth.jwt.missing");
        const hint =
          COBALT_URLS.length === 0
            ? "Downloader backend not configured. Set COBALT_URLS to your own Cobalt instance (recommended)."
            : "";
        const authHint = missingJwt
          ? "This Cobalt instance requires auth (COBALT_AUTH_JWT). Configure it or use a different instance."
          : "";
        
        // Get the most informative error
        const last = failures[failures.length - 1];
        const details = last ? ` Last failure: ${last.instance} - ${last.message}` : "";
        const extra = [hint, authHint].filter(Boolean).join(" ");
        
        // Log all failures for debugging
        console.error("All download attempts failed:");
        console.error("Web service failures:", serviceFailures);
        console.error("Cobalt failures:", failures);
        
        // Create a detailed error message
        const allFailures = [...serviceFailures, ...failures.map(f => `${f.instance}: ${f.message}`)];
        const failureSummary = allFailures.length > 0 
          ? `\n\nFailed services:\n${allFailures.slice(0, 5).map((f, i) => `${i + 1}. ${f}`).join('\n')}${allFailures.length > 5 ? `\n... and ${allFailures.length - 5} more` : ''}`
          : '';
        
        // If Python wasn't configured, emphasize that it's required
        const pythonNotConfigured = !PYTHON_DOWNLOADER_URL;
        const pythonTip = pythonNotConfigured 
          ? `\n\n🔴 REQUIRED: Configure Python yt-dlp service for reliable downloads!\n` +
            `   1. Start Python service: npm run python:service\n` +
            `   2. Expose with ngrok: ngrok http 8000\n` +
            `   3. Set in Supabase: PYTHON_DOWNLOADER_URL = https://your-ngrok-url.ngrok.io\n` +
            `   See README_PYTHON.md for details.`
          : `\n\n💡 Python service was configured but failed. Check service logs.`;
        
        throw new Error(
          `Unable to get a download URL. All downloader services failed.${failureSummary}${extra ? `\n\n${extra}` : ""}${details}${pythonTip}`
        );
      }

      downloadUrl = result.downloadUrl;
      console.log("Got Cobalt download URL");
    }
    
    if (!downloadUrl) {
      throw new Error("Failed to get download URL from any service");
    }
    
    console.log("Now downloading and storing video...");

    // Step 3: Download the video file and store it in Supabase Storage
    const storageUrl = await downloadAndStoreVideo(downloadUrl, videoId);

    console.log("Successfully downloaded and stored video");
      return new Response(
        JSON.stringify({ 
        downloadUrl: storageUrl,
        status: "ready",
        message: "Video downloaded and stored successfully",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

  } catch (error) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Download failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
