"use client";

import { useState, useCallback } from "react";
import {
  Download,
  BarChart3,
  PieChart,
  Clock,
  Users,
  Target,
  FileText,
  Table,
  FileSpreadsheet,
} from "lucide-react";
import { GameSummary } from "./GameSummary";
import { EventTimeline } from "./EventTimeline";
import { StatisticsCharts } from "./StatisticsCharts";
import { EventList } from "./EventList";
import { TeamClusteringVisualization } from "./TeamClusteringVisualization";
import type { GameData, VideoFile, DetectionResult } from "@/types";

interface ResultsDisplayProps {
  gameData: GameData;
  videoFile: VideoFile;
  detections?: DetectionResult[];
}

export function ResultsDisplay({
  gameData,
  videoFile,
  detections,
}: ResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState<
    "summary" | "timeline" | "charts" | "events"
  >("summary");

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const exportToJSON = useCallback(() => {
    // Enhanced JSON export with metadata
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        videoFile: videoFile.name,
        videoDuration: gameData.video.duration,
        totalEvents: gameData.events.length,
        analysisVersion: "1.0.0",
      },
      gameData: gameData,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${videoFile.name.replace(/\.[^/.]+$/, "")}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [gameData, videoFile]);

  const exportToCSV = useCallback(() => {
    // Enhanced CSV export with better formatting
    const headers = [
      "Timestamp",
      "Time (MM:SS)",
      "Event Type",
      "Team",
      "Score Delta",
      "Confidence (%)",
      "Source",
      "Event ID",
      "Notes",
    ];

    const rows = gameData.events.map((event) => [
      event.timestamp.toFixed(1),
      formatTime(event.timestamp),
      event.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      gameData.teams.find((t) => t.id === event.teamId)?.label || "Unknown",
      event.scoreDelta || "",
      (event.confidence * 100).toFixed(1),
      event.source,
      event.id,
      event.notes || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const dataBlob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${videoFile.name.replace(/\.[^/.]+$/, "")}_events.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [gameData, videoFile, formatTime]);

  const exportSummaryToCSV = useCallback(() => {
    // Export team summary statistics to CSV
    const headers = [
      "Team",
      "Points",
      "Shot Attempts",
      "Offensive Rebounds",
      "Defensive Rebounds",
      "Turnovers",
      "Three Point Attempts",
    ];

    const rows = gameData.teams.map((team) => {
      const summary = gameData.summary[team.id];
      return [
        team.label,
        summary.points,
        summary.shotAttempts,
        summary.offRebounds,
        summary.defRebounds,
        summary.turnovers,
        summary.threePointAttempts || 0,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const dataBlob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${videoFile.name.replace(/\.[^/.]+$/, "")}_summary.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [gameData, videoFile]);

  const exportToTextReport = useCallback(() => {
    // Export a human-readable text report
    let report = `Basketball Game Analysis Report\n`;
    report += `================================\n\n`;
    report += `Video File: ${videoFile.name}\n`;
    report += `Duration: ${formatTime(gameData.video.duration)}\n`;
    report += `Analysis Date: ${new Date().toLocaleString()}\n\n`;

    // Team Summary
    report += `TEAM STATISTICS\n`;
    report += `---------------\n`;
    gameData.teams.forEach((team) => {
      const summary = gameData.summary[team.id];
      report += `\n${team.label} Team:\n`;
      report += `  Points: ${summary.points}\n`;
      report += `  Shot Attempts: ${summary.shotAttempts}\n`;
      report += `  Offensive Rebounds: ${summary.offRebounds}\n`;
      report += `  Defensive Rebounds: ${summary.defRebounds}\n`;
      report += `  Turnovers: ${summary.turnovers}\n`;
      if (summary.threePointAttempts) {
        report += `  3-Point Attempts: ${summary.threePointAttempts}\n`;
      }
    });

    // Event Timeline
    report += `\n\nEVENT TIMELINE\n`;
    report += `--------------\n`;
    const sortedEvents = [...gameData.events].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    sortedEvents.forEach((event) => {
      const team = gameData.teams.find((t) => t.id === event.teamId);
      report += `${formatTime(event.timestamp)} - ${event.type
        .replace(/_/g, " ")
        .toUpperCase()}`;
      if (event.scoreDelta) {
        report += ` (+${event.scoreDelta})`;
      }
      report += ` (${team?.label || "Unknown"}) - ${(
        event.confidence * 100
      ).toFixed(1)}%\n`;
    });

    const dataBlob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${videoFile.name.replace(/\.[^/.]+$/, "")}_report.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }, [gameData, videoFile, formatTime]);

  const tabs = [
    { id: "summary", label: "Summary", icon: BarChart3 },
    { id: "timeline", label: "Timeline", icon: Clock },
    { id: "charts", label: "Charts", icon: PieChart },
    { id: "events", label: "Events", icon: Target },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Analysis Complete</h2>
        <p className="text-muted-foreground">
          Game statistics extracted from {videoFile.name}
        </p>
      </div>

      {/* Export Buttons */}
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Export Data</h3>
          <p className="text-sm text-muted-foreground">
            Download your analysis results in various formats
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto">
          <button
            onClick={exportToJSON}
            className="px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
            title="Export complete analysis data as JSON"
          >
            <FileText className="w-4 h-4" />
            JSON
          </button>

          <button
            onClick={exportToCSV}
            className="px-4 py-3 border border-muted-foreground rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            title="Export event timeline as CSV"
          >
            <Table className="w-4 h-4" />
            Events CSV
          </button>

          <button
            onClick={exportSummaryToCSV}
            className="px-4 py-3 border border-muted-foreground rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            title="Export team statistics as CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Summary CSV
          </button>

          <button
            onClick={exportToTextReport}
            className="px-4 py-3 border border-muted-foreground rounded-lg hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm"
            title="Export human-readable report"
          >
            <Download className="w-4 h-4" />
            Text Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "summary" && (
          <div className="space-y-6">
            <GameSummary gameData={gameData} />
            {detections && detections.length > 0 && (
              <TeamClusteringVisualization
                gameData={gameData}
                detections={detections}
              />
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <EventTimeline gameData={gameData} videoFile={videoFile} />
        )}

        {activeTab === "charts" && <StatisticsCharts gameData={gameData} />}

        {activeTab === "events" && (
          <EventList
            gameData={gameData}
            onEventUpdate={(eventId, updates) => {
              // TODO: Implement event updates in parent component
              console.log("Event update:", eventId, updates);
            }}
            onEventDelete={(eventId) => {
              // TODO: Implement event deletion in parent component
              console.log("Event delete:", eventId);
            }}
          />
        )}
      </div>
    </div>
  );
}
