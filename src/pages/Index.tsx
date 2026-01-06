import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { VideoUrlInput } from "@/components/VideoUrlInput";
import { EditableVideoPreview } from "@/components/EditableVideoPreview";
import { TransferStatus } from "@/components/TransferStatus";
import { YouTubeConnect } from "@/components/YouTubeConnect";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Shield, Zap, Rocket } from "lucide-react";

type StatusStep = "idle" | "fetching" | "downloading" | "uploading" | "complete" | "error";

interface VideoInfo {
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  duration?: string;
  videoId: string;
}

interface YouTubeAuth {
  accessToken: string;
  refreshToken: string;
  channel: { title: string; thumbnail: string } | null;
}

const Index = () => {
  const [status, setStatus] = useState<StatusStep>("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [youtubeAuth, setYoutubeAuth] = useState<YouTubeAuth | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

  // Check for saved YouTube auth on mount + when OAuth finishes in another tab/window
  useEffect(() => {
    const loadAuth = () => {
      const savedAuth = localStorage.getItem("youtube_auth");
      if (!savedAuth) return;

      try {
        const auth = JSON.parse(savedAuth);
        setYoutubeAuth(auth);
      } catch {
        localStorage.removeItem("youtube_auth");
      }
    };

    loadAuth();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "youtube_auth") {
        loadAuth();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\s?]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleFetchVideo = async (url: string) => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast.error("Could not extract video ID from URL");
      return;
    }

    setStatus("fetching");
    setError("");
    setProgress(0);
    setUploadedVideoUrl(null);

    try {
      const { data: infoData, error: infoError } = await supabase.functions.invoke(
        "youtube-transfer",
        {
          body: { action: "getVideoInfo", videoId },
        }
      );

      if (infoError) throw new Error(infoError.message);
      if (infoData.error) throw new Error(infoData.error);

      setVideoInfo(infoData.video);
      setCustomTitle(infoData.video.title);
      setCustomDescription(infoData.video.description || "");
      setStatus("idle");
      toast.success("Video found! Edit the title and description, then connect your channel.");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to fetch video info");
      toast.error("Failed to fetch video info");
    }
  };

  const handleMetadataChange = (title: string, description: string) => {
    setCustomTitle(title);
    setCustomDescription(description);
  };

  const handleYouTubeConnect = (tokens: YouTubeAuth) => {
    setYoutubeAuth(tokens);
  };

  const handleTransfer = async () => {
    if (!videoInfo || !youtubeAuth) {
      toast.error("Please connect your YouTube channel first");
      return;
    }

    setStatus("downloading");
    setError("");
    setProgress(10);

    try {
      // Step 1: Get download URL
      const { data: downloadData, error: downloadError } = await supabase.functions.invoke(
        "youtube-download",
        {
          body: { videoId: videoInfo.videoId },
        }
      );

      if (downloadError || downloadData.error) {
        throw new Error(downloadData?.error || downloadError?.message || "Failed to get download URL");
      }

      setProgress(30);
      setStatus("uploading");

      // Step 2: Upload to YouTube
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        "youtube-upload",
        {
          body: {
            accessToken: youtubeAuth.accessToken,
            downloadUrl: downloadData.downloadUrl,
            title: customTitle || videoInfo.title,
            description: customDescription || videoInfo.description,
          },
        }
      );

      if (uploadError || uploadData.error) {
        throw new Error(uploadData?.error || uploadError?.message || "Failed to upload video");
      }

      setProgress(100);
      setStatus("complete");
      setUploadedVideoUrl(uploadData.videoUrl);
      toast.success("Video uploaded successfully!");
    } catch (err) {
      setStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Transfer failed";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setVideoInfo(null);
    setError("");
    setProgress(0);
    setCustomTitle("");
    setCustomDescription("");
    setUploadedVideoUrl(null);
  };

  const isProcessing = status === "fetching" || status === "downloading" || status === "uploading";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Transfer Your Videos</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Download any YouTube video and upload it to your channel with custom title and description.
          </p>
        </div>

        <div className="glass-card p-8 mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <VideoUrlInput
            onSubmit={handleFetchVideo}
            isLoading={status === "fetching"}
          />
        </div>

        {videoInfo && status !== "complete" && (
          <div className="space-y-6 animate-fade-in">
            <EditableVideoPreview
              video={videoInfo}
              onMetadataChange={handleMetadataChange}
            />

            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Step 2: Connect Your Channel</h3>
              <YouTubeConnect
                onConnect={handleYouTubeConnect}
                isConnected={!!youtubeAuth}
                channelInfo={youtubeAuth?.channel}
              />
            </div>

            {youtubeAuth && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4">Step 3: Transfer Video</h3>
                <Button
                  onClick={handleTransfer}
                  disabled={isProcessing}
                  className="w-full"
                  variant="hero"
                  size="lg"
                >
                  <Rocket className="mr-2 h-5 w-5" />
                  {isProcessing ? "Transferring..." : "Transfer to My Channel"}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Video will be uploaded as Private. You can change visibility on YouTube.
                </p>
              </div>
            )}
          </div>
        )}

        {(status === "downloading" || status === "uploading") && (
          <div className="mt-6">
            <TransferStatus status={status} error={error} progress={progress} />
          </div>
        )}

        {status === "complete" && uploadedVideoUrl && (
          <div className="glass-card p-8 text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Transfer Complete!</h3>
            <p className="text-muted-foreground mb-6">
              Your video has been uploaded to your channel as a Private video.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild variant="hero">
                <a href={uploadedVideoUrl} target="_blank" rel="noopener noreferrer">
                  View on YouTube
                </a>
              </Button>
              <Button onClick={handleReset} variant="outline">
                Transfer Another Video
              </Button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6">
            <TransferStatus status={status} error={error} progress={progress} />
            <div className="text-center mt-4">
              <Button onClick={handleReset} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {!videoInfo && status === "idle" && (
          <div className="grid md:grid-cols-3 gap-6 mt-12 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Easy Transfer</h3>
              <p className="text-sm text-muted-foreground">
                Paste a URL and transfer videos in seconds
              </p>
            </div>

            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Edit Metadata</h3>
              <p className="text-sm text-muted-foreground">
                Change title and description before uploading
              </p>
            </div>

            <div className="glass-card p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Fast & Reliable</h3>
              <p className="text-sm text-muted-foreground">
                Quick transfers with real-time progress updates
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>© 2026 TubeTransfer. Only transfer content you own.</p>
      </footer>
    </div>
  );
};

export default Index;
