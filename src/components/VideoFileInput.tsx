import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileVideo2, Loader2, ArrowRight } from "lucide-react";

interface VideoFileInputProps {
  onSelect: (file: File) => void;
  isLoading: boolean;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function VideoFileInput({ onSelect, isLoading }: VideoFileInputProps) {
  const [file, setFile] = useState<File | null>(null);

  const meta = useMemo(() => {
    if (!file) return null;
    return {
      name: file.name,
      size: formatBytes(file.size),
      type: file.type || "video/*",
    };
  }, [file]);

  const handleChoose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) onSelect(file);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          <FileVideo2 className="h-5 w-5" />
        </div>
        <Input
          type="file"
          accept="video/*"
          onChange={handleChoose}
          className="h-14 pl-12 pr-4 text-base bg-secondary/50 border-border/50 focus:border-primary focus:ring-primary/20 file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
          disabled={isLoading}
        />
      </div>

      {meta && (
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground/90 line-clamp-1">{meta.name}</p>
          <p className="text-xs">
            {meta.size} • {meta.type}
          </p>
        </div>
      )}

      <Button
        type="submit"
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!file || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            Use this file
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </Button>
    </form>
  );
}


