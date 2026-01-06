import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const YouTubeCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");

      if (errorParam) {
        setError(errorParam);
        localStorage.removeItem("youtube_oauth_pending");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      if (!code) {
        setError("No authorization code received");
        localStorage.removeItem("youtube_oauth_pending");
        setTimeout(() => navigate("/"), 3000);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/youtube-callback`;

        // Exchange code for tokens
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
          "youtube-oauth",
          {
            body: {
              action: "exchangeCode",
              code,
              redirectUri,
            },
          }
        );

        if (tokenError || tokenData.error) {
          throw new Error(tokenData?.error || tokenError?.message || "Failed to exchange code");
        }

        // Save tokens to localStorage
        localStorage.setItem(
          "youtube_auth",
          JSON.stringify({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            channel: tokenData.channel,
          })
        );
        localStorage.removeItem("youtube_oauth_pending");

        // If this was opened as a popup, close it; otherwise go back home
        try {
          window.close();
        } catch {
          // ignore
        }

        navigate("/");
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        localStorage.removeItem("youtube_oauth_pending");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Authentication failed</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-muted-foreground text-sm mt-2">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Completing authorization...</p>
      </div>
    </div>
  );
};

export default YouTubeCallback;
