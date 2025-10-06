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
  Area,
  AreaChart,
  Scatter,
  ScatterChart,
  ComposedChart,
  Legend,
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

  // Enhanced data processing
  const eventTypeCounts = gameData.events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const teamEventCounts = gameData.events.reduce((acc, event) => {
    const team = gameData.teams.find((t) => t.id === event.teamId);
    if (!team) return acc;

    if (!acc[team.label]) {
      acc[team.label] = {};
    }
    acc[team.label][event.type] = (acc[team.label][event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  // Prepare data for charts
  const teamComparisonData = [
    {
      category: "Points",
      [teamA.label]: summaryA.points,
      [teamB.label]: summaryB.points,
    },
    {
      category: "2-Point Scores",
      [teamA.label]: summaryA.twoPointScores,
      [teamB.label]: summaryB.twoPointScores,
    },
    {
      category: "3-Point Scores",
      [teamA.label]: summaryA.threePointScores,
      [teamB.label]: summaryB.threePointScores,
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
      name: "2-Point Scores",
      value: gameData.events.filter(
        (e) => e.type === "score" && e.shotType === "2pt"
      ).length,
      color: "#10b981",
    },
    {
      name: "3-Point Scores",
      value: gameData.events.filter(
        (e) => e.type === "score" && e.shotType === "3pt"
      ).length,
      color: "#ff9500",
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
        shotType: event.shotType || "unknown",
        teamId: event.teamId,
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
    <div className="space-y-6">
      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Comparison Bar Chart */}
        <div className="bg-card border rounded-lg p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">
            Team Statistics Comparison
          </h3>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={teamComparisonData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="category"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey={teamA.label}
                  fill={teamA.color}
                  name={teamA.label}
                />
                <Bar
                  dataKey={teamB.label}
                  fill={teamB.color}
                  name={teamB.label}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Breakdown Chart */}
        <div className="bg-card border rounded-lg p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    category: "2-Point Scores",
                    [teamA.label]: summaryA.twoPointScores,
                    [teamB.label]: summaryB.twoPointScores,
                  },
                  {
                    category: "3-Point Scores",
                    [teamA.label]: summaryA.threePointScores,
                    [teamB.label]: summaryB.threePointScores,
                  },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Legend />
                <Bar
                  dataKey={teamA.label}
                  fill={teamA.color}
                  name={teamA.label}
                />
                <Bar
                  dataKey={teamB.label}
                  fill={teamB.color}
                  name={teamB.label}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Event Distribution and Score Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Distribution Pie Chart */}
        <div className="bg-card border rounded-lg p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Event Distribution</h3>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Progression Line Chart */}
        {scoreProgression.length > 0 && (
          <div className="bg-card border rounded-lg p-4 lg:p-6">
            <h3 className="text-lg font-semibold mb-4">Score Progression</h3>
            <div className="h-64 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={scoreProgression}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => `Time: ${formatTime(value)}`}
                    formatter={(value, name, props) => {
                      const shotType = props.payload?.shotType;
                      const teamId = props.payload?.teamId;
                      const team = gameData.teams.find((t) => t.id === teamId);
                      const shotTypeText =
                        shotType && shotType !== "unknown"
                          ? ` (${shotType})`
                          : "";
                      return [
                        `${value} points${shotTypeText}`,
                        team?.label || name,
                      ];
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={teamA.label}
                    stroke={teamA.color}
                    strokeWidth={2}
                    dot={{ fill: teamA.color, r: 4 }}
                    name={teamA.label}
                  />
                  <Line
                    type="monotone"
                    dataKey={teamB.label}
                    stroke={teamB.color}
                    strokeWidth={2}
                    dot={{ fill: teamB.color, r: 4 }}
                    name={teamB.label}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Confidence Distribution and Analysis Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence Distribution */}
        <div className="bg-card border rounded-lg p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">
            Event Confidence Distribution
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">
                  {gameData.events.filter((e) => e.confidence >= 0.8).length}
                </div>
                <div className="text-sm text-green-700">
                  High Confidence (≥80%)
                </div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">
                  {
                    gameData.events.filter(
                      (e) => e.confidence >= 0.5 && e.confidence < 0.8
                    ).length
                  }
                </div>
                <div className="text-sm text-yellow-700">
                  Medium Confidence (50-79%)
                </div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-2xl font-bold text-red-600">
                  {gameData.events.filter((e) => e.confidence < 0.5).length}
                </div>
                <div className="text-sm text-red-700">
                  Low Confidence (&lt;50%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Quality Metrics */}
        <div className="bg-card border rounded-lg p-4 lg:p-6">
          <h3 className="text-lg font-semibold mb-4">Analysis Quality</h3>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Detection Sources</h4>
              <div className="space-y-2">
                {Object.entries(
                  gameData.events.reduce((acc, event) => {
                    acc[event.source] = (acc[event.source] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([source, count]) => (
                  <div
                    key={source}
                    className="flex justify-between items-center p-2 bg-muted/50 rounded"
                  >
                    <span className="capitalize text-sm">
                      {source.replace("_", " ")}
                    </span>
                    <span className="text-sm font-medium">{count} events</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center p-4 bg-primary/10 rounded-lg">
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
    </div>
  );
}
