"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import type { GameData } from "@/types";

interface StatisticsChartsProps {
  gameData: GameData;
}

export function StatisticsCharts({ gameData }: StatisticsChartsProps) {
  const teamA = gameData.teams[0];
  const teamB = gameData.teams[1];
  const summaryA = gameData.summary[teamA.id];
  const summaryB = gameData.summary[teamB.id];

  // Prepare data for charts
  const teamComparisonData = [
    {
      category: "Points",
      [teamA.label]: summaryA.points,
      [teamB.label]: summaryB.points,
    },
    {
      category: "Shot Attempts",
      [teamA.label]: summaryA.shotAttempts,
      [teamB.label]: summaryB.shotAttempts,
    },
    {
      category: "Off. Rebounds",
      [teamA.label]: summaryA.offRebounds,
      [teamB.label]: summaryB.offRebounds,
    },
    {
      category: "Def. Rebounds",
      [teamA.label]: summaryA.defRebounds,
      [teamB.label]: summaryB.defRebounds,
    },
    {
      category: "Turnovers",
      [teamA.label]: summaryA.turnovers,
      [teamB.label]: summaryB.turnovers,
    },
  ];

  const eventTypeData = [
    {
      name: "Shot Attempts",
      value: gameData.events.filter((e) => e.type === "shot_attempt").length,
      color: "#3b82f6",
    },
    {
      name: "Scores",
      value: gameData.events.filter((e) => e.type === "score").length,
      color: "#10b981",
    },
    {
      name: "Rebounds",
      value: gameData.events.filter(
        (e) => e.type === "offensive_rebound" || e.type === "defensive_rebound"
      ).length,
      color: "#f59e0b",
    },
    {
      name: "Turnovers",
      value: gameData.events.filter(
        (e) => e.type === "turnover" || e.type === "steal"
      ).length,
      color: "#ef4444",
    },
  ];

  // Score progression over time
  const scoreProgression = gameData.events
    .filter((e) => e.type === "score")
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((acc, event) => {
      const team = gameData.teams.find((t) => t.id === event.teamId);
      if (!team) return acc;

      const lastEntry = acc[acc.length - 1];
      const newEntry = {
        timestamp: event.timestamp,
        [teamA.label]: lastEntry ? lastEntry[teamA.label] : 0,
        [teamB.label]: lastEntry ? lastEntry[teamB.label] : 0,
      };
      newEntry[team.label] += event.scoreDelta || 0;
      acc.push(newEntry);
      return acc;
    }, [] as any[]);

  const formatTime = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60);
    const seconds = Math.floor(timestamp % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8">
      {/* Team Comparison Bar Chart */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          Team Statistics Comparison
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={teamComparisonData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Bar dataKey={teamA.label} fill={teamA.color} />
            <Bar dataKey={teamB.label} fill={teamB.color} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Event Distribution Pie Chart */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Event Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={eventTypeData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {eventTypeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Score Progression Line Chart */}
      {scoreProgression.length > 0 && (
        <div className="bg-card border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Score Progression</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scoreProgression}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => `Time: ${formatTime(value)}`}
              />
              <Line
                type="monotone"
                dataKey={teamA.label}
                stroke={teamA.color}
                strokeWidth={2}
                dot={{ fill: teamA.color }}
              />
              <Line
                type="monotone"
                dataKey={teamB.label}
                stroke={teamB.color}
                strokeWidth={2}
                dot={{ fill: teamB.color }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Confidence Distribution */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          Event Confidence Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {gameData.events.filter((e) => e.confidence >= 0.8).length}
            </div>
            <div className="text-sm text-muted-foreground">
              High Confidence (≥80%)
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {
                gameData.events.filter(
                  (e) => e.confidence >= 0.5 && e.confidence < 0.8
                ).length
              }
            </div>
            <div className="text-sm text-muted-foreground">
              Medium Confidence (50-79%)
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {gameData.events.filter((e) => e.confidence < 0.5).length}
            </div>
            <div className="text-sm text-muted-foreground">
              Low Confidence (&lt;50%)
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Quality Metrics */}
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Quality</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Detection Sources</h4>
            <div className="space-y-2">
              {Object.entries(
                gameData.events.reduce((acc, event) => {
                  acc[event.source] = (acc[event.source] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([source, count]) => (
                <div key={source} className="flex justify-between text-sm">
                  <span className="capitalize">{source.replace("_", " ")}</span>
                  <span>{count} events</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Average Confidence</h4>
            <div className="text-3xl font-bold text-primary">
              {Math.round(
                (gameData.events.reduce(
                  (sum, event) => sum + event.confidence,
                  0
                ) /
                  gameData.events.length) *
                  100
              )}
              %
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Overall detection confidence
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
