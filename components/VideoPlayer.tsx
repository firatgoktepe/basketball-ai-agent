"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { PersonDetectionOverlay } from "./PersonDetectionOverlay";
import { VideoQualityCheck } from "./VideoQualityCheck";
import type { VideoFile, DetectionResult, GameData, CropRegion } from "@/types";

interface VideoPlayerProps {
  videoFile: VideoFile;
  onDurationChange?: (duration: number) => void;
  detections?: DetectionResult[];
  gameData?: GameData | null;
  onCropRegionChange?: (region: CropRegion | null) => void;
  cropRegion?: CropRegion | null;
}

export function VideoPlayer({
  videoFile,
  onDurationChange,
  detections,
  gameData,
  onCropRegionChange,
  cropRegion,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Debug: Log video element creation
  useEffect(() => {
    console.log(
      "🎬 VideoPlayer: Component mounted, videoRef:",
      videoRef.current
    );
  }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQualityCheck, setShowQualityCheck] = useState(false);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        setIsMuted(newVolume === 0);
      }
    },
    []
  );

  const handleMuteToggle = useCallback(() => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  }, [isMuted, volume]);

  const handleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      console.log("✅ Video metadata loaded:", {
        duration: videoDuration,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
        src: videoRef.current.src,
      });
      setDuration(videoDuration);
      onDurationChange?.(videoDuration);
      setShowQualityCheck(true);
    }
  }, [onDurationChange]);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      console.error("❌ Video error:", e);
      const target = e.target as HTMLVideoElement;
      const errorDetails = {
        error: target.error,
        networkState: target.networkState,
        readyState: target.readyState,
        src: target.src,
        videoWidth: target.videoWidth,
        videoHeight: target.videoHeight,
        duration: target.duration,
      };
      console.error("❌ Video error details:", errorDetails);

      // Show error to user
      alert(`Video loading error: ${target.error?.message || "Unknown error"}`);
    },
    []
  );

  const handleSeekToTime = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Expose seek function to parent components
  useEffect(() => {
    if (videoRef.current) {
      (videoRef.current as any).seekToTime = handleSeekToTime;
    }
  }, [handleSeekToTime]);

  // Debug: Log when videoFile changes
  useEffect(() => {
    console.log("🎬 VideoPlayer: videoFile changed:", videoFile);
    if (videoFile) {
      console.log("🎬 VideoPlayer: Setting video src to:", videoFile.url);
    }
  }, [videoFile]);

  // Debug: Log when video element is attached to DOM
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      console.log("🎬 VideoPlayer: Video element attached to DOM:", video);
      console.log("🎬 VideoPlayer: Video src attribute:", video.src);
      console.log("🎬 VideoPlayer: Video readyState:", video.readyState);
    }
  }, [videoFile]);

  return (
    <div className="space-y-4">
      {/* Quality Check */}
      {showQualityCheck && (
        <VideoQualityCheck
          videoElement={videoRef.current}
          fileSize={videoFile.size}
          fileName={videoFile.name}
        />
      )}

      <div className="relative bg-black rounded-lg overflow-hidden group">
        <video
          ref={videoRef}
          src={videoFile.url}
          className="w-full h-auto max-h-[60vh]"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadStart={() =>
            console.log("🔄 Video load started:", videoFile.url)
          }
          onCanPlay={() => console.log("▶️ Video can play:", videoFile.url)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onError={handleError}
          controls
          preload="metadata"
        />

        {/* Person Detection Overlay */}
        {detections && detections.length > 0 && (
          <PersonDetectionOverlay
            videoFile={videoFile}
            detections={detections}
            gameData={gameData ?? null}
            currentTime={currentTime}
          />
        )}

        {/* Controls Overlay */}
        <div
          className={`
        absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4
        transition-opacity duration-300
        ${showControls ? "opacity-100" : "opacity-0"}
      `}
        >
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-white/80 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleMuteToggle}
                  className="text-white hover:text-white/80 transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <button
              onClick={handleFullscreen}
              className="text-white hover:text-white/80 transition-colors"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>

        <style jsx>{`
          .slider::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
          }
          .slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            border: none;
          }
        `}</style>
      </div>
    </div>
  );
}
