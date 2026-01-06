import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { VideoUrlInput } from "@/components/VideoUrlInput";
import { VideoFileInput } from "@/components/VideoFileInput";
import { EditableVideoPreview } from "@/components/EditableVideoPreview";
import { TransferStatus } from "@/components/TransferStatus";
import { YouTubeConnect } from "@/components/YouTubeConnect";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  expiresAt?: number;
  channel: { title: string; thumbnail: string } | null;
}

const Index = () => {
  const [status, setStatus] = useState<StatusStep>("idle");
  const [mode, setMode] = useState<"youtube" | "direct" | "file">("youtube");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [youtubeAuth, setYoutubeAuth] = useState<YouTubeAuth | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

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
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([^&\s?/]+)/,
      /(?:www\.)?youtube\.com\/shorts\/([^&\s?/]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const looksLikeYouTubeUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?/i,
      /^https?:\/\/youtu\.be\//i,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\//i,
      /^https?:\/\/youtube\.com\/shorts\//i,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const isValidDirectVideoUrl = (url: string): boolean => {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) return false;
      if (looksLikeYouTubeUrl(url)) return false;
      const path = u.pathname.toLowerCase();
      return /\.(mp4|mov|webm|mkv|m4v)(?:$)/.test(path);
    } catch {
      return false;
    }
  };

  const handleFetchVideo = async (url: string) => {
    setStatus("idle");
    setError("");
    setProgress(0);
    setUploadedVideoUrl(null);
    setSelectedFile(null);
    setSourceUrl(null);

    if (!/^https?:\/\//i.test(url)) {
      toast.error("Please paste a valid URL (http/https).");
      return;
    }

    // Check if it's a YouTube URL
    if (looksLikeYouTubeUrl(url)) {
      const videoId = extractVideoId(url);
      if (!videoId) {
        toast.error("Could not extract video ID from YouTube URL");
        return;
      }

      setMode("youtube");
      setStatus("fetching");
      
      try {
        // Get video metadata from YouTube API
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
      return;
    }

    // Handle direct file URLs
    if (isValidDirectVideoUrl(url)) {
      setMode("direct");
      setSourceUrl(url);

      const now = new Date().toISOString();
      const urlObj = new URL(url);
      const lastPath = decodeURIComponent(urlObj.pathname.split("/").filter(Boolean).pop() || "");
      const titleFromUrl = (lastPath.replace(/\.[^.]+$/, "") || "Untitled video").slice(0, 100);

      const directInfo: VideoInfo = {
        title: titleFromUrl,
        description: "",
        thumbnail: "/placeholder.svg",
        channelTitle: "Direct URL",
        publishedAt: now,
        videoId: `direct-${Date.now()}`,
      };

      setVideoInfo(directInfo);
      setCustomTitle(directInfo.title);
      setCustomDescription("");
      toast.success("URL ready! Edit the title/description, then connect your channel.");
      return;
    }

    toast.error("Please enter a YouTube URL or a direct video file URL (mp4/mov/webm)");
  };

  const handleMetadataChange = (title: string, description: string) => {
    setCustomTitle(title);
    setCustomDescription(description);
  };

  const handleSelectFile = async (file: File) => {
    setMode("file");
    setSelectedFile(file);
    setUploadedVideoUrl(null);
    setError("");
    setProgress(0);
    setSourceUrl(null);

    const titleFromName = file.name.replace(/\.[^.]+$/, "");
    const now = new Date().toISOString();
    const localInfo: VideoInfo = {
      title: titleFromName || "Untitled video",
      description: "",
      thumbnail: "/placeholder.svg",
      channelTitle: "Local file",
      publishedAt: now,
      videoId: `local-${Date.now()}`,
    };

    setVideoInfo(localInfo);
    setCustomTitle(localInfo.title);
    setCustomDescription("");
    setStatus("idle");
    toast.success("File selected! Edit the title/description, then connect your channel.");
  };

  const handleYouTubeConnect = (tokens: YouTubeAuth) => {
    setYoutubeAuth(tokens);
  };

  const clearYouTubeAuth = (reason?: string) => {
    try {
      localStorage.removeItem("youtube_auth");
    } catch {
      // ignore
    }
    setYoutubeAuth(null);
    if (reason) toast.error(reason);
  };

  const refreshYouTubeAccessToken = async (refreshToken: string) => {
    const { data, error } = await supabase.functions.invoke("youtube-oauth", {
      body: { action: "refreshToken", refreshToken },
    });

    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "Failed to refresh token");
    }

    const expiresInSec = Number(data.expiresIn || data.expires_in || 3600);
    const expiresAt = Date.now() + Math.max(0, expiresInSec - 60) * 1000;
    return { accessToken: data.accessToken as string, expiresAt };
  };

  const ensureValidYouTubeAuth = async (): Promise<YouTubeAuth> => {
    if (!youtubeAuth) throw new Error("Please connect your YouTube channel first");

    // If we don't know expiry, just proceed (we'll retry on auth failure)
    if (!youtubeAuth.expiresAt) return youtubeAuth;

    // Token still valid with a small buffer
    if (Date.now() < youtubeAuth.expiresAt) return youtubeAuth;

    if (!youtubeAuth.refreshToken) {
      clearYouTubeAuth("Session expired. Please reconnect your YouTube channel.");
      throw new Error("Session expired. Please reconnect your YouTube channel.");
    }

    try {
      const refreshed = await refreshYouTubeAccessToken(youtubeAuth.refreshToken);
      const updated: YouTubeAuth = {
        ...youtubeAuth,
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      };
      setYoutubeAuth(updated);
      try {
        localStorage.setItem("youtube_auth", JSON.stringify(updated));
      } catch {
        // ignore
      }
      toast.success("Session refreshed");
      return updated;
    } catch {
      clearYouTubeAuth("Session expired. Please reconnect your YouTube channel.");
      throw new Error("Session expired. Please reconnect your YouTube channel.");
    }
  };

  // Function to call Python service directly
  const downloadFromPythonService = async (videoId: string): Promise<string | null> => {
    // Get Python service URL from environment variable
    // Default to localhost:8000 for local development
    // Set VITE_PYTHON_DOWNLOADER_URL in .env file or environment
    const pythonServiceUrl = import.meta.env.VITE_PYTHON_DOWNLOADER_URL || "http://localhost:8000";
    
    // If no URL is configured, skip Python service
    if (!pythonServiceUrl || pythonServiceUrl === "false") {
      console.log("Python service URL not configured, skipping...");
      return null;
    }
    
    try {
      console.log(`🎯 Calling Python yt-dlp service at ${pythonServiceUrl}...`);
      const response = await fetch(`${pythonServiceUrl}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.log(`Python service returned ${response.status}: ${errorText.substring(0, 100)}`);
        return null;
      }

      const data = await response.json();
      if (data && data.downloadUrl) {
        console.log("✅ Python yt-dlp service successfully provided download URL");
        return data.downloadUrl;
      }
      
      if (data && data.error) {
        console.log(`❌ Python service error: ${data.error}`);
        // Don't return null immediately - throw error so user sees it
        throw new Error(`Python service: ${data.error}`);
      }
      
      console.log("⚠️  Python service returned no download URL");
      return null;
    } catch (err) {
      console.log(`Python service connection error:`, err);
      // If it's a CORS or connection error, that's expected if service isn't running
      if (err instanceof TypeError) {
        if (err.message.includes("Failed to fetch") || err.message.includes("CORS")) {
          console.log("⚠️  Python service not accessible - make sure it's running and CORS is enabled");
          console.log("   Start with: npm run python:service");
        }
      }
      return null;
    }
  };

  const handleTransfer = async () => {
    if (!videoInfo || !youtubeAuth) {
      toast.error("Please connect your YouTube channel first");
      return;
    }

    if (mode === "file" && !selectedFile) {
      toast.error("Please select a video file first");
      return;
    }
    if (mode === "direct" && !sourceUrl) {
      toast.error("Please paste a direct video file URL first");
      return;
    }
    if (mode === "youtube" && !videoInfo?.videoId) {
      toast.error("Please fetch a YouTube video first");
      return;
    }

    setStatus(mode === "file" ? "fetching" : "downloading");
    setError("");
    setProgress(10);

    try {
      let uploadSourceUrl: string | null = null;

      if (mode === "youtube") {
        // Step 1: Try Python service FIRST (most reliable)
        setStatus("downloading");
        setProgress(15);
        
        console.log("🎯 Attempting to download using Python yt-dlp service...");
        try {
          const pythonDownloadUrl = await downloadFromPythonService(videoInfo.videoId);
          
          if (pythonDownloadUrl) {
            // Python service succeeded - use it directly
            uploadSourceUrl = pythonDownloadUrl;
            setProgress(25);
            console.log("✅ Using download URL from Python service");
            toast.success("Downloaded using Python yt-dlp service");
          } else {
            // Python service failed or not available - fall back to Edge Function
            console.log("⚠️  Python service not available, using Supabase Edge Function...");
            setProgress(20);
            
            const { data: downloadData, error: downloadError } = await supabase.functions.invoke(
              "youtube-download",
              {
                body: { videoId: videoInfo.videoId },
              }
            );

            if (downloadError || downloadData.error) {
              throw new Error(downloadData?.error || downloadError?.message || "Failed to get download URL");
            }

            uploadSourceUrl = downloadData.downloadUrl;
            console.log("✅ Using download URL from Supabase Edge Function");
          }
        } catch (pythonError) {
          // If Python service throws an error (not just returns null), show it but still try Edge Function
          console.error("Python service error:", pythonError);
          const pythonErrorMsg = pythonError instanceof Error ? pythonError.message : String(pythonError);
          
          // Only try Edge Function if Python error is not a critical failure
          if (pythonErrorMsg.includes("not accessible") || pythonErrorMsg.includes("Failed to fetch")) {
            console.log("Python service not running, trying Edge Function...");
            setProgress(20);
            
            const { data: downloadData, error: downloadError } = await supabase.functions.invoke(
              "youtube-download",
              {
                body: { videoId: videoInfo.videoId },
              }
            );

            if (downloadError || downloadData.error) {
              throw new Error(downloadData?.error || downloadError?.message || "Failed to get download URL");
            }

            uploadSourceUrl = downloadData.downloadUrl;
          } else {
            // Python service had a real error (video restriction, etc.) - throw it
            throw pythonError;
          }
        }
      } else if (mode === "direct") {
        uploadSourceUrl = sourceUrl;
      } else {
        // Local file mode: upload file to Supabase Storage, then use that URL as the source
        setStatus("downloading");
        setProgress(20);

        const bucket = import.meta.env.VITE_UPLOAD_BUCKET || "uploads";
        const file = selectedFile!;
        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
        const path = `incoming/${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            upsert: false,
            contentType: file.type || "video/mp4",
          });

        if (uploadErr) {
          throw new Error(
            `Failed to upload file to Storage. Ensure bucket "${bucket}" exists and allows uploads. (${uploadErr.message})`
          );
        }

        // Prefer signed URL (works even if bucket is private), fallback to public URL
        const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (!signed.error && signed.data?.signedUrl) {
          uploadSourceUrl = signed.data.signedUrl;
        } else {
          const pub = supabase.storage.from(bucket).getPublicUrl(path);
          uploadSourceUrl = pub.data.publicUrl;
        }
      }

      if (!uploadSourceUrl) {
        throw new Error("No upload source URL available");
      }

      setProgress(30);
      setStatus("uploading");

      // Step 2: Upload to YouTube
      const invokeUpload = async (accessToken: string) =>
        supabase.functions.invoke("youtube-upload", {
          body: {
            accessToken,
            downloadUrl: uploadSourceUrl,
            title: customTitle || videoInfo.title,
            description: customDescription || videoInfo.description,
          },
        });

      let auth = await ensureValidYouTubeAuth();
      let { data: uploadData, error: uploadError } = await invokeUpload(auth.accessToken);

      // If token was revoked/expired unexpectedly, try refresh once and retry upload
      if ((uploadError || uploadData?.error) && youtubeAuth?.refreshToken) {
        const msg = String(uploadData?.error || uploadError?.message || "");
        const looksLikeAuthError =
          /unauthori|auth|credential|token|invalid/i.test(msg);

        if (looksLikeAuthError) {
          try {
            const refreshed = await refreshYouTubeAccessToken(youtubeAuth.refreshToken);
            const updated: YouTubeAuth = {
              ...(youtubeAuth as YouTubeAuth),
              accessToken: refreshed.accessToken,
              expiresAt: refreshed.expiresAt,
            };
            setYoutubeAuth(updated);
            try {
              localStorage.setItem("youtube_auth", JSON.stringify(updated));
            } catch {
              // ignore
            }

            ({ data: uploadData, error: uploadError } = await invokeUpload(updated.accessToken));
          } catch {
            clearYouTubeAuth("Session expired. Please reconnect your YouTube channel.");
          }
        }
      }

      if (uploadError || uploadData?.error) {
        const msg = uploadData?.error || uploadError?.message || "Failed to upload video";
        // If auth is bad, force re-auth UX
        if (/unauthori|auth|credential|token|invalid/i.test(String(msg))) {
          clearYouTubeAuth("Session expired. Please reconnect your YouTube channel.");
        }
        throw new Error(msg);
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
    setSelectedFile(null);
    setSourceUrl(null);
    setMode("youtube");
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
          <Tabs value={mode} onValueChange={(v) => setMode(v as "youtube" | "direct" | "file")}>
            <TabsList className="mb-6">
              <TabsTrigger value="youtube">YouTube URL</TabsTrigger>
              <TabsTrigger value="direct">Direct File URL</TabsTrigger>
              <TabsTrigger value="file">Local File</TabsTrigger>
            </TabsList>

            <TabsContent value="youtube">
              <VideoUrlInput onSubmit={handleFetchVideo} isLoading={status === "fetching"} />
            </TabsContent>
            <TabsContent value="direct">
              <VideoUrlInput onSubmit={handleFetchVideo} isLoading={status === "fetching"} />
            </TabsContent>
            <TabsContent value="file">
              <VideoFileInput onSelect={handleSelectFile} isLoading={status === "fetching"} />
              <p className="text-xs text-muted-foreground mt-3 text-center">
                This mode uploads a file you already have. It does not download from YouTube.
              </p>
            </TabsContent>
          </Tabs>
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
                onDisconnect={() => clearYouTubeAuth("Disconnected")}
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
            <TransferStatus status={status} error={error} progress={progress} mode={mode} />
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
            <TransferStatus status={status} error={error} progress={progress} mode={mode} />
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
