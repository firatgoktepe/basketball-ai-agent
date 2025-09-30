"use client";

import { useRef, useEffect, useState } from "react";
import type { DetectionResult, GameData } from "@/types";

interface PersonDetectionOverlayProps {
  videoFile: any;
  detections: DetectionResult[];
  gameData: GameData | null;
  currentTime: number;
}

export function PersonDetectionOverlay({
  videoFile,
  detections,
  gameData,
  currentTime,
}: PersonDetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !detections.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find detections for current time
    const currentDetections = detections.filter(
      (d) => Math.abs(d.timestamp - currentTime) < 0.5
    );

    if (currentDetections.length === 0) return;

    // Draw bounding boxes for all detections in current frame
    for (const detection of currentDetections) {
      for (const person of detection.detections) {
        if (person.type === "person") {
          drawPersonBoundingBox(ctx, person, gameData);
        }
      }
    }
  }, [detections, currentTime, gameData]);

  const drawPersonBoundingBox = (
    ctx: CanvasRenderingContext2D,
    person: any,
    gameData: GameData | null
  ) => {
    const [x, y, width, height] = person.bbox;
    const confidence = person.confidence;
    const teamId = person.teamId;

    // Get team color
    let teamColor = "#3b82f6"; // Default blue
    if (gameData && teamId) {
      const team = gameData.teams.find((t) => t.id === teamId);
      if (team) {
        teamColor = team.color;
      }
    }

    // Draw bounding box
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Draw confidence bar
    const barWidth = width;
    const barHeight = 4;
    const confidenceWidth = (confidence * barWidth) / 1.0;

    // Background (low confidence)
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(x, y - barHeight - 2, barWidth, barHeight);

    // Confidence fill
    ctx.fillStyle =
      confidence > 0.7 ? "rgba(0, 255, 0, 0.8)" : "rgba(255, 255, 0, 0.8)";
    ctx.fillRect(x, y - barHeight - 2, confidenceWidth, barHeight);

    // Draw team label
    if (teamId && gameData) {
      const team = gameData.teams.find((t) => t.id === teamId);
      if (team) {
        ctx.fillStyle = teamColor;
        ctx.font = "12px Arial";
        ctx.fillText(team.label, x, y - 8);
      }
    }

    // Draw confidence percentage
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";
    ctx.fillText(`${Math.round(confidence * 100)}%`, x + 4, y + 16);
  };

  if (!isVisible || !detections.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Toggle button */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="bg-black/50 text-white px-3 py-1 rounded text-sm hover:bg-black/70 transition-colors"
        >
          {isVisible ? "Hide" : "Show"} Detections
        </button>
      </div>
    </div>
  );
}
