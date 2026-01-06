import { useState, useEffect } from "react";
import { Calendar, Eye, User, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface VideoInfo {
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
  duration?: string;
}

interface EditableVideoPreviewProps {
  video: VideoInfo;
  onMetadataChange: (title: string, description: string) => void;
}

export function EditableVideoPreview({ video, onMetadataChange }: EditableVideoPreviewProps) {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);

  useEffect(() => {
    setTitle(video.title);
    setDescription(video.description);
  }, [video.title, video.description]);

  const handleTitleChange = (value: string) => {
    const newTitle = value.slice(0, 100);
    setTitle(newTitle);
    onMetadataChange(newTitle, description);
  };

  const handleDescriptionChange = (value: string) => {
    const newDescription = value.slice(0, 5000);
    setDescription(newDescription);
    onMetadataChange(title, newDescription);
  };

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
      <div className="flex items-center gap-2 mb-4">
        <Pencil className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Edit before uploading</span>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-shrink-0">
          <img
            src={video.thumbnail}
            alt={title}
            className="w-full md:w-64 h-36 object-cover rounded-lg"
          />
          {video.duration && (
            <span className="absolute bottom-2 right-2 bg-background/90 text-foreground text-xs px-2 py-1 rounded">
              {video.duration}
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title" className="text-sm font-medium">
                Title
              </Label>
              <span className="text-xs text-muted-foreground">
                {title.length}/100
              </span>
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="bg-background/50"
              placeholder="Enter video title"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <span className="text-xs text-muted-foreground">
                {description.length}/5000
              </span>
            </div>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="bg-background/50 min-h-[80px] resize-none"
              placeholder="Enter video description"
            />
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
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
        </div>
      </div>
    </div>
  );
}
