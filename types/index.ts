export interface VideoFile {
  file: File;
  url: string;
  name: string;
  size: number;
  duration: number;
}

export interface Team {
  id: string;
  label: string;
  color: string;
}

export interface GameEvent {
  id: string;
  type:
    | "score"
    | "shot_attempt"
    | "missed_shot"
    | "offensive_rebound"
    | "defensive_rebound"
    | "turnover"
    | "steal"
    | "3pt"
    | "long_distance_attempt"
    | "block"
    | "pass"
    | "dunk"
    | "assist"
    | "layup"
    | "foul_shot"
    | "dribble";
  teamId: string;
  playerId?: string; // Jersey number or player identifier
  scoreDelta?: number;
  shotType?: "2pt" | "3pt" | "1pt"; // Track the type of shot that resulted in a score (1pt for foul shots)
  timestamp: number;
  confidence: number;
  source: string;
  notes?: string;
}

export interface PlayerSummary {
  playerId: string; // Jersey number
  points: number;
  twoPointScores: number;
  threePointScores: number;
  foulShots: number;
  shotAttempts: number;
  twoPointAttempts: number;
  threePointAttempts: number;
  hitRate: number; // Percentage
  dunks: number;
  blocks: number;
  offRebounds: number;
  defRebounds: number;
  assists: number;
  turnovers: number;
  passes: number;
  dribbles: number;
}

export interface TeamSummary {
  points: number;
  twoPointScores: number;
  threePointScores: number;
  foulShots: number;
  shotAttempts: number;
  offRebounds: number;
  defRebounds: number;
  turnovers: number;
  threePointAttempts?: number;
  blocks: number;
  dunks: number;
  assists: number;
  passes: number;
  dribbles: number;
  players: PlayerSummary[]; // Per-player breakdown
}

export interface HighlightClip {
  id: string;
  eventId: string;
  eventType: string;
  teamId: string;
  playerId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  description: string;
}

export interface GameData {
  video: {
    filename: string;
    duration: number;
  };
  teams: Team[];
  events: GameEvent[];
  summary: {
    [teamId: string]: TeamSummary;
  };
  highlights?: HighlightClip[]; // Optional highlight clips
}

export interface AnalysisProgress {
  stage:
    | "initializing"
    | "sampling"
    | "detection"
    | "ocr"
    | "fusion"
    | "results"
    | "error";
  progress: number; // 0-100
  message: string;
}

export interface AnalysisOptions {
  videoFile: VideoFile;
  cropRegion?: { x: number; y: number; width: number; height: number }; // Optional now - not used for amateur videos
  samplingRate: number;
  enableBallDetection: boolean;
  enablePoseEstimation: boolean;
  enable3ptEstimation: boolean;
  enableJerseyNumberDetection?: boolean; // New: detect and track player jersey numbers
  forceMockPoseModel?: boolean;
  onProgress: (progress: AnalysisProgress) => void;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  frameIndex: number;
  timestamp: number;
  detections: {
    type: "person" | "ball";
    bbox: [number, number, number, number];
    confidence: number;
    teamId?: string;
  }[];
}

export interface OCRResult {
  frameIndex: number;
  timestamp: number;
  scores: {
    teamA: number;
    teamB: number;
  };
  confidence: number;
}

export interface PoseResult {
  frameIndex: number;
  timestamp: number;
  poses: {
    keypoints: Array<{ x: number; y: number; confidence: number }>;
    bbox: [number, number, number, number];
    teamId?: string;
    playerId?: string; // Jersey number
  }[];
}

export interface JerseyDetectionResult {
  frameIndex: number;
  timestamp: number;
  players: {
    playerId: string; // Jersey number
    bbox: [number, number, number, number];
    teamId?: string;
    confidence: number;
  }[];
}

export interface HoopDetectionResult {
  frameIndex: number;
  timestamp: number;
  hoopRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  };
}

export interface VisualScoreEvent {
  timestamp: number;
  teamId: string;
  playerId?: string;
  scoreDelta: number;
  shotType: "2pt" | "3pt" | "1pt";
  confidence: number;
  ballThroughHoop: boolean;
}
