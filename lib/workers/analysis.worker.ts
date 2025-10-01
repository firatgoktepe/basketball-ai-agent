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
    console.log("Starting video analysis with options:", options);

    // Initialize models
    console.log("Initializing models...");
    await initializeModels();
    console.log("Models initialized successfully");

    const {
      videoFile,
      cropRegion,
      samplingRate,
      enableBallDetection,
      enablePoseEstimation,
      enable3ptEstimation,
    } = options;

    // Step 1: Extract frames
    self.postMessage({
      type: "progress",
      data: {
        stage: "sampling",
        progress: 10,
        message: "Extracting video frames...",
      },
    });
    console.log(
      `Extracting frames from ${videoFile.name} at ${samplingRate} fps`
    );
    const frames = await extractFrames(videoFile, samplingRate);
    console.log(`Extracted ${frames.length} frames`);

    // Step 2: Person detection and team clustering
    self.postMessage({
      type: "progress",
      data: {
        stage: "detection",
        progress: 30,
        message: "Detecting players and clustering teams...",
      },
    });
    console.log("Running person detection...");
    const personDetections = await detectPersons(frames, cocoModel);
    console.log(`Detected persons in ${personDetections.length} frames`);

    console.log("Clustering teams...");
    const teamClusters = await clusterTeams(personDetections, frames);
    console.log("Team clusters:", teamClusters);

    // Step 3: Ball detection (if enabled)
    let ballDetections: any[] = [];
    if (enableBallDetection) {
      self.postMessage({
        type: "progress",
        data: {
          stage: "detection",
          progress: 50,
          message: "Detecting ball movement...",
        },
      });
      ballDetections = await detectBall(frames, onnxBallDetector);
    }

    // Step 4: Pose estimation (if enabled)
    let poseDetections: any[] = [];
    let shotAttempts: any[] = [];
    if (enablePoseEstimation && moveNetModel) {
      self.postMessage({
        type: "progress",
        data: {
          stage: "detection",
          progress: 60,
          message: "Analyzing player poses...",
        },
      });
      poseDetections = await extractPoses(frames, moveNetModel);

      // Detect shot attempts from poses
      shotAttempts = detectShotAttempts(poseDetections, ballDetections);
    }

    // Step 5: OCR on scoreboard
    self.postMessage({
      type: "progress",
      data: {
        stage: "ocr",
        progress: 80,
        message: "Reading scoreboard...",
      },
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
    self.postMessage({
      type: "progress",
      data: {
        stage: "fusion",
        progress: 90,
        message: "Processing events...",
      },
    });
    console.log("Running event fusion...");
    const events = await fuseEvents({
      personDetections,
      ballDetections,
      poseDetections,
      shotAttempts,
      ocrResults,
      teamClusters,
      enable3ptEstimation,
    });
    console.log(`Generated ${events.length} events`);

    // Step 7: Generate final results
    self.postMessage({
      type: "progress",
      data: {
        stage: "results",
        progress: 100,
        message: "Generating results...",
      },
    });
    console.log("Generating final game data...");
    const gameData = generateGameData(videoFile, teamClusters, events);
    console.log("Analysis complete:", gameData);

    return gameData;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
}

function generateTeamDataFromClusters(teamClusters: any) {
  // Default teams if clustering failed
  const defaultTeams = [
    { id: "teamA", label: "Team A", color: "#0033cc" },
    { id: "teamB", label: "Team B", color: "#cc0000" },
  ];

  if (!teamClusters || typeof teamClusters !== "object") {
    console.log("No valid team clusters, using default teams");
    return defaultTeams;
  }

  // If teamClusters is just teamA/teamB strings, use defaults
  if (
    typeof teamClusters.teamA === "string" &&
    typeof teamClusters.teamB === "string"
  ) {
    console.log("Team clusters are strings, using default teams");
    return defaultTeams;
  }

  // If we have actual cluster data with centroids, extract colors
  if (Array.isArray(teamClusters) && teamClusters.length >= 2) {
    const teamA =
      teamClusters.find((c) => c.teamId === "teamA") || teamClusters[0];
    const teamB =
      teamClusters.find((c) => c.teamId === "teamB") || teamClusters[1];

    const teamAColor = teamA.centroid
      ? rgbToHex(teamA.centroid.r, teamA.centroid.g, teamA.centroid.b)
      : "#0033cc";
    const teamBColor = teamB.centroid
      ? rgbToHex(teamB.centroid.r, teamB.centroid.g, teamB.centroid.b)
      : "#cc0000";

    const teamALabel = getColorName(teamA.centroid || { r: 0, g: 51, b: 204 });
    const teamBLabel = getColorName(teamB.centroid || { r: 204, g: 0, b: 0 });

    console.log("Generated teams from clusters:", {
      teamA: { label: teamALabel, color: teamAColor },
      teamB: { label: teamBLabel, color: teamBColor },
    });

    return [
      { id: "teamA", label: teamALabel, color: teamAColor },
      { id: "teamB", label: teamBLabel, color: teamBColor },
    ];
  }

  console.log("Unexpected team clusters format, using default teams");
  return defaultTeams;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getColorName(rgb: { r: number; g: number; b: number }): string {
  const { r, g, b } = rgb;

  // Simple color name mapping based on RGB values
  if (r > 200 && g < 100 && b < 100) return "Red";
  if (r < 100 && g < 100 && b > 200) return "Blue";
  if (r > 200 && g > 200 && b < 100) return "Yellow";
  if (r < 100 && g > 200 && b < 100) return "Green";
  if (r < 100 && g < 100 && b < 100) return "Black";
  if (r > 200 && g > 200 && b > 200) return "White";
  if (r > 150 && g > 100 && b < 100) return "Orange";
  if (r > 150 && g < 100 && b > 150) return "Purple";

  // If no specific color matches, return a descriptive name
  return `Team (${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function generateGameData(videoFile: any, teamClusters: any, events: any[]) {
  // Use actual detected team colors instead of hardcoded ones
  const teams = generateTeamDataFromClusters(teamClusters);

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
