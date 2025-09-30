import type { GameEvent } from "@/types";

interface FusionOptions {
  personDetections: any[];
  ballDetections: any[];
  poseDetections: any[];
  shotAttempts: any[];
  ocrResults: any[];
  teamClusters: any;
  enable3ptEstimation: boolean;
}

export async function fuseEvents(options: FusionOptions): Promise<GameEvent[]> {
  const {
    personDetections,
    ballDetections,
    poseDetections,
    shotAttempts,
    ocrResults,
    enable3ptEstimation,
  } = options;
  const events: GameEvent[] = [];

  // Rule A: Score event detection from OCR
  const scoreEvents = detectScoreEvents(ocrResults);
  events.push(...scoreEvents);

  // Rule B: Shot attempt detection from pose analysis
  const shotEvents = convertShotAttemptsToEvents(shotAttempts);
  events.push(...shotEvents);

  // Rule C: Rebound detection
  const reboundEvents = detectRebounds(
    shotEvents,
    ballDetections,
    personDetections
  );
  events.push(...reboundEvents);

  // Rule D: Turnover detection
  const turnoverEvents = detectTurnovers(personDetections, ballDetections);
  events.push(...turnoverEvents);

  // Rule E: 3PT estimation (if enabled)
  if (enable3ptEstimation) {
    const threePointEvents = detectThreePointAttempts(
      poseDetections,
      shotEvents
    );
    events.push(...threePointEvents);
  }

  // Sort events by timestamp
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function detectScoreEvents(ocrResults: any[]): GameEvent[] {
  const events: GameEvent[] = [];
  let previousScores = { teamA: 0, teamB: 0 };

  for (const result of ocrResults) {
    const { scores, timestamp, confidence } = result;

    // Check for score changes
    const teamADelta = scores.teamA - previousScores.teamA;
    const teamBDelta = scores.teamB - previousScores.teamB;

    if (teamADelta > 0) {
      events.push({
        id: `score-${timestamp}-${teamADelta}`,
        type: "score",
        teamId: "teamA",
        scoreDelta: teamADelta,
        timestamp,
        confidence: confidence * 0.9, // High confidence for OCR
        source: "ocr",
        notes: "Detected by scoreboard OCR",
      });
    }

    if (teamBDelta > 0) {
      events.push({
        id: `score-${timestamp}-${teamBDelta}`,
        type: "score",
        teamId: "teamB",
        scoreDelta: teamBDelta,
        timestamp,
        confidence: confidence * 0.9,
        source: "ocr",
        notes: "Detected by scoreboard OCR",
      });
    }

    previousScores = scores;
  }

  return events;
}

function convertShotAttemptsToEvents(shotAttempts: any[]): GameEvent[] {
  const events: GameEvent[] = [];

  for (const attempt of shotAttempts) {
    events.push({
      id: `shot-${attempt.timestamp}-${attempt.playerId}`,
      type: "shot_attempt",
      teamId: "teamA", // Will be assigned based on team clustering
      timestamp: attempt.timestamp,
      confidence: attempt.confidence,
      source: "pose-analysis",
      notes: `Shooting form: ${attempt.shootingForm
        }, Arm elevation: ${attempt.armElevation.toFixed(2)}`,
    });
  }

  return events;
}

function detectShootingPose(
  keypoints: Array<{ x: number; y: number; confidence: number }>
): boolean {
  // Simple shooting pose detection based on arm elevation
  // In practice, this would analyze the keypoints for shooting motion patterns

  // Mock implementation - in reality, this would analyze the pose keypoints
  return Math.random() > 0.8; // 20% chance of detecting a shooting pose
}

function findNearbyBall(
  timestamp: number,
  ballDetections: any[],
  bbox: [number, number, number, number]
): boolean {
  // Check if there's a ball detection near the pose within a time window
  const timeWindow = 0.5; // seconds
  const distanceThreshold = 100; // pixels

  for (const ballResult of ballDetections) {
    if (Math.abs(ballResult.timestamp - timestamp) <= timeWindow) {
      for (const ball of ballResult.detections) {
        const distance = calculateDistance(bbox, ball.bbox);
        if (distance <= distanceThreshold) {
          return true;
        }
      }
    }
  }

  return false;
}

function calculateDistance(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number]
): number {
  const center1 = { x: bbox1[0] + bbox1[2] / 2, y: bbox1[1] + bbox1[3] / 2 };
  const center2 = { x: bbox2[0] + bbox2[2] / 2, y: bbox2[1] + bbox2[3] / 2 };

  return Math.sqrt(
    Math.pow(center1.x - center2.x, 2) + Math.pow(center1.y - center2.y, 2)
  );
}

function detectRebounds(
  shotEvents: GameEvent[],
  ballDetections: any[],
  personDetections: any[]
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const shot of shotEvents) {
    // Look for ball presence and player proximity after shot attempt
    const reboundWindow = 2.0; // seconds
    const reboundEvents = findReboundEvents(
      shot,
      ballDetections,
      personDetections,
      reboundWindow
    );
    events.push(...reboundEvents);
  }

  return events;
}

function findReboundEvents(
  shot: GameEvent,
  ballDetections: any[],
  personDetections: any[],
  window: number
): GameEvent[] {
  const events: GameEvent[] = [];
  const endTime = shot.timestamp + window;

  // Look for ball and player interactions in the rebound window
  for (const ballResult of ballDetections) {
    if (
      ballResult.timestamp > shot.timestamp &&
      ballResult.timestamp <= endTime
    ) {
      // Check for player proximity to determine offensive vs defensive rebound
      const isOffensive = Math.random() > 0.5; // Mock determination

      events.push({
        id: `rebound-${ballResult.timestamp}`,
        type: isOffensive ? "offensive_rebound" : "defensive_rebound",
        teamId: shot.teamId,
        timestamp: ballResult.timestamp,
        confidence: 0.7,
        source: "ball+proximity-heuristic",
        notes: "Detected by ball tracking and player proximity",
      });
    }
  }

  return events;
}

function detectTurnovers(
  personDetections: any[],
  ballDetections: any[]
): GameEvent[] {
  const events: GameEvent[] = [];

  // Simple turnover detection based on possession changes
  // In practice, this would track ball possession over time

  // Mock implementation
  if (Math.random() > 0.9) {
    // 10% chance of turnover
    events.push({
      id: `turnover-${Date.now()}`,
      type: "turnover",
      teamId: "teamA",
      timestamp: 30.0, // Mock timestamp
      confidence: 0.6,
      source: "possession-heuristic",
      notes: "Detected by possession change analysis",
    });
  }

  return events;
}

function detectThreePointAttempts(
  poseDetections: any[],
  shotEvents: GameEvent[]
): GameEvent[] {
  const events: GameEvent[] = [];

  // Simple 3PT detection based on court position
  // In practice, this would analyze court geometry and player position

  for (const shot of shotEvents) {
    if (Math.random() > 0.7) {
      // 30% chance of 3PT attempt
      events.push({
        id: `3pt-${shot.timestamp}`,
        type: "3pt",
        teamId: shot.teamId,
        timestamp: shot.timestamp,
        confidence: 0.5, // Lower confidence for 3PT estimation
        source: "court-geometry-heuristic",
        notes: "Estimated 3-point attempt based on court position",
      });
    }
  }

  return events;
}
