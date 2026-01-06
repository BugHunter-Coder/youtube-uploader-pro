import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YOUTUBE_CLIENT_ID = Deno.env.get("YOUTUBE_CLIENT_ID");
const YOUTUBE_CLIENT_SECRET = Deno.env.get("YOUTUBE_CLIENT_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirectUri } = await req.json();

    console.log(`YouTube OAuth action: ${action}`);

    if (action === "getAuthUrl") {
      const scopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube",
      ].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${YOUTUBE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      console.log("Generated auth URL");

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchangeCode") {
      console.log("Exchanging authorization code for tokens...");

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: YOUTUBE_CLIENT_ID!,
          client_secret: YOUTUBE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Token exchange error:", tokens.error);
        throw new Error(tokens.error_description || tokens.error);
      }

      // Get channel info
      const channelResponse = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }
      );

      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0]?.snippet;

      console.log("OAuth successful, channel:", channel?.title);

      return new Response(
        JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          channel: channel ? {
            title: channel.title,
            thumbnail: channel.thumbnails?.default?.url,
          } : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refreshToken") {
      const { refreshToken } = await req.json();

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: YOUTUBE_CLIENT_ID!,
          client_secret: YOUTUBE_CLIENT_SECRET!,
          grant_type: "refresh_token",
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      return new Response(
        JSON.stringify({
          accessToken: tokens.access_token,
          expiresIn: tokens.expires_in,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("YouTube OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "OAuth error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
