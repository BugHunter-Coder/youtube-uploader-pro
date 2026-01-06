import { useState } from "react";
import { Header } from "@/components/Header";
import { VideoUrlInput } from "@/components/VideoUrlInput";
import { VideoPreview } from "@/components/VideoPreview";
import { TransferStatus } from "@/components/TransferStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Shield, Zap } from "lucide-react";

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

const Index = () => {
  const [status, setStatus] = useState<StatusStep>("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState(0);

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

  const handleTransfer = async (url: string) => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast.error("Could not extract video ID from URL");
      return;
    }

    setStatus("fetching");
    setError("");
    setProgress(0);

    try {
      // Fetch video info
      const { data: infoData, error: infoError } = await supabase.functions.invoke(
        "youtube-transfer",
        {
          body: { action: "getVideoInfo", videoId },
        }
      );

      if (infoError) throw new Error(infoError.message);
      if (infoData.error) throw new Error(infoData.error);

      setVideoInfo(infoData.video);
      setStatus("downloading");
      setProgress(25);

      // Simulate download progress
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setProgress(50);

      setStatus("uploading");
      setProgress(75);

      // Start transfer
      const { data: transferData, error: transferError } =
        await supabase.functions.invoke("youtube-transfer", {
          body: { action: "transfer", videoId, videoInfo: infoData.video },
        });

      if (transferError) throw new Error(transferError.message);
      if (transferData.error) throw new Error(transferData.error);

      setProgress(100);
      setStatus("complete");
      toast.success("Video transferred successfully!");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      toast.error("Transfer failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Transfer Your Videos</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Easily migrate your own YouTube videos between channels. 
            Just paste the video URL and we'll handle the rest.
          </p>
        </div>

        <div className="glass-card p-8 mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <VideoUrlInput onSubmit={handleTransfer} isLoading={status !== "idle" && status !== "complete" && status !== "error"} />
        </div>

        {videoInfo && <VideoPreview video={videoInfo} />}
        
        <div className="mt-6">
          <TransferStatus status={status} error={error} progress={progress} />
        </div>

        {status === "idle" && (
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
              <h3 className="font-semibold text-foreground mb-2">Your Content Only</h3>
              <p className="text-sm text-muted-foreground">
                Only transfer videos you own or have rights to
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
