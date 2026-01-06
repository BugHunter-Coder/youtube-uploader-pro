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
    const { videoId } = await req.json();

    console.log(`Downloading video: ${videoId}`);

    // Use cobalt.tools API to get download URL
    const cobaltResponse = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        vCodec: "h264",
        vQuality: "1080",
        aFormat: "mp3",
        filenamePattern: "basic",
        isAudioOnly: false,
        disableMetadata: false,
      }),
    });

    const cobaltData = await cobaltResponse.json();

    console.log("Cobalt response status:", cobaltData.status);

    if (cobaltData.status === "error") {
      throw new Error(cobaltData.text || "Failed to get download URL");
    }

    if (cobaltData.status === "redirect" || cobaltData.status === "stream") {
      return new Response(
        JSON.stringify({ 
          downloadUrl: cobaltData.url,
          status: "ready"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (cobaltData.status === "picker") {
      // Multiple formats available, pick the best video
      const videoOption = cobaltData.picker?.find((p: any) => p.type === "video") || cobaltData.picker?.[0];
      return new Response(
        JSON.stringify({ 
          downloadUrl: videoOption?.url,
          status: "ready"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Unexpected response from download service");

  } catch (error) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Download failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
