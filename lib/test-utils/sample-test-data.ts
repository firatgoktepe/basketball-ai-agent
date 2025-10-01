/**
 * Sample Annotated Test Data
 *
 * This file contains sample annotations for test clips
 * In production, these would be loaded from JSON files
 */

import type { AnnotatedClip, TestSuiteConfig } from "./test-data-schema";

export const sampleTestClips: AnnotatedClip[] = [
  {
    id: "test-001-broadcast-clear",
    filename: "test_clips/broadcast_clear.mp4",
    duration: 120,
    resolution: { width: 1920, height: 1080 },
    conditions: {
      lighting: "good",
      cameraStability: "steady",
      scoreboardVisibility: "clear",
      playerCount: 10,
    },
    groundTruth: {
      scoreEvents: [
        {
          timestamp: 12.4,
          teamId: "teamA",
          scoreDelta: 2,
          newScore: 14,
          confidence: "high",
        },
        {
          timestamp: 28.7,
          teamId: "teamB",
          scoreDelta: 3,
          newScore: 17,
          confidence: "high",
        },
        {
          timestamp: 45.2,
          teamId: "teamA",
          scoreDelta: 2,
          newScore: 16,
          confidence: "high",
        },
      ],
      shotAttempts: [
        { timestamp: 12.2, teamId: "teamA", made: true, type: "2pt" },
        { timestamp: 28.5, teamId: "teamB", made: true, type: "3pt" },
        { timestamp: 35.8, teamId: "teamB", made: false, type: "2pt" },
        { timestamp: 45.0, teamId: "teamA", made: true, type: "2pt" },
      ],
      rebounds: [
        { timestamp: 36.0, teamId: "teamA", type: "defensive" },
        { timestamp: 52.3, teamId: "teamB", type: "offensive" },
      ],
      turnovers: [{ timestamp: 67.5, teamId: "teamA", type: "steal" }],
      teams: [
        {
          id: "teamA",
          label: "Blue Team",
          color: "#0033cc",
          expectedStats: {
            points: 16,
            shotAttempts: 2,
            offensiveRebounds: 0,
            defensiveRebounds: 1,
            turnovers: 1,
          },
        },
        {
          id: "teamB",
          label: "Red Team",
          color: "#cc0000",
          expectedStats: {
            points: 17,
            shotAttempts: 2,
            offensiveRebounds: 1,
            defensiveRebounds: 0,
            turnovers: 0,
          },
        },
      ],
    },
  },
  {
    id: "test-002-amateur-moderate",
    filename: "test_clips/amateur_moderate.mp4",
    duration: 180,
    resolution: { width: 1280, height: 720 },
    conditions: {
      lighting: "moderate",
      cameraStability: "moderate",
      scoreboardVisibility: "partial",
      playerCount: 8,
    },
    groundTruth: {
      scoreEvents: [
        {
          timestamp: 15.3,
          teamId: "teamA",
          scoreDelta: 2,
          newScore: 8,
          confidence: "medium",
        },
        {
          timestamp: 42.1,
          teamId: "teamB",
          scoreDelta: 2,
          newScore: 10,
          confidence: "medium",
        },
      ],
      shotAttempts: [
        { timestamp: 15.1, teamId: "teamA", made: true, type: "2pt" },
        { timestamp: 30.5, teamId: "teamA", made: false, type: "unknown" },
        { timestamp: 41.9, teamId: "teamB", made: true, type: "2pt" },
      ],
      rebounds: [{ timestamp: 30.7, teamId: "teamB", type: "defensive" }],
      turnovers: [],
      teams: [
        {
          id: "teamA",
          label: "Home",
          color: "#00ff00",
          expectedStats: {
            points: 8,
            shotAttempts: 2,
            offensiveRebounds: 0,
            defensiveRebounds: 0,
            turnovers: 0,
          },
        },
        {
          id: "teamB",
          label: "Away",
          color: "#ff0000",
          expectedStats: {
            points: 10,
            shotAttempts: 1,
            offensiveRebounds: 0,
            defensiveRebounds: 1,
            turnovers: 0,
          },
        },
      ],
    },
  },
];

export const testSuiteConfig: TestSuiteConfig = {
  clips: sampleTestClips,
  thresholds: {
    minScoreEventAccuracy: 0.95, // 95%
    minTeamAttribution: 0.8, // 80%
    minShotInference: 0.6, // 60%
    maxTimestampError: 1.0, // 1 second
  },
};

/**
 * Helper function to load test clips from JSON files
 */
export async function loadTestClipsFromFiles(
  directory: string
): Promise<AnnotatedClip[]> {
  // This would be implemented to load from actual JSON files
  // For now, returning sample data
  return sampleTestClips;
}
