"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Target,
  Trophy,
  AlertTriangle,
  Clock,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import type { GameData, VideoFile } from "@/types";
import { usePlayerFilter } from "./PlayerFilterContext";

interface EventTimelineProps {
  gameData: GameData;
  videoFile: VideoFile;
  onSeekToTime?: (time: number) => void;
}

export function EventTimeline({
  gameData,
  videoFile,
  onSeekToTime,
}: EventTimelineProps) {
  const { selectedPlayer, clearFilter } = usePlayerFilter();
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getEventIcon = (eventType: string, shotType?: string) => {
    switch (eventType) {
      case "score":
        if (shotType === "3pt") {
          return <Trophy className="w-4 h-4 text-orange-600" />; // Orange for 3-pointers
        }
        return <Trophy className="w-4 h-4 text-green-600" />; // Green for 2-pointers
      case "shot_attempt":
      case "missed_shot":
        return <Target className="w-4 h-4 text-blue-600" />;
      case "offensive_rebound":
      case "defensive_rebound":
        return <RotateCcw className="w-4 h-4 text-orange-600" />;
      case "turnover":
      case "steal":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "score":
        return "bg-green-100 border-green-300 text-green-800";
      case "shot_attempt":
      case "missed_shot":
        return "bg-blue-100 border-blue-300 text-blue-800";
      case "offensive_rebound":
      case "defensive_rebound":
        return "bg-orange-100 border-orange-300 text-orange-800";
      case "turnover":
      case "steal":
        return "bg-red-100 border-red-300 text-red-800";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  const handleEventClick = useCallback(
    (event: any) => {
      setSelectedEvent(event.id);

      // Seek video to event time
      if (videoRef.current) {
        videoRef.current.currentTime = event.timestamp;
        setCurrentTime(event.timestamp);
        if (!isPlaying) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      }

      // Call parent callback if provided
      if (onSeekToTime) {
        onSeekToTime(event.timestamp);
      }
    },
    [isPlaying, onSeekToTime]
  );

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

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleSkipBackward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.max(0, currentTime - 10);
      handleSeek(newTime);
    }
  }, [currentTime, handleSeek]);

  const handleSkipForward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.min(duration, currentTime + 10);
      handleSeek(newTime);
    }
  }, [currentTime, duration, handleSeek]);

  // Update current time as video plays
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("loadedmetadata", updateDuration);

    return () => {
      video.removeEventListener("timeupdate", updateTime);
      video.removeEventListener("loadedmetadata", updateDuration);
    };
  }, []);

  // Filter events by player if a player is selected
  const filteredEvents = useMemo(() => {
    let events = [...gameData.events];

    if (selectedPlayer.playerId && selectedPlayer.teamId) {
      events = events.filter(
        (e) =>
          e.playerId === selectedPlayer.playerId &&
          e.teamId === selectedPlayer.teamId
      );
    }

    return events;
  }, [gameData.events, selectedPlayer]);

  const sortedEvents = filteredEvents.sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="space-y-6">
      {/* Video Player */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoFile.url}
          className="w-full h-auto max-h-[40vh]"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Enhanced Video Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center gap-4">
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              className="bg-white/20 text-white rounded-full p-2 hover:bg-white/30 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            {/* Skip Buttons */}
            <button
              onClick={handleSkipBackward}
              className="bg-white/20 text-white rounded-full p-2 hover:bg-white/30 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={handleSkipForward}
              className="bg-white/20 text-white rounded-full p-2 hover:bg-white/30 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Time Display */}
            <div className="flex items-center gap-2 text-white text-sm">
              <Clock className="w-4 h-4" />
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 relative">
              <div className="w-full h-2 bg-white/30 rounded-full">
                <div
                  className="h-2 bg-white rounded-full transition-all duration-100"
                  style={{
                    width: `${
                      duration > 0 ? (currentTime / duration) * 100 : 0
                    }%`,
                  }}
                />
              </div>
              {/* Event Markers on Progress Bar */}
              {sortedEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className={`absolute top-1/2 transform -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white transition-all hover:scale-125 ${
                    selectedEvent === event.id ? "ring-2 ring-yellow-400" : ""
                  }`}
                  style={{ left: `${(event.timestamp / duration) * 100}%` }}
                  title={`${event.type} at ${formatTime(event.timestamp)}`}
                >
                  <div
                    className={`w-full h-full rounded-full ${getEventColor(
                      event.type
                    )
                      .split(" ")[0]
                      .replace("bg-", "bg-")
                      .replace("-100", "-500")}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Player Filter Indicator */}
      {selectedPlayer.playerId && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="font-medium">
              Filtered by Player #{selectedPlayer.playerId} (
              {
                gameData.teams.find((t) => t.id === selectedPlayer.teamId)
                  ?.label
              }
              )
            </span>
          </div>
          <button
            onClick={clearFilter}
            className="text-primary hover:text-primary/80 transition-colors flex items-center gap-1 text-sm"
          >
            <X className="w-4 h-4" />
            Clear Filter
          </button>
        </div>
      )}

      {/* Visual Timeline */}
      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Event Timeline</h3>
        <div className="relative">
          <div className="h-16 bg-gray-100 rounded-lg relative overflow-hidden">
            {/* Timeline Background */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Event Markers */}
            {sortedEvents.map((event) => {
              const position = (event.timestamp / duration) * 100;
              const team = gameData.teams.find((t) => t.id === event.teamId);
              const isSelected = selectedEvent === event.id;

              // Create enhanced tooltip with shot type info
              let tooltipText = `${event.type.replace("_", " ")} - ${
                team?.label
              } at ${formatTime(event.timestamp)}`;
              if (event.type === "score") {
                tooltipText += ` (+${event.scoreDelta}${
                  event.shotType ? ` - ${event.shotType}` : ""
                })`;
              }

              return (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className={`absolute top-1/2 transform -translate-y-1/2 transition-all hover:scale-110 ${
                    isSelected ? "z-10" : ""
                  }`}
                  style={{ left: `${position}%` }}
                  title={tooltipText}
                >
                  <div className={`relative ${isSelected ? "scale-125" : ""}`}>
                    {getEventIcon(event.type, event.shotType)}
                    <div
                      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        isSelected ? "ring-2 ring-yellow-400" : ""
                      }`}
                      style={{ backgroundColor: team?.color }}
                    />
                    {/* Shot type indicator for score events */}
                    {event.type === "score" && event.shotType && (
                      <div
                        className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full text-xs font-bold ${
                          event.shotType === "3pt"
                            ? "bg-orange-500"
                            : "bg-green-500"
                        }`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Timeline Labels */}
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0:00</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Game Timeline</h3>
          <div className="text-sm text-muted-foreground">
            {sortedEvents.length} events detected
          </div>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sortedEvents.map((event) => {
            const team = gameData.teams.find((t) => t.id === event.teamId);
            const isSelected = selectedEvent === event.id;
            const isLowConfidence = event.confidence < 0.5;

            return (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-colors
                  ${isSelected ? "ring-2 ring-primary" : "hover:bg-muted/50"}
                  ${getEventColor(event.type)}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getEventIcon(event.type, event.shotType)}
                    <div>
                      <div className="font-medium capitalize">
                        {event.type.replace("_", " ")}
                        {event.scoreDelta && ` (+${event.scoreDelta})`}
                        {event.shotType && (
                          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                            {event.shotType}
                          </span>
                        )}
                      </div>
                      <div className="text-sm opacity-75">
                        {team?.label} • {formatTime(event.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLowConfidence && (
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    )}
                    <div className="text-sm">
                      {Math.round(event.confidence * 100)}%
                    </div>
                  </div>
                </div>

                {event.notes && (
                  <div className="mt-2 text-sm opacity-75">{event.notes}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Details */}
      {selectedEvent && (
        <div className="bg-card border rounded-lg p-4">
          <h4 className="font-medium mb-2">Event Details</h4>
          {(() => {
            const event = gameData.events.find((e) => e.id === selectedEvent);
            if (!event) return null;

            return (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2 capitalize">
                      {event.type.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Team:</span>
                    <span className="ml-2">
                      {gameData.teams.find((t) => t.id === event.teamId)
                        ?.label || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timestamp:</span>
                    <span className="ml-2">{formatTime(event.timestamp)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confidence:</span>
                    <span className="ml-2">
                      {Math.round(event.confidence * 100)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <span className="ml-2">{event.source}</span>
                  </div>
                  {event.scoreDelta && (
                    <div>
                      <span className="text-muted-foreground">
                        Score Change:
                      </span>
                      <span className="ml-2">+{event.scoreDelta}</span>
                    </div>
                  )}
                </div>
                {event.notes && (
                  <div>
                    <span className="text-muted-foreground">Notes:</span>
                    <span className="ml-2">{event.notes}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
