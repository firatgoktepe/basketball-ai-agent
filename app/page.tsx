"use client";

import { useState, useRef, useCallback } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoUploader } from "@/components/VideoUploader";
import { ProcessingControls } from "@/components/ProcessingControls";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { HelpDialog } from "@/components/HelpDialog";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { CropRegion } from "@/types";
import { AnalysisWorker } from "@/lib/workers/AnalysisWorker";
import { generateDemoGameData } from "@/lib/demo-data";
import { handleError } from "@/lib/utils/error-handler";
import type {
  VideoFile,
  AnalysisProgress,
  GameData,
  DetectionResult,
} from "@/types";

export default function Home() {
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [personDetections, setPersonDetections] = useState<DetectionResult[]>(
    []
  );
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);

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

        // Generate mock person detections for visualization
        const mockDetections = generateMockPersonDetections();
        setPersonDetections(mockDetections);
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

  const handleCropRegionChange = useCallback((region: CropRegion | null) => {
    setCropRegion(region);
  }, []);

  const generateMockPersonDetections = (): DetectionResult[] => {
    const detections: DetectionResult[] = [];
    const numFrames = 30; // 30 frames for demo

    for (let i = 0; i < numFrames; i++) {
      const timestamp = i * 2; // 2 seconds per frame
      const numPersons = Math.floor(Math.random() * 3) + 1; // 1-3 persons per frame

      const frameDetections = [];
      for (let j = 0; j < numPersons; j++) {
        const x = Math.random() * 600 + 100;
        const y = Math.random() * 300 + 100;
        const width = 60 + Math.random() * 40;
        const height = 100 + Math.random() * 50;

        frameDetections.push({
          type: "person" as const,
          bbox: [x, y, width, height] as [number, number, number, number],
          confidence: 0.6 + Math.random() * 0.3,
          teamId: Math.random() > 0.5 ? "teamA" : "teamB",
        });
      }

      detections.push({
        frameIndex: i,
        timestamp,
        detections: frameDetections,
      });
    }

    return detections;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-4 sm:py-8">
          <header className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-3 sm:mb-4">
              Basketball Quick Stats
            </h1>
            <p className="text-center text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base px-4">
              AI-powered basketball game analysis tool. Upload a video, crop the
              scoreboard, and get detailed game statistics automatically
              extracted from the footage.
            </p>
          </header>

          <main className="space-y-6 sm:space-y-8">
            {/* Video Upload Section */}
            {!videoFile && (
              <div className="max-w-2xl mx-auto space-y-4 px-4">
                <VideoUploader onVideoSelect={handleVideoSelect} />

                {/* Privacy Notice on Upload Page */}
                <PrivacyNotice />

                {/* Demo Button */}
                <div className="text-center space-y-2">
                  <button
                    onClick={loadDemoVideo}
                    className="px-4 sm:px-6 py-2 sm:py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors text-sm sm:text-base"
                  >
                    Load Demo Video (for testing)
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Use this to test the interface with a sample video
                  </p>
                </div>
              </div>
            )}

            {/* Video Player and Controls */}
            {videoFile && (
              <div className="space-y-4 sm:space-y-6">
                <div className="max-w-4xl mx-auto px-4">
                  <VideoPlayer
                    videoFile={videoFile}
                    detections={personDetections}
                    gameData={gameData}
                    cropRegion={cropRegion}
                    onCropRegionChange={handleCropRegionChange}
                    onDurationChange={(duration) => {
                      setVideoFile((prev) =>
                        prev ? { ...prev, duration } : null
                      );
                    }}
                  />
                </div>

                {/* Crop Region Status */}
                {cropRegion && (
                  <div className="text-center px-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">
                        Scoreboard region selected (
                        {Math.round(cropRegion.width)}×
                        {Math.round(cropRegion.height)})
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                      Click the crop tool button on the video to adjust the
                      region
                    </p>
                  </div>
                )}

                {/* Processing Controls */}
                {cropRegion && !isProcessing && !gameData && (
                  <div className="max-w-2xl mx-auto px-4">
                    <ProcessingControls
                      onStartAnalysis={handleStartAnalysis}
                      disabled={!cropRegion}
                    />
                  </div>
                )}

                {/* Progress Indicator */}
                {isProcessing && progress && (
                  <div className="max-w-2xl mx-auto px-4">
                    <ProgressIndicator progress={progress} />
                  </div>
                )}

                {/* Results Display */}
                {gameData && (
                  <div className="max-w-6xl mx-auto px-4">
                    <ResultsDisplay
                      gameData={gameData}
                      videoFile={videoFile}
                      detections={personDetections}
                    />
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Help Dialog */}
          <HelpDialog />
        </div>
      </div>
    </ErrorBoundary>
  );
}
