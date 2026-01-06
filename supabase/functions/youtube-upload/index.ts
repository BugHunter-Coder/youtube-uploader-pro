import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, downloadUrl, title, description } = await req.json();

    console.log(`Uploading video: ${title}`);

    // Step 1: Fetch the video from the provided source URL
    console.log("Fetching video from source URL...");
    const videoResponse = await fetch(downloadUrl);
    
    if (!videoResponse.ok) {
      const body = await videoResponse.text().catch(() => "");
      throw new Error(
        `Failed to fetch video file (HTTP ${videoResponse.status}).${body ? ` ${body.slice(0, 200)}` : ""}`
      );
    }

    const contentLengthHeader = videoResponse.headers.get("content-length");
    const contentTypeHeader = videoResponse.headers.get("content-type") || "video/*";
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
    const canStream = !!videoResponse.body && Number.isFinite(contentLength) && contentLength > 0;

    // If we can't stream (unknown size / missing body), fall back to in-memory blob,
    // but guard against large files to avoid edge function memory/timeouts.
    const MAX_BLOB_MB = Number(Deno.env.get("MAX_BLOB_MB") || "150"); // conservative default
    const maxBlobBytes = MAX_BLOB_MB * 1024 * 1024;

    let videoBody: BodyInit;
    let videoSizeBytes: number;

    if (canStream) {
      videoBody = videoResponse.body!;
      videoSizeBytes = contentLength;
      console.log(`Video size (from Content-Length): ${(videoSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    } else {
      const blob = await videoResponse.blob();
      videoSizeBytes = blob.size;
      console.log(`Video size (blob): ${(videoSizeBytes / 1024 / 1024).toFixed(2)} MB`);
      if (videoSizeBytes > maxBlobBytes) {
        throw new Error(
          `Source did not provide Content-Length for streaming, and the file is too large to buffer in memory (${(videoSizeBytes / 1024 / 1024).toFixed(1)} MB). ` +
          `Use a direct URL that includes Content-Length, or upload via Local File mode (Storage signed URL).`
        );
      }
      videoBody = blob;
    }

    // Step 2: Initialize resumable upload to YouTube
    const metadata = {
      snippet: {
        title: title.slice(0, 100), // YouTube limit
        description: description.slice(0, 5000), // YouTube limit
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: "private", // Start as private for safety
        selfDeclaredMadeForKids: false,
      },
    };

    console.log("Initializing YouTube upload...");
    const initResponse = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Length": videoSizeBytes.toString(),
          "X-Upload-Content-Type": contentTypeHeader,
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errorData = await initResponse.json();
      console.error("YouTube init error:", errorData);
      throw new Error(errorData.error?.message || "Failed to initialize upload");
    }

    const uploadUrl = initResponse.headers.get("Location");
    if (!uploadUrl) {
      throw new Error("No upload URL received from YouTube");
    }

    // Step 3: Upload the video file
    console.log("Uploading video to YouTube...");
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentTypeHeader,
        "Content-Length": videoSizeBytes.toString(),
      },
      body: videoBody,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => "");
      console.error("YouTube upload error:", errorText);
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error?.message || "Failed to upload video");
      } catch {
        throw new Error(errorText || "Failed to upload video");
      }
    }

    const uploadResult = await uploadResponse.json();
    console.log("Upload successful! Video ID:", uploadResult.id);

    return new Response(
      JSON.stringify({
        success: true,
        videoId: uploadResult.id,
        videoUrl: `https://www.youtube.com/watch?v=${uploadResult.id}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Upload failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
