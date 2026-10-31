import React, { useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, ExternalLink, Layers } from 'lucide-react';
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';

interface RiveViewerProps {
  src: string;
  stateMachine?: string;
  artboard?: string;
}

export const RiveViewer: React.FC<RiveViewerProps> = ({
  src,
  stateMachine,
  artboard,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { rive, RiveComponent } = useRive({
    src,
    artboard: artboard || undefined,
    stateMachines: stateMachine ? [stateMachine] : undefined,
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
    onLoadError: (err: any) => {
      console.error('Failed to load Rive animation:', err);
      setError(typeof err === 'string' ? err : 'Failed to load Rive animation');
    },
    onPlay: () => setIsPlaying(true),
    onPause: () => setIsPlaying(false),
    onStop: () => setIsPlaying(false),
  });

  const togglePlayPause = useCallback(() => {
    if (!rive) return;

    if (isPlaying) {
      rive.pause();
    } else {
      rive.play();
    }
  }, [isPlaying, rive]);

  const handleRestart = useCallback(() => {
    if (!rive) return;
    rive.reset();
    rive.play();
    setIsPlaying(true);
  }, [rive]);

  // Error state
  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
        <div className="text-center p-4">
          <p className="text-gray-500 mb-2">Failed to load Rive animation</p>
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

  const animations = rive?.animationNames || [];
  const stateMachines = rive?.stateMachineNames || [];

  return (
    <div className="w-full h-full flex flex-col bg-gray-900">
      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <RiveComponent style={{ width: '100%', height: '100%' }} />
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

        {/* Animation Selector */}
        {animations.length > 1 && (
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-400" />
            <select
              onChange={(e) => rive?.play(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {animations.map((anim) => (
                <option key={anim} value={anim}>
                  {anim}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex-1" />

        {/* Info */}
        <span className="text-xs text-gray-400">
          {stateMachines.length > 0 && `${stateMachines.length} state machine${stateMachines.length > 1 ? 's' : ''}`}
          {stateMachines.length > 0 && animations.length > 0 && ' • '}
          {animations.length > 0 && `${animations.length} animation${animations.length > 1 ? 's' : ''}`}
        </span>

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
