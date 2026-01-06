import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link2, Loader2, ArrowRight } from "lucide-react";

interface VideoUrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function VideoUrlInput({ onSubmit, isLoading }: VideoUrlInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  const looksLikeYouTubeUrl = (value: string) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?/i,
      /^https?:\/\/youtu\.be\//i,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\//i,
    ];
    return patterns.some((pattern) => pattern.test(value));
  };

  const isValidDirectVideoUrl = (value: string) => {
    // Must be a direct downloadable file URL (not a YouTube page).
    // Allow querystrings (e.g. signed URLs), but require a video-ish extension in the path.
    try {
      const u = new URL(value);
      if (!/^https?:$/.test(u.protocol)) return false;
      if (looksLikeYouTubeUrl(value)) return false;
      const path = u.pathname.toLowerCase();
      return /\.(mp4|mov|webm|mkv|m4v)(?:$)/.test(path);
    } catch {
      return false;
    }
  };

  const isValid = isValidDirectVideoUrl(url) || looksLikeYouTubeUrl(url);
  const isYouTube = looksLikeYouTubeUrl(url);

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Link2 className="h-5 w-5" />
        </div>
        <Input
          type="url"
          placeholder="Paste YouTube URL or direct video file URL (mp4/mov/webm)..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-14 pl-12 pr-4 text-base bg-secondary/50 border-border/50 focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/60"
          disabled={isLoading}
        />
      </div>
      
      {url && isYouTube && (
        <p className="text-sm text-muted-foreground animate-fade-in">
          YouTube URL detected. We'll download and transfer this video.
        </p>
      )}

      {url && !isValid && !isYouTube && (
        <p className="text-sm text-destructive animate-fade-in">
          Please enter a YouTube URL or a direct video file URL (must end with .mp4/.mov/.webm/.mkv/.m4v)
        </p>
      )}
      
      <Button
        type="submit"
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            {isYouTube ? "Download from YouTube" : "Use URL"}
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </Button>
    </form>
  );
}
