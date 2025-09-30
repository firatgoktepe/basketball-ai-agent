// Web Worker for heavy processing tasks
import * as tf from "@tensorflow/tfjs";
import Tesseract from "tesseract.js";

// Import models and utilities
import { loadCocoSSD } from "./models/coco-ssd";
import { loadMoveNet, MoveNetPoseEstimator } from "./models/movenet";
import {
  loadONNXBallDetector,
  isONNXAvailable,
} from "./models/onnx-ball-detection";
import { extractFrames } from "./utils/frame-extractor";
import { detectPersons, clusterTeams } from "./utils/person-detection";
import { detectBall } from "./utils/ball-detection";
import { extractPoses, detectShotAttempts } from "./utils/pose-estimation";
import { runOCR } from "./utils/ocr";
import { processFramesWithOCR } from "./utils/scoreboard-ocr";
import { fuseEvents } from "./utils/event-fusion";

// Global state
let cocoModel: any = null;
let moveNetModel: MoveNetPoseEstimator | null = null;
let onnxBallDetector: any = null;
let isInitialized = false;

async function initializeModels() {
  if (isInitialized) return;

  try {
    // Load core models
    const [coco, moveNet] = await Promise.all([loadCocoSSD(), loadMoveNet()]);
    cocoModel = coco;
    moveNetModel = moveNet;

    // Try to load ONNX ball detector if available
    if (isONNXAvailable()) {
      try {
        onnxBallDetector = await loadONNXBallDetector();
        console.log("ONNX ball detector loaded successfully");
      } catch (error) {
        console.warn(
          "ONNX ball detector failed to load, using HSV fallback:",
          error
        );
      }
    }

    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize models:", error);
    throw error;
  }
}

async function analyzeVideo(options: any) {
  try {
    // Initialize models
    await initializeModels();

    const {
      videoFile,
      cropRegion,
      samplingRate,
      enableBallDetection,
      enablePoseEstimation,
      enable3ptEstimation,
      onProgress,
    } = options;

    // Step 1: Extract frames
    onProgress({
      stage: "sampling",
      progress: 10,
      message: "Extracting video frames...",
    });
    const frames = await extractFrames(videoFile, samplingRate);

    // Step 2: Person detection and team clustering
    onProgress({
      stage: "detection",
      progress: 30,
      message: "Detecting players and clustering teams...",
    });
    const personDetections = await detectPersons(frames, cocoModel);
    const teamClusters = await clusterTeams(personDetections, frames);

    // Step 3: Ball detection (if enabled)
    let ballDetections: any[] = [];
    if (enableBallDetection) {
      onProgress({
        stage: "detection",
        progress: 50,
        message: "Detecting ball movement...",
      });
      ballDetections = await detectBall(frames, onnxBallDetector);
    }

    // Step 4: Pose estimation (if enabled)
    let poseDetections: any[] = [];
    let shotAttempts: any[] = [];
    if (enablePoseEstimation && moveNetModel) {
      onProgress({
        stage: "detection",
        progress: 60,
        message: "Analyzing player poses...",
      });
      poseDetections = await extractPoses(frames, moveNetModel);

      // Detect shot attempts from poses
      shotAttempts = detectShotAttempts(poseDetections, ballDetections);
    }

    // Step 5: OCR on scoreboard
    onProgress({
      stage: "ocr",
      progress: 80,
      message: "Reading scoreboard...",
    });
    const ocrResults = await processFramesWithOCR(frames, {
      cropRegion,
      samplingRate,
      onScoreChange: (event) => {
        // Forward score change events to main thread
        self.postMessage({ type: "scoreChange", data: event });
      },
    });

    // Step 6: Event fusion
    onProgress({
      stage: "fusion",
      progress: 90,
      message: "Processing events...",
    });
    const events = await fuseEvents({
      personDetections,
      ballDetections,
      poseDetections,
      shotAttempts,
      ocrResults,
      teamClusters,
      enable3ptEstimation,
    });

    // Step 7: Generate final results
    onProgress({
      stage: "results",
      progress: 100,
      message: "Generating results...",
    });
    const gameData = generateGameData(videoFile, teamClusters, events);

    return gameData;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
}

function generateGameData(videoFile: any, teamClusters: any, events: any[]) {
  const teams = [
    { id: "teamA", label: "Blue", color: "#0033cc" },
    { id: "teamB", label: "Red", color: "#cc0000" },
  ];

  const summary = {
    teamA: {
      points: events
        .filter((e) => e.type === "score" && e.teamId === "teamA")
        .reduce((sum, e) => sum + (e.scoreDelta || 0), 0),
      shotAttempts: events.filter(
        (e) => e.type === "shot_attempt" && e.teamId === "teamA"
      ).length,
      offRebounds: events.filter(
        (e) => e.type === "offensive_rebound" && e.teamId === "teamA"
      ).length,
      defRebounds: events.filter(
        (e) => e.type === "defensive_rebound" && e.teamId === "teamA"
      ).length,
      turnovers: events.filter(
        (e) => e.type === "turnover" && e.teamId === "teamA"
      ).length,
    },
    teamB: {
      points: events
        .filter((e) => e.type === "score" && e.teamId === "teamB")
        .reduce((sum, e) => sum + (e.scoreDelta || 0), 0),
      shotAttempts: events.filter(
        (e) => e.type === "shot_attempt" && e.teamId === "teamB"
      ).length,
      offRebounds: events.filter(
        (e) => e.type === "offensive_rebound" && e.teamId === "teamB"
      ).length,
      defRebounds: events.filter(
        (e) => e.type === "defensive_rebound" && e.teamId === "teamB"
      ).length,
      turnovers: events.filter(
        (e) => e.type === "turnover" && e.teamId === "teamB"
      ).length,
    },
  };

  return {
    video: {
      filename: videoFile.name,
      duration: videoFile.duration,
    },
    teams,
    events,
    summary,
  };
}

// Handle messages from main thread
self.addEventListener("message", async (event) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case "analyze":
        const result = await analyzeVideo(data);
        self.postMessage({ type: "result", data: result });
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      data: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
