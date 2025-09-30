"use client";

import { useState, useRef, useCallback } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoUploader } from "@/components/VideoUploader";
import { ProcessingControls } from "@/components/ProcessingControls";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { ScoreboardCropTool } from "@/components/ScoreboardCropTool";
import { AnalysisWorker } from "@/lib/workers/AnalysisWorker";
import { generateDemoGameData } from "@/lib/demo-data";
import type { VideoFile, AnalysisProgress, GameData } from "@/types";

export default function Home() {
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [showCropTool, setShowCropTool] = useState(false);
  const [cropRegion, setCropRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const analysisWorkerRef = useRef<AnalysisWorker | null>(null);

  const handleVideoSelect = useCallback((file: File) => {
    const videoFile: VideoFile = {
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      duration: 0, // Will be set when video loads
    };
    setVideoFile(videoFile);
    setGameData(null);
    setProgress(null);
  }, []);

  // Demo function to load a sample video
  const loadDemoVideo = useCallback(() => {
    console.log("Loading demo video...");
    // Create a demo video file for testing
    const demoVideoFile: VideoFile = {
      file: new File([""], "demo_basketball_game.mp4", { type: "video/mp4" }),
      url: "demo-video.mp4", // Using a reliable sample video URL
      name: "demo_basketball_game.mp4",
      size: 1024 * 1024 * 10, // 10MB
      duration: 125.4,
    };
    console.log("Demo video file created:", demoVideoFile);
    setVideoFile(demoVideoFile);
    setGameData(null);
    setProgress(null);
  }, []);

  const handleStartAnalysis = useCallback(
    async (options: {
      samplingRate: number;
      enableBallDetection: boolean;
      enablePoseEstimation: boolean;
      enable3ptEstimation: boolean;
    }) => {
      if (!videoFile || !cropRegion) return;

      setIsProcessing(true);
      setProgress({
        stage: "initializing",
        progress: 0,
        message: "Initializing analysis...",
      });

      try {
        // Simulate analysis progress with demo data
        const stages = [
          {
            stage: "sampling" as const,
            progress: 20,
            message: "Extracting video frames...",
          },
          {
            stage: "detection" as const,
            progress: 40,
            message: "Detecting players and objects...",
          },
          {
            stage: "ocr" as const,
            progress: 60,
            message: "Reading scoreboard...",
          },
          {
            stage: "fusion" as const,
            progress: 80,
            message: "Processing events...",
          },
          {
            stage: "results" as const,
            progress: 100,
            message: "Generating results...",
          },
        ];

        for (const stage of stages) {
          setProgress(stage);
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate processing time
        }

        // Generate demo data for testing
        const result = generateDemoGameData();
        setGameData(result);
      } catch (error) {
        console.error("Analysis failed:", error);
        setProgress({
          stage: "error",
          progress: 0,
          message: `Analysis failed: ${error}`,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [videoFile, cropRegion]
  );

  const handleCropComplete = useCallback(
    (region: { x: number; y: number; width: number; height: number }) => {
      setCropRegion(region);
      setShowCropTool(false);
    },
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-4">
            Basketball Quick Stats
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            AI-powered basketball game analysis tool. Upload a video, crop the
            scoreboard, and get detailed game statistics automatically extracted
            from the footage.
          </p>
        </header>

        <main className="space-y-8">
          {/* Video Upload Section */}
          {!videoFile && (
            <div className="max-w-2xl mx-auto space-y-4">
              <VideoUploader onVideoSelect={handleVideoSelect} />

              {/* Demo Button */}
              <div className="text-center">
                <button
                  onClick={loadDemoVideo}
                  className="px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors"
                >
                  Load Demo Video (for testing)
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this to test the interface with a sample video
                </p>
              </div>
            </div>
          )}

          {/* Video Player and Controls */}
          {videoFile && (
            <div className="space-y-6">
              <div className="max-w-4xl mx-auto">
                <VideoPlayer
                  videoFile={videoFile}
                  onDurationChange={(duration) => {
                    setVideoFile((prev) =>
                      prev ? { ...prev, duration } : null
                    );
                  }}
                />
              </div>

              {/* Scoreboard Crop Tool */}
              {!cropRegion && !showCropTool && (
                <div className="text-center">
                  <button
                    onClick={() => setShowCropTool(true)}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Crop Scoreboard Region
                  </button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click and drag on the video to select the scoreboard area
                    for OCR analysis
                  </p>
                </div>
              )}

              {showCropTool && (
                <ScoreboardCropTool
                  videoFile={videoFile}
                  onCropComplete={handleCropComplete}
                  onCancel={() => setShowCropTool(false)}
                />
              )}

              {/* Processing Controls */}
              {cropRegion && !isProcessing && !gameData && (
                <ProcessingControls
                  onStartAnalysis={handleStartAnalysis}
                  disabled={!cropRegion}
                />
              )}

              {/* Progress Indicator */}
              {isProcessing && progress && (
                <ProgressIndicator progress={progress} />
              )}

              {/* Results Display */}
              {gameData && (
                <ResultsDisplay gameData={gameData} videoFile={videoFile} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
