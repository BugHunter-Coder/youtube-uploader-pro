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

  const isValidYoutubeUrl = (url: string) => {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    ];
    return patterns.some((pattern) => pattern.test(url));
  };

  const isValid = isValidYoutubeUrl(url);

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Link2 className="h-5 w-5" />
        </div>
        <Input
          type="url"
          placeholder="Paste YouTube video URL here..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-14 pl-12 pr-4 text-base bg-secondary/50 border-border/50 focus:border-primary focus:ring-primary/20 placeholder:text-muted-foreground/60"
          disabled={isLoading}
        />
      </div>
      
      {url && !isValid && (
        <p className="text-sm text-destructive animate-fade-in">
          Please enter a valid YouTube URL
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
            Transfer Video
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </Button>
    </form>
  );
}
