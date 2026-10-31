'use client';

/**
 * Lightweight Video Editor (Jan 2026)
 * 
 * Simple post-generation video editing: trim, reorder scenes,
 * edit text overlays, timing adjustments, and re-render.
 * Now with real video playback and audio waveform visualization.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  GripVertical,
  Trash2,
  Edit3,
  Clock,
  RefreshCw,
  Save,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  Scissors,
  Type,
  Film,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { VideoScript, Scene } from '@/lib/assets/video-script-generator';
import type { Voiceover } from '@/lib/video/voiceover';
import type { AssembledVideo } from '@/lib/video/assembly';

interface VideoEditorProps {
  script: VideoScript;
  voiceover?: Voiceover;
  video?: AssembledVideo;
  onScriptChange: (script: VideoScript) => void;
  onReRender: () => Promise<void>;
  onSave: () => Promise<void>;
}

export function VideoEditor({
  script,
  voiceover,
  video,
  onScriptChange,
  onReRender,
  onSave,
}: VideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(false);
  
  // Calculate scene positions
  const scenePositions = useMemo(() => {
    let position = 0;
    return script.scenes.map(scene => {
      const start = position;
      position += scene.duration;
      return { start, end: position, scene };
    });
  }, [script.scenes]);
  
  // Current scene based on playback position
  const currentScene = useMemo(() => {
    return scenePositions.find(
      p => currentTime >= p.start && currentTime < p.end
    )?.scene;
  }, [currentTime, scenePositions]);
  
  // Load waveform data when voiceover changes
  useEffect(() => {
    if (voiceover?.audioUrl) {
      loadWaveform(voiceover.audioUrl);
    }
  }, [voiceover?.audioUrl]);
  
  // Sync video/audio time with currentTime state
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);
  
  // Update currentTime from video element
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    } else if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);
  
  // Load waveform from audio URL
  const loadWaveform = async (audioUrl: string) => {
    setIsLoadingWaveform(true);
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Extract waveform data
      const channelData = audioBuffer.getChannelData(0);
      const samples = 200; // Number of bars in waveform
      const blockSize = Math.floor(channelData.length / samples);
      const waveform: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j]);
        }
        waveform.push(sum / blockSize);
      }
      
      // Normalize
      const max = Math.max(...waveform);
      setWaveformData(waveform.map(v => v / max));
      
      audioContext.close();
    } catch (error) {
      console.error('Failed to load waveform:', error);
    } finally {
      setIsLoadingWaveform(false);
    }
  };
  
  // Handle scene reorder
  const handleReorder = useCallback((newOrder: Scene[]) => {
    onScriptChange({
      ...script,
      scenes: newOrder.map((scene, idx) => ({
        ...scene,
        order: idx + 1,
      })),
    });
  }, [script, onScriptChange]);
  
  // Handle scene edit
  const handleEditScene = useCallback((scene: Scene) => {
    setEditingScene({ ...scene });
    setIsEditDialogOpen(true);
  }, []);
  
  // Save scene edit
  const handleSaveSceneEdit = useCallback(() => {
    if (!editingScene) return;
    
    onScriptChange({
      ...script,
      scenes: script.scenes.map(s =>
        s.id === editingScene.id ? editingScene : s
      ),
      voiceoverText: script.scenes
        .map(s => s.id === editingScene.id ? editingScene.narration : s.narration)
        .join('\n\n'),
    });
    
    setIsEditDialogOpen(false);
    setEditingScene(null);
  }, [editingScene, script, onScriptChange]);
  
  // Delete scene
  const handleDeleteScene = useCallback((sceneId: string) => {
    const newScenes = script.scenes
      .filter(s => s.id !== sceneId)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    
    onScriptChange({
      ...script,
      scenes: newScenes,
      totalDuration: newScenes.reduce((sum, s) => sum + s.duration, 0),
      voiceoverText: newScenes.map(s => s.narration).join('\n\n'),
    });
  }, [script, onScriptChange]);
  
  // Update duration
  const handleDurationChange = useCallback((sceneId: string, duration: number) => {
    onScriptChange({
      ...script,
      scenes: script.scenes.map(s =>
        s.id === sceneId ? { ...s, duration: Math.max(1, duration) } : s
      ),
      totalDuration: script.scenes.reduce((sum, s) =>
        sum + (s.id === sceneId ? Math.max(1, duration) : s.duration), 0
      ),
    });
  }, [script, onScriptChange]);
  
  // Re-render video
  const handleReRender = async () => {
    setIsRendering(true);
    try {
      await onReRender();
    } finally {
      setIsRendering(false);
    }
  };
  
  // Playback controls
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);
  
  const skipToStart = useCallback(() => {
    setCurrentTime(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, []);
  
  const skipToEnd = useCallback(() => {
    const endTime = script.totalDuration;
    setCurrentTime(endTime);
    if (videoRef.current) videoRef.current.currentTime = endTime;
    if (audioRef.current) audioRef.current.currentTime = endTime;
  }, [script.totalDuration]);
  
  // Seek to position
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * script.totalDuration;
    
    setCurrentTime(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    if (audioRef.current) audioRef.current.currentTime = newTime;
  }, [script.totalDuration]);
  
  // Jump to scene
  const jumpToScene = useCallback((scene: Scene) => {
    const position = scenePositions.find(p => p.scene.id === scene.id);
    if (position) {
      setCurrentTime(position.start);
      if (videoRef.current) videoRef.current.currentTime = position.start;
      if (audioRef.current) audioRef.current.currentTime = position.start;
      setSelectedScene(scene);
    }
  }, [scenePositions]);
  
  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) videoRef.current.volume = newVolume;
    if (audioRef.current) audioRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  }, []);
  
  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) videoRef.current.muted = newMuted;
    if (audioRef.current) audioRef.current.muted = newMuted;
  }, [isMuted]);
  
  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && videoRef.current) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);
  
  // Handle video ended
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);
  
  // Download video
  const handleDownload = useCallback(() => {
    if (video?.videoUrl) {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `video-${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [video]);
  
  return (
    <div className="flex flex-col h-full bg-background rounded-xl overflow-hidden">
      {/* Preview Area */}
      <div className="relative aspect-video bg-black">
        {video?.videoUrl ? (
          <video
            ref={videoRef}
            src={video.videoUrl}
            className="w-full h-full object-contain"
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : voiceover?.audioUrl ? (
          <>
            <audio
              ref={audioRef}
              src={voiceover.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/80">
              <Film className="w-16 h-16 opacity-50 mb-4" />
              <p className="text-sm text-muted-foreground">Audio preview (video rendering...)</p>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/80">
            <Film className="w-16 h-16 opacity-50" />
          </div>
        )}
        
        {/* Current scene text overlay preview */}
        <AnimatePresence>
          {currentScene?.textOverlay && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 text-white rounded"
            >
              {currentScene.textOverlay}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Video controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={skipToStart}
              className="text-white hover:bg-card/20"
            >
              <SkipBack className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="text-white hover:bg-card/20"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={skipToEnd}
              className="text-white hover:bg-card/20"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
            
            {/* Progress bar with click-to-seek */}
            <div 
              className="flex-1 h-1 bg-card/20 rounded-full overflow-hidden cursor-pointer relative"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${(currentTime / script.totalDuration) * 100}%` }}
              />
            </div>
            
            <span className="text-white text-sm font-mono min-w-[80px]">
              {formatTime(currentTime)} / {formatTime(script.totalDuration)}
            </span>
            
            {/* Volume control */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="text-white hover:bg-card/20"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-card/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-card [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
            
            {video?.videoUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white hover:bg-card/20"
              >
                <Download className="w-5 h-5" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-card/20"
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Waveform & Timeline */}
      <div className="flex-shrink-0 p-4 border-t border-border/50">
        <div className="flex gap-2 mb-4">
          <Badge variant="outline">{script.format}</Badge>
          <Badge variant="outline">{script.style}</Badge>
          <Badge variant="outline">{script.scenes.length} scenes</Badge>
          <Badge variant="outline">{formatTime(script.totalDuration)}</Badge>
          {video?.status === 'rendering' && (
            <Badge variant="outline" className="bg-amber-500/20 text-amber-400">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Rendering...
            </Badge>
          )}
        </div>
        
        {/* Audio Waveform */}
        {waveformData.length > 0 && (
          <div className="h-12 mb-2 flex items-end gap-[1px] bg-card/40 backdrop-blur-sm rounded-lg p-2 cursor-pointer" onClick={handleSeek}>
            {waveformData.map((value, index) => {
              const isPlayed = (index / waveformData.length) <= (currentTime / script.totalDuration);
              return (
                <div
                  key={index}
                  className={`flex-1 rounded-sm transition-colors ${isPlayed ? 'bg-violet-500' : 'bg-muted'}`}
                  style={{ height: `${Math.max(4, value * 100)}%` }}
                />
              );
            })}
          </div>
        )}
        
        {isLoadingWaveform && (
          <div className="h-12 mb-2 flex items-center justify-center bg-card/40 backdrop-blur-sm rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading waveform...</span>
          </div>
        )}
        
        {/* Scene timeline */}
        <div className="relative h-16 bg-card/40 backdrop-blur-sm rounded-lg overflow-hidden cursor-pointer" onClick={handleSeek}>
          {scenePositions.map(({ start, end, scene }) => {
            const width = ((end - start) / script.totalDuration) * 100;
            const left = (start / script.totalDuration) * 100;
            const isSelected = selectedScene?.id === scene.id;
            const isCurrent = currentScene?.id === scene.id;
            
            return (
              <div
                key={scene.id}
                className={`absolute top-0 bottom-0 transition-all ${
                  isSelected ? 'ring-2 ring-violet-500 z-10' : ''
                } ${isCurrent ? 'bg-violet-500/30' : 'bg-muted/50'}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onClick={(e) => { e.stopPropagation(); jumpToScene(scene); }}
              >
                <div className="p-2 h-full flex flex-col justify-between border-r border-border/50">
                  <span className="text-xs text-muted-foreground truncate">
                    Scene {scene.order}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {scene.duration}s
                  </span>
                </div>
              </div>
            );
          })}
          
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-card z-20 pointer-events-none"
            style={{ left: `${(currentTime / script.totalDuration) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Scene List */}
      <div className="flex-1 overflow-auto p-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground/90">Scenes</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              className="border-border/50"
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              onClick={handleReRender}
              disabled={isRendering}
              className="bg-violet-600 hover:bg-violet-500"
            >
              {isRendering ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Re-render
            </Button>
          </div>
        </div>
        
        <Reorder.Group
          axis="y"
          values={script.scenes}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {script.scenes.map(scene => (
            <Reorder.Item
              key={scene.id}
              value={scene}
              className={`p-4 bg-card/40 backdrop-blur-sm rounded-lg cursor-move group ${
                selectedScene?.id === scene.id ? 'ring-2 ring-violet-500' : ''
              } ${currentScene?.id === scene.id ? 'bg-violet-500/10' : ''}`}
              onClick={() => setSelectedScene(scene)}
            >
              <div className="flex items-start gap-3">
                <GripVertical className="w-5 h-5 text-muted-foreground/80 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground/90">
                      Scene {scene.order}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {scene.transition}
                    </Badge>
                    {currentScene?.id === scene.id && (
                      <Badge className="bg-violet-500/20 text-violet-400 text-xs">
                        Playing
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {scene.narration}
                  </p>
                  
                  {scene.textOverlay && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Type className="w-3 h-3" />
                      {scene.textOverlay}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <Input
                      type="number"
                      value={scene.duration}
                      onChange={(e) => handleDurationChange(scene.id, parseInt(e.target.value))}
                      className="w-14 h-7 text-xs bg-muted/50 border-border/50"
                      min={1}
                      max={60}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-xs">s</span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleEditScene(scene); }}
                    className="h-8 w-8 text-muted-foreground hover:text-white"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); jumpToScene(scene); }}
                    className="h-8 w-8 text-muted-foreground hover:text-violet-400"
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); handleDeleteScene(scene.id); }}
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                    disabled={script.scenes.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
      
      {/* Edit Scene Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card/40 backdrop-blur-sm border-border/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Scene {editingScene?.order}</DialogTitle>
          </DialogHeader>
          
          {editingScene && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Narration / Voiceover
                </label>
                <Textarea
                  value={editingScene.narration}
                  onChange={(e) => setEditingScene({
                    ...editingScene,
                    narration: e.target.value,
                  })}
                  className="bg-muted/50 border-border/50 min-h-[100px]"
                  placeholder="What is spoken in this scene..."
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Text Overlay (optional)
                </label>
                <Input
                  value={editingScene.textOverlay || ''}
                  onChange={(e) => setEditingScene({
                    ...editingScene,
                    textOverlay: e.target.value,
                  })}
                  className="bg-muted/50 border-border/50"
                  placeholder="Text to display on screen..."
                />
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Visual Direction
                </label>
                <Textarea
                  value={editingScene.visualDirection}
                  onChange={(e) => setEditingScene({
                    ...editingScene,
                    visualDirection: e.target.value,
                  })}
                  className="bg-muted/50 border-border/50"
                  placeholder="What should be shown on screen..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    Duration (seconds)
                  </label>
                  <Input
                    type="number"
                    value={editingScene.duration}
                    onChange={(e) => setEditingScene({
                      ...editingScene,
                      duration: parseInt(e.target.value) || 1,
                    })}
                    className="bg-muted/50 border-border/50"
                    min={1}
                    max={60}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">
                    Transition
                  </label>
                  <select
                    value={editingScene.transition}
                    onChange={(e) => setEditingScene({
                      ...editingScene,
                      transition: e.target.value as Scene['transition'],
                    })}
                    className="w-full h-10 px-3 bg-muted/50 border border-border/50 rounded-md text-sm"
                  >
                    <option value="cut">Cut</option>
                    <option value="fade">Fade</option>
                    <option value="slide">Slide</option>
                    <option value="zoom">Zoom</option>
                    <option value="wipe">Wipe</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  B-Roll Keywords
                </label>
                <Input
                  value={editingScene.brollKeywords.join(', ')}
                  onChange={(e) => setEditingScene({
                    ...editingScene,
                    brollKeywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
                  })}
                  className="bg-muted/50 border-border/50"
                  placeholder="Keywords for stock footage search..."
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveSceneEdit} className="bg-violet-600">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
