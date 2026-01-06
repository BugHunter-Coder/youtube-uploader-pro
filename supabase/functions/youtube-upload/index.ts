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

    // Step 1: Download the video from cobalt URL
    console.log("Fetching video from download URL...");
    const videoResponse = await fetch(downloadUrl);
    
    if (!videoResponse.ok) {
      throw new Error("Failed to download video file");
    }

    const videoBlob = await videoResponse.blob();
    console.log(`Video size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

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
          "X-Upload-Content-Length": videoBlob.size.toString(),
          "X-Upload-Content-Type": "video/*",
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
        "Content-Type": "video/*",
        "Content-Length": videoBlob.size.toString(),
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error("YouTube upload error:", errorData);
      throw new Error(errorData.error?.message || "Failed to upload video");
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
