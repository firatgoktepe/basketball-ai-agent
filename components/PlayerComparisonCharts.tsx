"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { GameData, PlayerSummary } from "@/types";

interface PlayerComparisonChartsProps {
  gameData: GameData;
}

export function PlayerComparisonCharts({
  gameData,
}: PlayerComparisonChartsProps) {
  // Get top players from each team (top 3 by points)
  const topPlayers = useMemo(() => {
    const players: Array<
      PlayerSummary & { teamId: string; teamColor: string }
    > = [];

    gameData.teams.forEach((team) => {
      const teamPlayers = gameData.summary[team.id]?.players || [];
      const topTeamPlayers = teamPlayers
        .sort((a, b) => b.points - a.points)
        .slice(0, 3)
        .map((p) => ({
          ...p,
          teamId: team.id,
          teamColor: team.color,
        }));
      players.push(...topTeamPlayers);
    });

    return players;
  }, [gameData]);

  // Prepare data for Player Statistics Comparison chart
  const statsComparisonData = useMemo(() => {
    return topPlayers.map((player) => {
      const team = gameData.teams.find((t) => t.id === player.teamId);
      return {
        name: `#${player.playerId} (${team?.label || "Unknown"})`,
        Points: player.points,
        Assists: player.assists,
        Rebounds: player.offRebounds + player.defRebounds,
        Blocks: player.blocks,
        teamColor: player.teamColor,
      };
    });
  }, [topPlayers, gameData.teams]);

  // Prepare data for Score Breakdown chart
  const scoreBreakdownData = useMemo(() => {
    return topPlayers.map((player) => {
      const team = gameData.teams.find((t) => t.id === player.teamId);
      return {
        name: `#${player.playerId} (${team?.label || "Unknown"})`,
        "2-Point": player.twoPointScores * 2,
        "3-Point": player.threePointScores * 3,
        "Foul Shots": player.foulShots * 1,
        teamColor: player.teamColor,
      };
    });
  }, [topPlayers, gameData.teams]);

  // Custom colors for score breakdown
  const SCORE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b"];

  if (topPlayers.length === 0) {
    return (
      <div className="bg-muted/20 border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">
          No player data available for comparison charts
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Enable jersey detection to see player comparisons
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-t pt-8">
        <h3 className="text-xl font-bold mb-6 text-center">
          Player Performance Comparison
        </h3>

        {/* Player Statistics Comparison */}
        <div className="bg-card border rounded-lg p-6 mb-8">
          <h4 className="font-semibold mb-4">
            Player Statistics Comparison (Top Players)
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statsComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Points" fill="#3b82f6" />
              <Bar dataKey="Assists" fill="#10b981" />
              <Bar dataKey="Rebounds" fill="#f59e0b" />
              <Bar dataKey="Blocks" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Breakdown Comparison */}
        <div className="bg-card border rounded-lg p-6">
          <h4 className="font-semibold mb-4">Score Breakdown (Top Scorers)</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreBreakdownData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                label={{ value: "Points", angle: -90, position: "insideLeft" }}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="2-Point" stackId="score" fill={SCORE_COLORS[0]} />
              <Bar dataKey="3-Point" stackId="score" fill={SCORE_COLORS[1]} />
              <Bar
                dataKey="Foul Shots"
                stackId="score"
                fill={SCORE_COLORS[2]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Stacked bars show total points from different shot types
          </div>
        </div>
      </div>
    </div>
  );
}
