"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { AnalysisProgress } from "@/types";

interface ProgressIndicatorProps {
  progress: AnalysisProgress;
}

const stageLabels = {
  initializing: "Initializing Analysis",
  sampling: "Sampling Video Frames",
  detection: "Detecting Players & Objects",
  ocr: "Reading Scoreboard",
  fusion: "Processing Events",
  results: "Generating Results",
  error: "Error Occurred",
};

const stageDescriptions = {
  initializing: "Setting up analysis models and preparing video processing...",
  sampling: "Extracting frames from video at the selected sampling rate...",
  detection: "Running AI models to detect players, ball, and analyze poses...",
  ocr: "Using OCR to read scoreboard and track score changes...",
  fusion: "Combining all data sources to identify game events...",
  results: "Compiling statistics and generating final results...",
  error: "An error occurred during analysis. Please try again.",
};

export function ProgressIndicator({ progress }: ProgressIndicatorProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress.progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress.progress]);

  const getStageIcon = () => {
    if (progress.stage === "error") {
      return <AlertCircle className="w-6 h-6 text-destructive" />;
    }
    if (progress.stage === "results" && progress.progress === 100) {
      return <CheckCircle className="w-6 h-6 text-green-600" />;
    }
    return <Loader2 className="w-6 h-6 animate-spin text-primary" />;
  };

  const getProgressColor = () => {
    if (progress.stage === "error") return "bg-destructive";
    if (progress.stage === "results" && progress.progress === 100)
      return "bg-green-600";
    return "bg-primary";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card border rounded-lg p-6 space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            {getStageIcon()}
          </div>

          <h3 className="text-lg font-semibold mb-2">
            {stageLabels[progress.stage]}
          </h3>

          <p className="text-muted-foreground text-sm">
            {progress.message || stageDescriptions[progress.stage]}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{Math.round(animatedProgress)}%</span>
          </div>

          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ease-out ${getProgressColor()}`}
              style={{ width: `${animatedProgress}%` }}
            />
          </div>
        </div>

        {/* Stage Progress */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Analysis Stages:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(stageLabels).map(([stage, label]) => {
              const isCompleted =
                (progress.stage as string) === "results" ||
                (stage === "initializing" &&
                  progress.stage !== "initializing") ||
                (stage === "sampling" &&
                  ["detection", "ocr", "fusion", "results"].includes(
                    progress.stage
                  )) ||
                (stage === "detection" &&
                  ["ocr", "fusion", "results"].includes(progress.stage)) ||
                (stage === "ocr" &&
                  ["fusion", "results"].includes(progress.stage)) ||
                (stage === "fusion" &&
                  (progress.stage as string) === "results");

              const isCurrent = progress.stage === stage;

              return (
                <div
                  key={stage}
                  className={`flex items-center gap-2 p-2 rounded ${
                    isCurrent
                      ? "bg-primary/10 text-primary"
                      : isCompleted
                      ? "bg-green-50 text-green-700"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isCurrent
                        ? "bg-primary"
                        : isCompleted
                        ? "bg-green-600"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <span className="truncate">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Performance Info */}
        {progress.stage !== "error" && (
          <div className="text-xs text-muted-foreground text-center">
            Processing is running in the background. You can continue using the
            interface.
          </div>
        )}
      </div>
    </div>
  );
}
