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
  | "long_distance_attempt";
  teamId: string;
  scoreDelta?: number;
  timestamp: number;
  confidence: number;
  source: string;
  notes?: string;
}

export interface TeamSummary {
  points: number;
  shotAttempts: number;
  offRebounds: number;
  defRebounds: number;
  turnovers: number;
  threePointAttempts?: number;
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
  cropRegion: { x: number; y: number; width: number; height: number };
  samplingRate: number;
  enableBallDetection: boolean;
  enablePoseEstimation: boolean;
  enable3ptEstimation: boolean;
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
  }[];
}
