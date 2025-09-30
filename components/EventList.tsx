"use client";

import { useState } from "react";
import {
  Trophy,
  Target,
  RotateCcw,
  AlertTriangle,
  Edit,
  Check,
  X,
} from "lucide-react";
import type { GameData } from "@/types";

interface EventListProps {
  gameData: GameData;
}

export function EventList({ gameData }: EventListProps) {
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "high_confidence" | "low_confidence"
  >("all");
  const [sortBy, setSortBy] = useState<"timestamp" | "confidence" | "type">(
    "timestamp"
  );

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
        return "bg-green-50 border-green-200";
      case "shot_attempt":
      case "missed_shot":
        return "bg-blue-50 border-blue-200";
      case "offensive_rebound":
      case "defensive_rebound":
        return "bg-orange-50 border-orange-200";
      case "turnover":
      case "steal":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const filteredEvents = gameData.events.filter((event) => {
    if (filter === "high_confidence") return event.confidence >= 0.5;
    if (filter === "low_confidence") return event.confidence < 0.5;
    return true;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortBy) {
      case "timestamp":
        return a.timestamp - b.timestamp;
      case "confidence":
        return b.confidence - a.confidence;
      case "type":
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  const handleEditEvent = (eventId: string) => {
    setEditingEvent(eventId);
  };

  const handleSaveEdit = (eventId: string) => {
    // TODO: Implement event editing functionality
    setEditingEvent(null);
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter("high_confidence")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "high_confidence"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            High Confidence
          </button>
          <button
            onClick={() => setFilter("low_confidence")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "low_confidence"
                ? "bg-primary text-primary-foreground"
                : "bg-muted"
            }`}
          >
            Low Confidence
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="timestamp">Time</option>
            <option value="confidence">Confidence</option>
            <option value="type">Type</option>
          </select>
        </div>
      </div>

      {/* Event List */}
      <div className="space-y-2">
        {sortedEvents.map((event) => {
          const team = gameData.teams.find((t) => t.id === event.teamId);
          const isLowConfidence = event.confidence < 0.5;
          const isEditing = editingEvent === event.id;

          return (
            <div
              key={event.id}
              className={`border rounded-lg p-4 ${getEventColor(event.type)} ${
                isLowConfidence ? "border-yellow-300" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getEventIcon(event.type)}
                  <div>
                    <div className="font-medium capitalize">
                      {event.type.replace("_", " ")}
                      {event.scoreDelta && ` (+${event.scoreDelta})`}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {team?.label} • {formatTime(event.timestamp)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isLowConfidence && (
                    <div className="flex items-center gap-1 text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Low Confidence</span>
                    </div>
                  )}

                  <div className="text-sm">
                    {Math.round(event.confidence * 100)}%
                  </div>

                  <div className="flex gap-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(event.id)}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEditEvent(event.id)}
                        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {event.notes && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {event.notes}
                </div>
              )}

              {isEditing && (
                <div className="mt-4 p-3 bg-white border rounded">
                  <div className="text-sm text-muted-foreground mb-2">
                    Event editing functionality will be implemented in future
                    updates.
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Event Type
                      </label>
                      <select className="w-full px-2 py-1 border rounded text-xs">
                        <option value={event.type}>{event.type}</option>
                        <option value="shot_attempt">Shot Attempt</option>
                        <option value="score">Score</option>
                        <option value="rebound">Rebound</option>
                        <option value="turnover">Turnover</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Team
                      </label>
                      <select className="w-full px-2 py-1 border rounded text-xs">
                        {gameData.teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedEvents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No events found matching the current filter.
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Event Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Total Events</div>
            <div className="font-semibold">{gameData.events.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">High Confidence</div>
            <div className="font-semibold text-green-600">
              {gameData.events.filter((e) => e.confidence >= 0.5).length}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Low Confidence</div>
            <div className="font-semibold text-yellow-600">
              {gameData.events.filter((e) => e.confidence < 0.5).length}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg. Confidence</div>
            <div className="font-semibold">
              {Math.round(
                (gameData.events.reduce((sum, e) => sum + e.confidence, 0) /
                  gameData.events.length) *
                  100
              )}
              %
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
