"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trophy,
  Target,
  AlertTriangle,
  Clock,
  RotateCcw,
  X,
} from "lucide-react";
import type { GameData, VideoFile, GameEvent } from "@/types";

interface HighlightsProps {
  gameData: GameData;
  videoFile: VideoFile;
  onSeekToTime?: (time: number) => void;
}

interface HighlightVideo {
  event: GameEvent;
  startTime: number;
  endTime: number;
  duration: number;
  thumbnail?: string;
}

export function Highlights({
  gameData,
  videoFile,
  onSeekToTime,
}: HighlightsProps) {
  const [selectedHighlight, setSelectedHighlight] =
    useState<HighlightVideo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create highlight videos from timeline events
  const highlightVideos: HighlightVideo[] = gameData.events
    .filter(
      (event) =>
        event.type === "score" ||
        event.type === "shot_attempt" ||
        event.type === "missed_shot" ||
        event.type === "offensive_rebound" ||
        event.type === "defensive_rebound" ||
        event.type === "turnover" ||
        event.type === "steal"
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((event) => {
      // Create a 3-second highlight around each event
      const startTime = Math.max(0, event.timestamp - 1.5);
      const endTime = Math.min(videoFile.duration, event.timestamp + 1.5);
      return {
        event,
        startTime,
        endTime,
        duration: endTime - startTime,
      };
    });

  const totalHighlights = highlightVideos.length;

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "score":
        return <Trophy className="w-4 h-4 text-green-600" />;
      case "shot_attempt":
      case "missed_shot":
        return <Target className="w-4 h-4 text-blue-600" />;
      case "offensive_rebound":
      case "defensive_rebound":
        return <RotateCcw className="w-4 h-4 text-purple-600" />;
      case "turnover":
      case "steal":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "score":
        return "bg-green-50 border-green-200 text-green-800";
      case "shot_attempt":
      case "missed_shot":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "offensive_rebound":
      case "defensive_rebound":
        return "bg-purple-50 border-purple-200 text-purple-800";
      case "turnover":
      case "steal":
        return "bg-red-50 border-red-200 text-red-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  // Generate thumbnail for a highlight
  const generateThumbnail = useCallback(
    async (highlight: HighlightVideo) => {
      if (!canvasRef.current) return null;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      return new Promise<string>((resolve) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = videoFile.url;
        video.currentTime = highlight.startTime + 0.5; // Get frame at 0.5s into highlight

        video.addEventListener("loadeddata", () => {
          canvas.width = 320;
          canvas.height = 180;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
          resolve(thumbnail);
        });
      });
    },
    [videoFile.url]
  );

  // Handle highlight selection
  const handleHighlightSelect = useCallback((highlight: HighlightVideo) => {
    setSelectedHighlight(highlight);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current || !selectedHighlight) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.currentTime = selectedHighlight.startTime + currentTime;
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, selectedHighlight, currentTime]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle video time update
  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current || !selectedHighlight) return;

    const videoTime = videoRef.current.currentTime;
    const relativeTime = videoTime - selectedHighlight.startTime;

    if (relativeTime >= selectedHighlight.duration) {
      // Highlight ended, stop playing
      setIsPlaying(false);
      setCurrentTime(0);
    } else {
      setCurrentTime(relativeTime);
    }
  }, [selectedHighlight]);

  // Handle video ended
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Close selected highlight
  const handleCloseHighlight = useCallback(() => {
    setSelectedHighlight(null);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!selectedHighlight) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          handlePlayPause();
          break;
        case "m":
          e.preventDefault();
          handleMuteToggle();
          break;
        case "Escape":
          e.preventDefault();
          handleCloseHighlight();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [
    selectedHighlight,
    handlePlayPause,
    handleMuteToggle,
    handleCloseHighlight,
  ]);

  if (totalHighlights === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Trophy className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Highlights Found</h3>
        <p className="text-muted-foreground">
          No significant events were detected in this game to create highlights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden canvas for thumbnail generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Game Highlights</h2>
        <p className="text-muted-foreground">
          {totalHighlights} highlight{totalHighlights !== 1 ? "s" : ""} from
          your game
        </p>
      </div>

      {/* Selected Highlight Modal */}
      {selectedHighlight && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="relative bg-black rounded-lg overflow-hidden max-w-4xl w-full">
            {/* Close button */}
            <button
              onClick={handleCloseHighlight}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Video Player */}
            <video
              ref={videoRef}
              src={videoFile.url}
              className="w-full h-64 sm:h-80 md:h-96 lg:h-[500px] object-cover"
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              muted={isMuted}
              preload="metadata"
            />

            {/* Video Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              {/* Event Info Overlay */}
              <div className="absolute top-4 left-4 right-16">
                <div
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getEventColor(
                    selectedHighlight.event.type
                  )}`}
                >
                  {getEventIcon(selectedHighlight.event.type)}
                  <span className="font-medium">
                    {selectedHighlight.event.type
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  <span className="text-sm opacity-75">
                    {formatTime(selectedHighlight.event.timestamp)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="absolute bottom-16 left-4 right-4">
                <div className="bg-white/20 rounded-full h-1">
                  <div
                    className="bg-white rounded-full h-1 transition-all duration-300"
                    style={{
                      width: `${
                        (currentTime / selectedHighlight.duration) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white" />
                    )}
                  </button>

                  <button
                    onClick={handleMuteToggle}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>

                  <div className="text-white text-sm">
                    {formatTime(currentTime)} /{" "}
                    {formatTime(selectedHighlight.duration)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Highlights Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">All Highlights</h3>
          <div className="text-sm text-muted-foreground">
            Click any highlight to watch
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {highlightVideos.map((highlight, index) => {
            const team = gameData.teams.find(
              (t) => t.id === highlight.event.teamId
            );
            const isSelected =
              selectedHighlight?.event.id === highlight.event.id;

            return (
              <div
                key={highlight.event.id}
                onClick={() => handleHighlightSelect(highlight)}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                {/* Thumbnail/Video Preview */}
                <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-transparent" />

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-3 bg-black/50 rounded-full">
                    <Play className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Event info */}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="flex items-center gap-2 mb-1">
                    {getEventIcon(highlight.event.type)}
                    <span className="text-xs font-medium text-white">
                      {highlight.event.type
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-xs text-white/80">
                    {formatTime(highlight.event.timestamp)}
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute top-2 right-2">
                  <div className="px-2 py-1 bg-black/50 rounded text-xs text-white">
                    {formatTime(highlight.duration)}
                  </div>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 left-2">
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Keyboard Shortcuts</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
          <div>
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Space</kbd>{" "}
            Play/Pause
          </div>
          <div>
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">M</kbd> Mute
          </div>
          <div>
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd>{" "}
            Close
          </div>
        </div>
      </div>
    </div>
  );
}
