"use client";

import { useState, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Target,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import type { GameData, VideoFile } from "@/types";

interface EventTimelineProps {
  gameData: GameData;
  videoFile: VideoFile;
}

export function EventTimeline({ gameData, videoFile }: EventTimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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
        if (!isPlaying) {
          videoRef.current.play();
          setIsPlaying(true);
        }
      }
    },
    [isPlaying]
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

  const sortedEvents = [...gameData.events].sort(
    (a, b) => a.timestamp - b.timestamp
  );

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

        {/* Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={handlePlayPause}
            className="bg-black/50 text-white rounded-full p-3 hover:bg-black/70 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>
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
                    {getEventIcon(event.type)}
                    <div>
                      <div className="font-medium capitalize">
                        {event.type.replace("_", " ")}
                        {event.scoreDelta && ` (+${event.scoreDelta})`}
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
