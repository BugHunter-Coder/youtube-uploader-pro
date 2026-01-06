import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Youtube, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface YouTubeConnectProps {
  onConnect: (tokens: { accessToken: string; refreshToken: string; channel: { title: string; thumbnail: string } }) => void;
  isConnected: boolean;
  channelInfo?: { title: string; thumbnail: string } | null;
}

export function YouTubeConnect({ onConnect, isConnected, channelInfo }: YouTubeConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const redirectUri = `${window.location.origin}/youtube-callback`;
      
      const { data, error } = await supabase.functions.invoke("youtube-oauth", {
        body: { action: "getAuthUrl", redirectUri },
      });

      if (error || data.error) {
        throw new Error(data?.error || error?.message || "Failed to get auth URL");
      }

      // Open OAuth popup
      const popup = window.open(
        data.authUrl,
        "youtube-oauth",
        "width=600,height=700,scrollbars=yes"
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      // Listen for the callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === "youtube-oauth-callback") {
          window.removeEventListener("message", handleMessage);
          popup.close();

          if (event.data.error) {
            throw new Error(event.data.error);
          }

          // Exchange code for tokens
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
            "youtube-oauth",
            {
              body: {
                action: "exchangeCode",
                code: event.data.code,
                redirectUri,
              },
            }
          );

          if (tokenError || tokenData.error) {
            throw new Error(tokenData?.error || tokenError?.message || "Failed to exchange code");
          }

          onConnect({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            channel: tokenData.channel,
          });

          toast.success(`Connected to ${tokenData.channel?.title || "YouTube"}!`);
          setIsConnecting(false);
        }
      };

      window.addEventListener("message", handleMessage);

      // Cleanup on popup close
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
          setIsConnecting(false);
        }
      }, 500);

    } catch (error) {
      console.error("OAuth error:", error);
      toast.error(error instanceof Error ? error.message : "Connection failed");
      setIsConnecting(false);
    }
  };

  if (isConnected && channelInfo) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
        <CheckCircle2 className="h-5 w-5 text-primary" />
        <div className="flex items-center gap-2">
          {channelInfo.thumbnail && (
            <img
              src={channelInfo.thumbnail}
              alt={channelInfo.title}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm font-medium">
            Connected to <span className="text-primary">{channelInfo.title}</span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className="w-full"
      variant="outline"
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Youtube className="mr-2 h-4 w-4" />
          Connect YouTube Channel
        </>
      )}
    </Button>
  );
}
