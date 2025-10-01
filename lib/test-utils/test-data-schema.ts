/**
 * Test Data Schema for Annotated Basketball Game Clips
 *
 * This schema defines the structure for annotated test clips used to evaluate
 * the accuracy of our detection and event inference pipeline.
 */

export interface AnnotatedClip {
  id: string;
  filename: string;
  duration: number;
  resolution: {
    width: number;
    height: number;
  };
  conditions: {
    lighting: "good" | "moderate" | "poor";
    cameraStability: "steady" | "moderate" | "shaky";
    scoreboardVisibility: "clear" | "partial" | "occluded";
    playerCount: number;
  };
  groundTruth: {
    scoreEvents: ScoreEvent[];
    shotAttempts: ShotAttempt[];
    rebounds: Rebound[];
    turnovers: Turnover[];
    teams: TeamInfo[];
  };
}

export interface ScoreEvent {
  timestamp: number; // seconds
  teamId: string;
  scoreDelta: 2 | 3; // points scored
  newScore: number;
  confidence: "high" | "medium" | "low";
}

export interface ShotAttempt {
  timestamp: number;
  teamId: string;
  made: boolean;
  type: "2pt" | "3pt" | "unknown";
  shooterId?: string;
}

export interface Rebound {
  timestamp: number;
  teamId: string;
  type: "offensive" | "defensive";
  playerId?: string;
}

export interface Turnover {
  timestamp: number;
  teamId: string;
  type: "steal" | "bad_pass" | "traveling" | "unknown";
}

export interface TeamInfo {
  id: string;
  label: string;
  color: string;
  expectedStats: {
    points: number;
    shotAttempts: number;
    offensiveRebounds: number;
    defensiveRebounds: number;
    turnovers: number;
  };
}

/**
 * Evaluation Metrics
 */
export interface EvaluationResult {
  clipId: string;
  scoreEventAccuracy: {
    precision: number;
    recall: number;
    f1Score: number;
    timestampError: number; // average error in seconds
  };
  shotAttemptAccuracy: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  reboundAccuracy: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  turnoverAccuracy: {
    precision: number;
    recall: number;
    f1Score: number;
  };
  teamAttributionAccuracy: number; // percentage correct
  processingTime: number; // seconds
  warnings: string[];
}

/**
 * Test Suite Configuration
 */
export interface TestSuiteConfig {
  clips: AnnotatedClip[];
  thresholds: {
    minScoreEventAccuracy: number; // 0.95 (95%)
    minTeamAttribution: number; // 0.80 (80%)
    minShotInference: number; // 0.60 (60%)
    maxTimestampError: number; // 1.0 second
  };
}
