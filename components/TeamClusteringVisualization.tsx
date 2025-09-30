"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Palette, Target } from "lucide-react";
import type { GameData, DetectionResult } from "@/types";

interface TeamClusteringVisualizationProps {
  gameData: GameData | null;
  detections: DetectionResult[];
}

export function TeamClusteringVisualization({
  gameData,
  detections,
}: TeamClusteringVisualizationProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [teamStats, setTeamStats] = useState<{
    teamA: { count: number; avgConfidence: number; color: string };
    teamB: { count: number; avgConfidence: number; color: string };
  } | null>(null);

  const calculateTeamStats = useCallback(() => {
    if (!gameData) return;

    const teamACounts: number[] = [];
    const teamBCounts: number[] = [];

    detections.forEach((detection) => {
      detection.detections.forEach((person) => {
        if (person.teamId === "teamA") {
          teamACounts.push(person.confidence);
        } else if (person.teamId === "teamB") {
          teamBCounts.push(person.confidence);
        }
      });
    });

    const teamA = gameData.teams.find((t) => t.id === "teamA");
    const teamB = gameData.teams.find((t) => t.id === "teamB");

    setTeamStats({
      teamA: {
        count: teamACounts.length,
        avgConfidence:
          teamACounts.length > 0
            ? teamACounts.reduce((sum, conf) => sum + conf, 0) /
              teamACounts.length
            : 0,
        color: teamA?.color || "#0033cc",
      },
      teamB: {
        count: teamBCounts.length,
        avgConfidence:
          teamBCounts.length > 0
            ? teamBCounts.reduce((sum, conf) => sum + conf, 0) /
              teamBCounts.length
            : 0,
        color: teamB?.color || "#cc0000",
      },
    });
  }, [gameData, detections]);

  useEffect(() => {
    if (gameData && detections.length > 0) {
      calculateTeamStats();
    }
  }, [gameData, detections, calculateTeamStats]);

  if (!gameData || !teamStats) return null;

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Team Detection Results</h3>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {showDetails ? "Hide" : "Show"} Details
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team A */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: teamStats.teamA.color }}
            />
            <span className="font-medium">
              {gameData.teams.find((t) => t.id === "teamA")?.label || "Team A"}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Detections:</span>
              <span className="font-semibold">{teamStats.teamA.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg. Confidence:</span>
              <span className="font-semibold">
                {Math.round(teamStats.teamA.avgConfidence * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Team B */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: teamStats.teamB.color }}
            />
            <span className="font-medium">
              {gameData.teams.find((t) => t.id === "teamB")?.label || "Team B"}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Detections:</span>
              <span className="font-semibold">{teamStats.teamB.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg. Confidence:</span>
              <span className="font-semibold">
                {Math.round(teamStats.teamB.avgConfidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-6 space-y-4">
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Color Clustering Analysis
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground mb-2">
                  Team A Color Profile:
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: teamStats.teamA.color }}
                    />
                    <span>Primary: {teamStats.teamA.color}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on {teamStats.teamA.count} jersey color samples
                  </div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground mb-2">
                  Team B Color Profile:
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: teamStats.teamB.color }}
                    />
                    <span>Primary: {teamStats.teamB.color}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Based on {teamStats.teamB.count} jersey color samples
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Detection Quality
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Total Person Detections:
                </span>
                <span className="font-semibold">
                  {teamStats.teamA.count + teamStats.teamB.count}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Successfully Clustered:
                </span>
                <span className="font-semibold">
                  {Math.round(
                    ((teamStats.teamA.count + teamStats.teamB.count) /
                      (teamStats.teamA.count + teamStats.teamB.count)) *
                      100
                  )}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Overall Confidence:
                </span>
                <span className="font-semibold">
                  {Math.round(
                    ((teamStats.teamA.avgConfidence +
                      teamStats.teamB.avgConfidence) /
                      2) *
                      100
                  )}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
