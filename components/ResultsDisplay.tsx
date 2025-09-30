"use client";

import { useState } from "react";
import {
  Download,
  BarChart3,
  PieChart,
  Clock,
  Users,
  Target,
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

  const exportToJSON = () => {
    const dataStr = JSON.stringify(gameData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${videoFile.name.replace(/\.[^/.]+$/, "")}_analysis.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    // Convert events to CSV format
    const headers = [
      "Timestamp",
      "Event Type",
      "Team",
      "Score Delta",
      "Confidence",
      "Source",
      "Notes",
    ];
    const rows = gameData.events.map((event) => [
      event.timestamp.toFixed(1),
      event.type,
      gameData.teams.find((t) => t.id === event.teamId)?.label || "Unknown",
      event.scoreDelta || "",
      (event.confidence * 100).toFixed(1) + "%",
      event.source,
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
  };

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
      <div className="flex justify-center gap-4">
        <button
          onClick={exportToJSON}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export JSON
        </button>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 border border-muted-foreground rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
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

        {activeTab === "events" && <EventList gameData={gameData} />}
      </div>
    </div>
  );
}
