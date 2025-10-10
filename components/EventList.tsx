"use client";

import { useState, useCallback } from "react";
import {
  Trophy,
  Target,
  RotateCcw,
  AlertTriangle,
  Edit,
  Check,
  X,
  Save,
  Trash2,
} from "lucide-react";
import {
  ConfidenceBadge,
  ConfidenceIndicator,
} from "@/components/ui/ConfidenceBadge";
import type { GameData, GameEvent } from "@/types";
import { usePlayerFilter } from "./PlayerFilterContext";

interface EventListProps {
  gameData: GameData;
  onEventUpdate?: (eventId: string, updates: Partial<GameEvent>) => void;
  onEventDelete?: (eventId: string) => void;
}

export function EventList({
  gameData,
  onEventUpdate,
  onEventDelete,
}: EventListProps) {
  const { selectedPlayer, clearFilter } = usePlayerFilter();
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    "all" | "high_confidence" | "low_confidence" | "2pt_scores" | "3pt_scores"
  >("all");
  const [sortBy, setSortBy] = useState<"timestamp" | "confidence" | "type">(
    "timestamp"
  );
  const [editForm, setEditForm] = useState<Partial<GameEvent>>({});

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "score":
      case "dunk":
      case "3pt":
        return <Trophy className="w-4 h-4 text-green-600" />;
      case "shot_attempt":
      case "missed_shot":
      case "foul_shot":
        return <Target className="w-4 h-4 text-blue-600" />;
      case "layup":
        return <Trophy className="w-4 h-4 text-green-500" />;
      case "offensive_rebound":
      case "defensive_rebound":
        return <RotateCcw className="w-4 h-4 text-orange-600" />;
      case "block":
      case "steal":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "assist":
      case "pass":
        return <RotateCcw className="w-4 h-4 text-blue-600" />;
      case "turnover":
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "dribble":
        return <Target className="w-4 h-4 text-gray-500" />;
      default:
        return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "score":
      case "dunk":
      case "3pt":
      case "layup":
        return "bg-green-50 border-green-200";
      case "shot_attempt":
      case "missed_shot":
      case "foul_shot":
        return "bg-blue-50 border-blue-200";
      case "offensive_rebound":
      case "defensive_rebound":
        return "bg-orange-50 border-orange-200";
      case "block":
      case "steal":
        return "bg-red-50 border-red-200";
      case "assist":
      case "pass":
        return "bg-blue-50 border-blue-200";
      case "turnover":
        return "bg-orange-50 border-orange-200";
      case "dribble":
        return "bg-gray-50 border-gray-200";
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
    // Apply player filter first
    if (selectedPlayer.playerId && selectedPlayer.teamId) {
      if (
        event.playerId !== selectedPlayer.playerId ||
        event.teamId !== selectedPlayer.teamId
      ) {
        return false;
      }
    }

    // Then apply confidence/type filters
    if (filter === "high_confidence") return event.confidence >= 0.5;
    if (filter === "low_confidence") return event.confidence < 0.5;
    if (filter === "2pt_scores")
      return event.type === "score" && event.shotType === "2pt";
    if (filter === "3pt_scores")
      return event.type === "score" && event.shotType === "3pt";
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

  const handleEditEvent = useCallback(
    (eventId: string) => {
      const event = gameData.events.find((e) => e.id === eventId);
      if (event) {
        setEditingEvent(eventId);
        setEditForm({
          type: event.type,
          teamId: event.teamId,
          timestamp: event.timestamp,
          confidence: event.confidence,
          scoreDelta: event.scoreDelta,
          notes: event.notes,
        });
      }
    },
    [gameData.events]
  );

  const handleSaveEdit = useCallback(
    (eventId: string) => {
      if (onEventUpdate) {
        onEventUpdate(eventId, editForm);
      }
      setEditingEvent(null);
      setEditForm({});
    },
    [editForm, onEventUpdate]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingEvent(null);
    setEditForm({});
  }, []);

  const handleDeleteEvent = useCallback(
    (eventId: string) => {
      if (
        onEventDelete &&
        confirm("Are you sure you want to delete this event?")
      ) {
        onEventDelete(eventId);
      }
    },
    [onEventDelete]
  );

  const handleFormChange = useCallback((field: keyof GameEvent, value: any) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  return (
    <div className="space-y-6">
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
          <button
            onClick={() => setFilter("2pt_scores")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "2pt_scores" ? "bg-green-600 text-white" : "bg-muted"
            }`}
          >
            2-Point Scores
          </button>
          <button
            onClick={() => setFilter("3pt_scores")}
            className={`px-3 py-1 rounded text-sm ${
              filter === "3pt_scores" ? "bg-orange-600 text-white" : "bg-muted"
            }`}
          >
            3-Point Scores
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
                      {event.shotType && (
                        <span
                          className={`ml-2 text-xs px-2 py-1 rounded-full font-semibold ${
                            event.shotType === "3pt"
                              ? "bg-orange-200 text-orange-800 border border-orange-300"
                              : "bg-green-200 text-green-800 border border-green-300"
                          }`}
                        >
                          {event.shotType}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {team?.label} • {formatTime(event.timestamp)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <ConfidenceIndicator
                    confidence={event.confidence}
                    source={event.source}
                    notes={event.notes}
                  />

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
                <div className="mt-4 p-4 bg-muted/30 border rounded-lg">
                  <h4 className="font-medium mb-3">Edit Event</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Event Type */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Event Type
                      </label>
                      <select
                        value={editForm.type || event.type}
                        onChange={(e) =>
                          handleFormChange("type", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <option value="shot_attempt">Shot Attempt</option>
                        <option value="score">Score</option>
                        <option value="missed_shot">Missed Shot</option>
                        <option value="offensive_rebound">
                          Offensive Rebound
                        </option>
                        <option value="defensive_rebound">
                          Defensive Rebound
                        </option>
                        <option value="turnover">Turnover</option>
                        <option value="steal">Steal</option>
                        <option value="3pt">3-Point Shot</option>
                        <option value="long_distance_attempt">
                          Long Distance Attempt
                        </option>
                      </select>
                    </div>

                    {/* Team */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Team
                      </label>
                      <select
                        value={editForm.teamId || event.teamId}
                        onChange={(e) =>
                          handleFormChange("teamId", e.target.value)
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        {gameData.teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Timestamp */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Timestamp (seconds)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editForm.timestamp || event.timestamp}
                        onChange={(e) =>
                          handleFormChange(
                            "timestamp",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Confidence */}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Confidence (0-1)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={editForm.confidence || event.confidence}
                        onChange={(e) =>
                          handleFormChange(
                            "confidence",
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {/* Score Delta (only for score events) */}
                    {(editForm.type === "score" || event.type === "score") && (
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Score Delta
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="3"
                          value={editForm.scoreDelta || event.scoreDelta || ""}
                          onChange={(e) =>
                            handleFormChange(
                              "scoreDelta",
                              parseInt(e.target.value)
                            )
                          }
                          className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    )}

                    {/* Notes */}
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium mb-1">
                        Notes
                      </label>
                      <textarea
                        value={editForm.notes || event.notes || ""}
                        onChange={(e) =>
                          handleFormChange("notes", e.target.value)
                        }
                        rows={2}
                        className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                        placeholder="Add notes about this event..."
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleSaveEdit(event.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => handleCancelEdit()}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm ml-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
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
