import { Clock, Eye, Calendar, User } from "lucide-react";

interface VideoInfo {
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  duration?: string;
}

interface VideoPreviewProps {
  video: VideoInfo;
}

export function VideoPreview({ video }: VideoPreviewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatViews = (views: string) => {
    const num = parseInt(views);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M views`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K views`;
    return `${num} views`;
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-shrink-0">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full md:w-64 h-36 object-cover rounded-lg"
          />
          {video.duration && (
            <span className="absolute bottom-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded">
              {video.duration}
            </span>
          )}
        </div>
        
        <div className="flex-1 space-y-3">
          <h3 className="text-lg font-semibold text-foreground line-clamp-2">
            {video.title}
          </h3>
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {video.channelTitle}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(video.publishedAt)}
            </span>
            {video.viewCount && (
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" />
                {formatViews(video.viewCount)}
              </span>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-3">
            {video.description || "No description available"}
          </p>
        </div>
      </div>
    </div>
  );
}
