"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/layout/dialog";
import { Play, X } from "lucide-react";

interface VideoDialogProps {
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function VideoDialog({
  videoUrl,
  thumbnailUrl,
  title = "Watch Video",
  children,
  className,
}: VideoDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Extract video ID and platform for embed
  const getEmbedUrl = (url: string) => {
    // YouTube
    const youtubeMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
    );
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&rel=0`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    }

    // Loom
    const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loomMatch) {
      return `https://www.loom.com/embed/${loomMatch[1]}?autoplay=1`;
    }

    // Return as-is for direct video URLs
    return url;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild className={className}>
        {children}
      </DialogTrigger>
      <DialogContent
        className="p-0 border-none overflow-hidden"
        showCloseButton={false}
        style={{
          width: '95vw',
          height: '85vh',
          maxWidth: 'none',
          maxHeight: 'none',
          background: 'transparent',
          border: 'none',
          borderRadius: '12px',
          padding: 0,
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Video player for {title}
        </DialogDescription>
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden">
          {/* Close button - inside the video container */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-50 p-2 text-white/80 hover:text-white transition-colors bg-black/50 rounded-full backdrop-blur-sm"
            aria-label="Close video"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Video iframe */}
          {isOpen && (
            <iframe
              src={getEmbedUrl(videoUrl)}
              title={title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Thumbnail trigger with play button overlay
export function VideoThumbnail({
  thumbnailUrl,
  alt = "Video thumbnail",
  className,
}: {
  thumbnailUrl: string;
  alt?: string;
  className?: string;
}) {
  return (
    <div className={`relative group cursor-pointer ${className}`}>
      <img
        src={thumbnailUrl}
        alt={alt}
        className="w-full h-full object-cover rounded-xl"
      />
      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors rounded-xl flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-xl transition-all group-hover:scale-110">
          <Play className="w-6 h-6 text-black ml-1" />
        </div>
      </div>
    </div>
  );
}

