import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// List of public Cobalt instances (v8 API)
const COBALT_INSTANCES = [
  "https://cobalt.api.timelessnesses.me",
  "https://api.cobalt.tools",
  "https://cobalt-api.kwiatekmiki.com",
];

async function tryDownloadFromCobalt(videoId: string): Promise<{ downloadUrl: string } | null> {
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      
      const response = await fetch(instance, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          videoQuality: "1080",
          filenameStyle: "basic",
          downloadMode: "auto",
        }),
      });

      if (!response.ok) {
        console.log(`Instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`Instance ${instance} response:`, JSON.stringify(data).slice(0, 200));

      if (data.status === "error") {
        console.log(`Instance ${instance} error: ${data.error?.code || data.text}`);
        continue;
      }

      // v8 API returns url directly or in picker
      if (data.url) {
        return { downloadUrl: data.url };
      }

      if (data.picker && data.picker.length > 0) {
        const videoOption = data.picker.find((p: any) => p.type === "video") || data.picker[0];
        if (videoOption?.url) {
          return { downloadUrl: videoOption.url };
        }
      }

      // Legacy v7 format
      if (data.status === "redirect" || data.status === "stream") {
        return { downloadUrl: data.url };
      }

    } catch (err) {
      console.log(`Instance ${instance} failed:`, err);
      continue;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();

    console.log(`Attempting to get download URL for video: ${videoId}`);

    const result = await tryDownloadFromCobalt(videoId);

    if (result) {
      console.log("Successfully got download URL");
      return new Response(
        JSON.stringify({ 
          downloadUrl: result.downloadUrl,
          status: "ready"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If all Cobalt instances fail, return error with helpful message
    throw new Error("Unable to process this video. The video may be restricted, private, or unavailable for download.");

  } catch (error) {
    console.error("Download error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Download failed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
