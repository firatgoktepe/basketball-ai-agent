import type { GameData } from "@/types";

export function generateDemoGameData(): GameData {
  const teams = [
    { id: "teamA", label: "Blue", color: "#0033cc" },
    { id: "teamB", label: "Red", color: "#cc0000" },
  ];

  const events = [
    {
      id: "evt-001",
      type: "score" as const,
      teamId: "teamA",
      scoreDelta: 2,
      timestamp: 12.4,
      confidence: 0.98,
      source: "ocr",
      notes: "Detected by scoreboard OCR",
    },
    {
      id: "evt-002",
      type: "shot_attempt" as const,
      teamId: "teamB",
      timestamp: 18.7,
      confidence: 0.72,
      source: "pose+ball-heuristic",
      notes: "Detected by pose and ball tracking",
    },
    {
      id: "evt-003",
      type: "missed_shot" as const,
      teamId: "teamB",
      timestamp: 19.2,
      confidence: 0.68,
      source: "pose-only",
      notes: "Shot attempt without score change",
    },
    {
      id: "evt-004",
      type: "defensive_rebound" as const,
      teamId: "teamA",
      timestamp: 19.8,
      confidence: 0.75,
      source: "ball+proximity-heuristic",
      notes: "Defensive rebound by Blue team",
    },
    {
      id: "evt-005",
      type: "score" as const,
      teamId: "teamA",
      scoreDelta: 3,
      timestamp: 45.2,
      confidence: 0.95,
      source: "ocr",
      notes: "3-point shot detected by scoreboard OCR",
    },
    {
      id: "evt-006",
      type: "turnover" as const,
      teamId: "teamB",
      timestamp: 67.1,
      confidence: 0.58,
      source: "possession-heuristic",
      notes: "Turnover detected by possession change",
    },
    {
      id: "evt-007",
      type: "shot_attempt" as const,
      teamId: "teamA",
      timestamp: 89.3,
      confidence: 0.82,
      source: "pose+ball-heuristic",
      notes: "Shot attempt with ball tracking",
    },
    {
      id: "evt-008",
      type: "offensive_rebound" as const,
      teamId: "teamA",
      timestamp: 90.1,
      confidence: 0.71,
      source: "ball+proximity-heuristic",
      notes: "Offensive rebound by Blue team",
    },
    {
      id: "evt-009",
      type: "score" as const,
      teamId: "teamA",
      scoreDelta: 2,
      timestamp: 91.5,
      confidence: 0.96,
      source: "ocr",
      notes: "Score detected by scoreboard OCR",
    },
    {
      id: "evt-010",
      type: "3pt" as const,
      teamId: "teamB",
      timestamp: 112.8,
      confidence: 0.45,
      source: "court-geometry-heuristic",
      notes: "Estimated 3-point attempt based on court position",
    },
  ];

  const summary = {
    teamA: {
      points: 7,
      shotAttempts: 3,
      offRebounds: 1,
      defRebounds: 1,
      turnovers: 0,
    },
    teamB: {
      points: 0,
      shotAttempts: 2,
      offRebounds: 0,
      defRebounds: 0,
      turnovers: 1,
    },
  };

  return {
    video: {
      filename: "demo_basketball_game.mp4",
      duration: 125.4,
    },
    teams,
    events,
    summary,
  };
}
