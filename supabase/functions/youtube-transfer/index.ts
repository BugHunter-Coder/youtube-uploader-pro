import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, videoId, videoInfo } = await req.json();

    console.log(`Processing action: ${action} for video: ${videoId}`);

    if (action === "getVideoInfo") {
      // Fetch video details from YouTube Data API
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`;
      
      console.log("Fetching video info from YouTube API...");
      
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.error) {
        console.error("YouTube API error:", data.error);
        throw new Error(data.error.message || "Failed to fetch video info");
      }

      if (!data.items || data.items.length === 0) {
        throw new Error("Video not found or is private");
      }

      const video = data.items[0];
      const snippet = video.snippet;
      const statistics = video.statistics;
      const contentDetails = video.contentDetails;

      // Parse duration from ISO 8601 format
      const parseDuration = (iso8601: string) => {
        const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return "0:00";
        
        const hours = parseInt(match[1] || "0");
        const minutes = parseInt(match[2] || "0");
        const seconds = parseInt(match[3] || "0");
        
        if (hours > 0) {
          return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
      };

      const videoData = {
        videoId,
        title: snippet.title,
        description: snippet.description,
        thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url,
        channelTitle: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        viewCount: statistics?.viewCount,
        duration: contentDetails?.duration ? parseDuration(contentDetails.duration) : undefined,
      };

      console.log("Video info retrieved successfully:", videoData.title);

      return new Response(
        JSON.stringify({ video: videoData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "transfer") {
      // Note: Full video transfer requires OAuth 2.0 flow for uploading
      // This is a placeholder that shows the architecture
      console.log("Transfer requested for video:", videoInfo?.title);
      
      // In a real implementation, you would:
      // 1. Download the video using a media service
      // 2. Upload to the user's channel via YouTube Data API with OAuth
      
      // For now, we'll explain what's needed
      return new Response(
        JSON.stringify({ 
          error: "Full transfer requires YouTube OAuth authorization. Please set up OAuth in your Google Cloud Console and implement the authorization flow.",
          needsAuth: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("Error in youtube-transfer function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
