"use client";

import { Trophy, Target, RotateCcw, AlertTriangle } from "lucide-react";
import type { GameData } from "@/types";

interface GameSummaryProps {
  gameData: GameData;
}

export function GameSummary({ gameData }: GameSummaryProps) {
  const teamA = gameData.teams[0];
  const teamB = gameData.teams[1];
  const summaryA = gameData.summary[teamA.id];
  const summaryB = gameData.summary[teamB.id];

  const getTeamColor = (teamId: string) => {
    const team = gameData.teams.find((t) => t.id === teamId);
    return team?.color || "#6b7280";
  };

  const getEventCount = (eventType: string) => {
    return gameData.events.filter((e) => e.type === eventType).length;
  };

  const getTeamEventCount = (teamId: string, eventType: string) => {
    return gameData.events.filter(
      (e) => e.teamId === teamId && e.type === eventType
    ).length;
  };

  const getLowConfidenceEvents = () => {
    return gameData.events.filter((e) => e.confidence < 0.5).length;
  };

  return (
    <div className="space-y-6">
      {/* Game Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team A */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getTeamColor(teamA.id) }}
            />
            <h3 className="text-lg font-semibold">{teamA.label}</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Points</span>
              <span className="text-2xl font-bold">{summaryA.points}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Shot Attempts</div>
                <div className="font-semibold">{summaryA.shotAttempts}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Off. Rebounds</div>
                <div className="font-semibold">{summaryA.offRebounds}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Def. Rebounds</div>
                <div className="font-semibold">{summaryA.defRebounds}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Turnovers</div>
                <div className="font-semibold">{summaryA.turnovers}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Team B */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getTeamColor(teamB.id) }}
            />
            <h3 className="text-lg font-semibold">{teamB.label}</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Points</span>
              <span className="text-2xl font-bold">{summaryB.points}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Shot Attempts</div>
                <div className="font-semibold">{summaryB.shotAttempts}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Off. Rebounds</div>
                <div className="font-semibold">{summaryB.offRebounds}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Def. Rebounds</div>
                <div className="font-semibold">{summaryB.defRebounds}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Turnovers</div>
                <div className="font-semibold">{summaryB.turnovers}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Game Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-600" />
            <span className="font-medium">Total Events</span>
          </div>
          <div className="text-2xl font-bold">{gameData.events.length}</div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="font-medium">Shot Attempts</span>
          </div>
          <div className="text-2xl font-bold">
            {getEventCount("shot_attempt")}
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-4 h-4 text-green-600" />
            <span className="font-medium">Rebounds</span>
          </div>
          <div className="text-2xl font-bold">
            {getEventCount("offensive_rebound") +
              getEventCount("defensive_rebound")}
          </div>
        </div>
      </div>

      {/* Quality Indicators */}
      {getLowConfidenceEvents() > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="font-medium text-yellow-800">
              Low Confidence Events
            </span>
          </div>
          <p className="text-sm text-yellow-700">
            {getLowConfidenceEvents()} events were detected with low confidence.
            Review the Events tab to verify and correct these detections.
          </p>
        </div>
      )}

      {/* Video Info */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-medium mb-2">Analysis Details</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Video Duration:</span>
            <span className="ml-2">{Math.round(gameData.video.duration)}s</span>
          </div>
          <div>
            <span className="text-muted-foreground">Events Detected:</span>
            <span className="ml-2">{gameData.events.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">High Confidence:</span>
            <span className="ml-2">
              {gameData.events.filter((e) => e.confidence >= 0.5).length}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Low Confidence:</span>
            <span className="ml-2">{getLowConfidenceEvents()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
