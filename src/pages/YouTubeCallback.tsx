import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const YouTubeCallback = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (window.opener) {
      window.opener.postMessage(
        {
          type: "youtube-oauth-callback",
          code,
          error,
        },
        window.location.origin
      );
    }
  }, []);

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
