import React, { useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, ExternalLink } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface LottieViewerProps {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
}

export const LottieViewer: React.FC<LottieViewerProps> = ({
  src,
  loop = true,
  autoplay = true,
}) => {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [dotLottie, setDotLottie] = useState<any>(null);
  const [error] = useState<string | null>(null);

  const dotLottieRefCallback = useCallback((dotLottieInstance: any) => {
    setDotLottie(dotLottieInstance);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!dotLottie) return;

    if (isPlaying) {
      dotLottie.pause();
      setIsPlaying(false);
    } else {
      dotLottie.play();
      setIsPlaying(true);
    }
  }, [isPlaying, dotLottie]);

  const handleRestart = useCallback(() => {
    if (!dotLottie) return;
    dotLottie.setFrame(0);
    dotLottie.play();
    setIsPlaying(true);
  }, [dotLottie]);

  // Error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <p className="text-gray-500 mb-2">Failed to load animation</p>
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-500 hover:underline text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Open in new tab
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Animation Container */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        <DotLottieReact
          src={src}
          loop={loop}
          autoplay={autoplay}
          dotLottieRefCallback={dotLottieRefCallback}
          style={{ width: '100%', height: '100%', maxWidth: '600px', maxHeight: '500px' }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-t border-gray-700">
        <button
          onClick={togglePlayPause}
          className="p-2 rounded-full hover:bg-gray-700 text-white"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <button
          onClick={handleRestart}
          className="p-2 rounded-full hover:bg-gray-700 text-white"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
