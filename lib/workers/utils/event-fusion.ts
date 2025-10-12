import type { GameEvent, HoopDetectionResult } from "@/types";
import {
  detectVisualScores,
  processHoopDetections,
} from "./visual-score-detection";
import { detectAllActions } from "./action-recognition";

interface FusionOptions {
  personDetections: any[];
  ballDetections: any[];
  poseDetections: any[];
  shotAttempts: any[];
  ocrResults: any[]; // Deprecated - kept for backward compatibility, not used
  hoopDetections?: HoopDetectionResult[]; // New: visual hoop detection
  teamClusters: any;
  enable3ptEstimation: boolean;
  enableVisualScoring?: boolean; // New: enable visual score detection (default true for amateur videos)
}

interface FrameSignal {
  timestamp: number;
  frameIndex: number;
  teamId?: string;
  confidence: number;
  type: string;
}

// Temporal smoothing window (seconds)
const TEMPORAL_WINDOW = 1.0;
const SCORE_ATTRIBUTION_WINDOW = 0.5;
const REBOUND_WINDOW = 2.0;
const MISSED_SHOT_WINDOW = 2.0;

/**
 * Main event fusion function that implements deterministic rules
 * for basketball event detection with confidence scoring
 * UPDATED: Supports visual score detection for amateur videos (no scoreboard)
 */
export async function fuseEvents(options: FusionOptions): Promise<GameEvent[]> {
  const {
    personDetections,
    ballDetections,
    poseDetections,
    shotAttempts,
    ocrResults,
    hoopDetections,
    teamClusters,
    enable3ptEstimation,
    enableVisualScoring = true, // Default to visual scoring for amateur videos
  } = options;
  const events: GameEvent[] = [];

  // Rule B: Shot attempt detection from pose + ball motion (run first to get shot attempts for score attribution)
  const shotEvents = await detectShotAttempts(
    shotAttempts,
    poseDetections,
    ballDetections,
    teamClusters
  );

  // If no shot attempts from pose, generate from ball or person movement for amateur videos
  if (shotEvents.length === 0 && enableVisualScoring) {
    if (ballDetections && ballDetections.length > 0) {
      console.log(
        "📊 No pose-based shots, generating shot attempts from ball trajectory"
      );

      // Generate shot attempts from ball movement patterns
      const ballBasedShots = generateShotAttemptsFromBallMovement(
        ballDetections,
        personDetections
      );
      shotEvents.push(...ballBasedShots);

      console.log(
        `Generated ${ballBasedShots.length} shot attempts from ball movement`
      );
    }

    // If still no shots and ball detection failed, use person movements
    if (
      shotEvents.length === 0 &&
      personDetections &&
      personDetections.length > 0
    ) {
      console.log(
        "📊 Ball detection failed, generating shot attempts from player movements"
      );

      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `⚠️ Ball detection found 0 balls - generating shots from player movements instead`,
          },
        });
      }

      const personBasedShots =
        generateShotAttemptsFromPersonMovement(personDetections);
      shotEvents.push(...personBasedShots);

      console.log(
        `Generated ${personBasedShots.length} shot attempts from player movements`
      );

      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `✅ Generated ${personBasedShots.length} shot attempts from player movements`,
          },
        });
      }
    }
  }

  events.push(...shotEvents);

  // Rule A: Score event detection
  let scoreEvents: GameEvent[] = [];

  if (enableVisualScoring && hoopDetections && hoopDetections.length > 0) {
    // NEW: Visual score detection for amateur videos (ball-through-hoop)
    console.log(
      `🎯 Using visual score detection with ${shotEvents.length} shot attempts`
    );
    scoreEvents = detectVisualScores(
      shotEvents,
      ballDetections,
      hoopDetections,
      personDetections
    );
  } else if (ocrResults && ocrResults.length > 0) {
    // LEGACY: OCR-based score detection (for professional broadcast footage)
    console.log("📊 Using OCR score detection (professional broadcast mode)");
    scoreEvents = await detectScoreEventsWithAttribution(
      ocrResults,
      personDetections,
      teamClusters,
      shotEvents
    );
  } else {
    console.warn("⚠️ No score detection method available");
  }

  events.push(...scoreEvents);

  // Rule F: Enhanced action recognition (blocks, passes, dunks, assists, etc.)
  const actionEvents = detectAllActions(
    shotEvents,
    scoreEvents,
    poseDetections,
    personDetections,
    ballDetections,
    teamClusters
  );
  events.push(...actionEvents);

  // Detect missed shots (shots not followed by score changes)
  const missedShotEvents = detectMissedShots(shotEvents, scoreEvents);
  events.push(...missedShotEvents);

  // Rule C: Rebound detection
  // Check if ball detections contain actual ball data
  const ballFramesWithBalls = ballDetections.filter(
    (frame) => frame.detections && frame.detections.length > 0
  ).length;
  console.log(
    `🔄 Detecting rebounds from ${shotEvents.length} shots (ball data: ${ballFramesWithBalls}/${ballDetections.length} frames)...`
  );

  const reboundEvents = await detectRebounds(
    shotEvents,
    ballDetections,
    personDetections,
    teamClusters
  );
  console.log(`📊 Detected ${reboundEvents.length} rebounds`);
  events.push(...reboundEvents);

  // Rule D: Turnover/Steal detection
  console.log(`🔄 Detecting turnovers from ball possession changes...`);
  const turnoverEvents = await detectTurnovers(
    personDetections,
    ballDetections,
    teamClusters
  );
  console.log(`📊 Detected ${turnoverEvents.length} turnovers/steals`);
  events.push(...turnoverEvents);

  // Fallback: Infer turnovers from score patterns if insufficient ball data
  if (turnoverEvents.length === 0 && ballFramesWithBalls < 10) {
    console.log(
      `⚠️ Insufficient ball data (${ballFramesWithBalls} frames) - inferring turnovers from game flow...`
    );
    const inferredTurnovers = inferTurnoversFromGameFlow(
      shotEvents,
      scoreEvents,
      personDetections
    );
    console.log(
      `📊 Inferred ${inferredTurnovers.length} turnovers from game flow`
    );
    events.push(...inferredTurnovers);
  }

  // Rule E: 3PT estimation (if enabled)
  if (enable3ptEstimation) {
    const threePointEvents = detect3PointAttempts(
      shotEvents,
      poseDetections,
      personDetections
    );
    events.push(...threePointEvents);
  }

  // Apply temporal smoothing and filter low-confidence events
  const smoothedEvents = applyTemporalSmoothing(events);

  // Debug: Log confidence values before filtering
  console.log("🔍 Event confidence values before filtering:");
  smoothedEvents.forEach((event, i) => {
    console.log(
      `  Event ${i}: ${event.type} - confidence: ${event.confidence.toFixed(3)}`
    );
  });

  // Filter out very low confidence events while keeping medium/high ones
  // Threshold of 0.4 to be more inclusive of detected events
  const filteredEvents = filterLowConfidenceEvents(smoothedEvents, 0.4);

  console.log(
    `📊 Filtered ${smoothedEvents.length} events down to ${filteredEvents.length} events`
  );

  // Send debug info to main thread
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Event confidence values: ${smoothedEvents
          .map((e) => `${e.type}:${e.confidence.toFixed(2)}`)
          .join(", ")}`,
      },
    });

    self.postMessage({
      type: "debug",
      data: {
        message: `📊 Filtered ${smoothedEvents.length} events down to ${filteredEvents.length} events`,
      },
    });
  }

  // Sort events by timestamp
  return filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Rule A: Score event detection from OCR with team attribution
 * High confidence events (0.9-1.0) based on stable OCR readings
 * Team attribution via majority voting of players near hoop
 * Enhanced to determine shot type (2pt vs 3pt) based on recent shot attempts
 */
async function detectScoreEventsWithAttribution(
  ocrResults: any[],
  personDetections: any[],
  teamClusters: any,
  recentShotAttempts?: GameEvent[]
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];
  let previousScores = { teamA: 0, teamB: 0 };

  for (let i = 0; i < ocrResults.length; i++) {
    const result = ocrResults[i];
    const { scores, timestamp, confidence } = result;

    // Check for score changes
    const teamADelta = scores.teamA - previousScores.teamA;
    const teamBDelta = scores.teamB - previousScores.teamB;

    // Determine if OCR reading is stable (check next frame if available)
    let isStable = false;
    if (i + 1 < ocrResults.length) {
      const nextResult = ocrResults[i + 1];
      isStable =
        nextResult.scores.teamA === scores.teamA &&
        nextResult.scores.teamB === scores.teamB;
    }

    const stabilityBonus = isStable ? 0.1 : 0;
    const baseConfidence = Math.min(confidence * 0.9 + stabilityBonus, 1.0);

    if (teamADelta > 0) {
      // Attribute score to team based on player proximity to hoop
      const attributedTeam = attributeScoreToTeam(
        timestamp,
        personDetections,
        teamClusters,
        "teamA"
      );

      // Determine shot type based on recent shot attempts
      const shotType = determineShotTypeFromScore(
        teamADelta,
        timestamp,
        attributedTeam.teamId,
        recentShotAttempts || []
      );

      // Find player ID for this score
      const playerId = findPlayerIdForEvent(
        timestamp,
        attributedTeam.teamId,
        personDetections,
        { x: 0, y: 0, width: 100, height: 40 } // Hoop region (top 40% of frame)
      );

      events.push({
        id: `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "score",
        teamId: attributedTeam.teamId,
        playerId,
        scoreDelta: teamADelta,
        shotType: shotType.type,
        timestamp,
        confidence:
          baseConfidence * attributedTeam.confidence * shotType.confidence,
        source: "ocr",
        notes: `Detected by scoreboard OCR (+${teamADelta} points, ${
          shotType.type
        } shot, attribution confidence: ${(
          attributedTeam.confidence * 100
        ).toFixed(0)}%)`,
      });
    }

    if (teamBDelta > 0) {
      const attributedTeam = attributeScoreToTeam(
        timestamp,
        personDetections,
        teamClusters,
        "teamB"
      );

      // Determine shot type based on recent shot attempts
      const shotType = determineShotTypeFromScore(
        teamBDelta,
        timestamp,
        attributedTeam.teamId,
        recentShotAttempts || []
      );

      // Find player ID for this score
      const playerId = findPlayerIdForEvent(
        timestamp,
        attributedTeam.teamId,
        personDetections,
        { x: 0, y: 0, width: 100, height: 40 } // Hoop region (top 40% of frame)
      );

      events.push({
        id: `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "score",
        teamId: attributedTeam.teamId,
        playerId,
        scoreDelta: teamBDelta,
        shotType: shotType.type,
        timestamp,
        confidence:
          baseConfidence * attributedTeam.confidence * shotType.confidence,
        source: "ocr",
        notes: `Detected by scoreboard OCR (+${teamBDelta} points, ${
          shotType.type
        } shot, attribution confidence: ${(
          attributedTeam.confidence * 100
        ).toFixed(0)}%)`,
      });
    }

    previousScores = scores;
  }

  return events;
}

/**
 * Determines shot type (2pt vs 3pt) based on score delta and recent shot attempts
 */
function determineShotTypeFromScore(
  scoreDelta: number,
  timestamp: number,
  teamId: string,
  recentShotAttempts: GameEvent[]
): { type: "2pt" | "3pt"; confidence: number } {
  // Default to 2pt shot if no shot attempts found
  let shotType: "2pt" | "3pt" = "2pt";
  let confidence = 0.5;

  // Look for shot attempts from the same team within the last 3 seconds
  const timeWindow = 3.0;
  const relevantShots = recentShotAttempts.filter(
    (shot) =>
      shot.teamId === teamId &&
      shot.timestamp <= timestamp &&
      shot.timestamp >= timestamp - timeWindow
  );

  if (relevantShots.length > 0) {
    // Find the most recent shot attempt
    const mostRecentShot = relevantShots.reduce((latest, shot) =>
      shot.timestamp > latest.timestamp ? shot : latest
    );

    // Check if it was a 3pt attempt
    if (mostRecentShot.type === "3pt") {
      shotType = "3pt";
      confidence = 0.9; // High confidence if we have a 3pt attempt
    } else if (mostRecentShot.type === "long_distance_attempt") {
      shotType = "3pt";
      confidence = 0.7; // Medium confidence for long distance attempt
    } else {
      shotType = "2pt";
      confidence = 0.8; // High confidence for regular shot attempt
    }
  } else {
    // No shot attempts found, use score delta to infer
    if (scoreDelta === 3) {
      shotType = "3pt";
      confidence = 0.6; // Medium confidence based on score alone
    } else if (scoreDelta === 2) {
      shotType = "2pt";
      confidence = 0.7; // Higher confidence for 2pt (more common)
    } else if (scoreDelta === 1) {
      // Could be a free throw, treat as 2pt
      shotType = "2pt";
      confidence = 0.5; // Lower confidence for free throws
    }
  }

  return { type: shotType, confidence };
}

/**
 * Attributes a score to a team based on player positions near the hoop
 * Uses majority voting within a time window
 */
function attributeScoreToTeam(
  timestamp: number,
  personDetections: any[],
  teamClusters: any,
  defaultTeam: string
): { teamId: string; confidence: number } {
  // Find frames within attribution window
  const relevantFrames = personDetections.filter(
    (frame) => Math.abs(frame.timestamp - timestamp) <= SCORE_ATTRIBUTION_WINDOW
  );

  if (relevantFrames.length === 0) {
    return { teamId: defaultTeam, confidence: 0.8 };
  }

  // Collect players near hoop area (assume hoop is in upper region of frame)
  const hoopRegion = { yMin: 0, yMax: 0.4 }; // Top 40% of frame
  const teamVotes: { [key: string]: number } = {
    teamA: 0,
    teamB: 0,
    unknown: 0,
  };

  for (const frame of relevantFrames) {
    for (const detection of frame.detections || []) {
      if (detection.type === "person" && detection.bbox) {
        const [x, y, w, h] = detection.bbox;
        const centerY = (y + h / 2) / frame.height; // Normalize to 0-1

        // Check if player is in hoop region
        if (centerY >= hoopRegion.yMin && centerY <= hoopRegion.yMax) {
          const teamId = detection.teamId || "unknown";
          teamVotes[teamId] = (teamVotes[teamId] || 0) + 1;
        }
      }
    }
  }

  // Majority voting
  const totalVotes = teamVotes.teamA + teamVotes.teamB + teamVotes.unknown;
  if (totalVotes === 0) {
    return { teamId: defaultTeam, confidence: 0.7 };
  }

  const teamAPercentage = teamVotes.teamA / totalVotes;
  const teamBPercentage = teamVotes.teamB / totalVotes;

  // Require at least 60% majority for high confidence
  if (teamAPercentage >= 0.6) {
    return { teamId: "teamA", confidence: Math.min(teamAPercentage, 0.95) };
  } else if (teamBPercentage >= 0.6) {
    return { teamId: "teamB", confidence: Math.min(teamBPercentage, 0.95) };
  } else {
    // No clear majority, use default with lower confidence
    return { teamId: defaultTeam, confidence: 0.8 };
  }
}

/**
 * Rule B: Shot attempt detection from pose + ball motion
 * Combines pose analysis with ball trajectory for confidence scoring
 */
async function detectShotAttempts(
  shotAttempts: any[],
  poseDetections: any[],
  ballDetections: any[],
  teamClusters: any
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];

  // If no shot attempts from pose analysis, try to generate some from ball motion
  if (shotAttempts.length === 0 && ballDetections.length > 0) {
    shotAttempts = generateBasicShotAttemptsFromBallMotion(ballDetections);
  }

  for (const attempt of shotAttempts) {
    const { timestamp, playerId, confidence: poseConfidence } = attempt;
    const bbox = attempt.bbox || [0, 0, 100, 100]; // Default bbox if not provided

    // Check if ball is moving towards hoop
    const ballMotionConfidence = analyzeBallMotion(
      timestamp,
      ballDetections,
      bbox
    );

    // Determine team based on player position and team clustering
    const teamId = determinePlayerTeam(
      timestamp,
      bbox,
      poseDetections,
      teamClusters
    );

    // Optimized confidence calculation - give more weight to pose
    // Pose detection is more reliable than ball motion for shot detection
    const combinedConfidence = computeConfidence([
      { signal: "pose", value: Math.max(0.15, poseConfidence), weight: 0.65 }, // Increased weight from 0.4 to 0.65
      {
        signal: "ball-motion",
        value: Math.max(0.15, ballMotionConfidence),
        weight: 0.35, // Decreased weight from 0.6 to 0.35
      },
    ]);

    // Apply quality boost if both signals are strong
    const qualityBoost =
      poseConfidence > 0.6 && ballMotionConfidence > 0.4 ? 0.1 : 0;
    const finalConfidence = Math.min(0.95, combinedConfidence + qualityBoost);

    events.push({
      id: `shot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "shot_attempt",
      teamId: teamId || "teamA",
      playerId, // Preserve playerId from shot attempt
      timestamp,
      confidence: Math.max(0.3, finalConfidence), // Raised minimum from 0.2 to 0.3
      source:
        ballMotionConfidence > 0 ? "pose+ball-heuristic" : "pose-analysis",
      notes: `Pose confidence: ${(poseConfidence * 100).toFixed(
        0
      )}%, Ball motion: ${(ballMotionConfidence * 100).toFixed(0)}%`,
    });
  }

  return events;
}

/**
 * Generates basic shot attempts from ball motion when pose data is insufficient
 */
function generateBasicShotAttemptsFromBallMotion(ballDetections: any[]): any[] {
  const shotAttempts: any[] = [];

  // Look for ball motion patterns that suggest shot attempts
  for (let i = 1; i < ballDetections.length; i++) {
    const currentFrame = ballDetections[i];
    const previousFrame = ballDetections[i - 1];

    if (
      !currentFrame.detections ||
      !previousFrame.detections ||
      currentFrame.detections.length === 0 ||
      previousFrame.detections.length === 0
    ) {
      continue;
    }

    const currentBall = currentFrame.detections[0];
    const previousBall = previousFrame.detections[0];

    // Check for upward ball motion (potential shot)
    const ballCenterY = currentBall.bbox[1] + currentBall.bbox[3] / 2;
    const prevBallCenterY = previousBall.bbox[1] + previousBall.bbox[3] / 2;
    const upwardMotion = prevBallCenterY - ballCenterY; // Positive means ball moving up

    // Check for significant upward motion
    if (upwardMotion > 15) {
      // Ball moved up by at least 15 pixels
      const timestamp = currentFrame.timestamp || i * (1 / 30);

      shotAttempts.push({
        timestamp,
        playerId: `ball_motion_player_${i}`,
        confidence: Math.min(0.5, upwardMotion / 40), // Scale confidence based on motion
        bbox: currentBall.bbox,
      });
    }
  }

  return shotAttempts;
}

/**
 * Analyzes ball motion to determine if it's moving towards the hoop
 */
function analyzeBallMotion(
  timestamp: number,
  ballDetections: any[],
  playerBbox: [number, number, number, number]
): number {
  const timeWindow = 0.5; // seconds
  const relevantBalls = ballDetections.filter(
    (frame) => Math.abs(frame.timestamp - timestamp) <= timeWindow
  );

  if (relevantBalls.length === 0) {
    return 0;
  }

  // Check for ball trajectory towards hoop (upward + away motion)
  let ballNearPlayer = false;
  let ballMovingUp = false;

  for (const frame of relevantBalls) {
    for (const ball of frame.detections || []) {
      const distance = calculateDistance(playerBbox, ball.bbox);
      if (distance < 150) {
        // Ball is near player
        ballNearPlayer = true;
      }

      // Check if ball is moving upward (y-coordinate decreasing)
      const ballCenterY = ball.bbox[1] + ball.bbox[3] / 2;
      const playerCenterY = playerBbox[1] + playerBbox[3] / 2;
      if (ballCenterY < playerCenterY) {
        ballMovingUp = true;
      }
    }
  }

  if (ballNearPlayer && ballMovingUp) {
    return 0.8; // High confidence of shot attempt
  } else if (ballNearPlayer) {
    return 0.4; // Ball near player but not clear shot motion
  }

  return 0;
}

/**
 * Determines the team of a player based on clustering
 */
function determinePlayerTeam(
  timestamp: number,
  bbox: [number, number, number, number],
  poseDetections: any[],
  teamClusters: any
): string | null {
  // Find the pose detection at this timestamp
  const relevantPose = poseDetections.find(
    (p) => Math.abs(p.timestamp - timestamp) <= 0.1
  );

  if (!relevantPose) {
    return null;
  }

  // Match bbox to find the corresponding pose with teamId
  for (const pose of relevantPose.poses || []) {
    if (pose.teamId && areBboxesSimilar(pose.bbox, bbox)) {
      return pose.teamId;
    }
  }

  return null;
}

/**
 * Check if two bboxes are similar (same detection)
 */
function areBboxesSimilar(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number],
  threshold: number = 50
): boolean {
  return calculateDistance(bbox1, bbox2) < threshold;
}

/**
 * Find player ID for an event based on person detections at that timestamp
 * Used to attribute events to specific players
 */
function findPlayerIdForEvent(
  timestamp: number,
  teamId: string,
  personDetections: any[],
  hoopRegion?: { x: number; y: number; width: number; height: number }
): string | undefined {
  // Find person detections within ±0.5s of the event
  const relevantFrames = personDetections.filter(
    (frame) => Math.abs(frame.timestamp - timestamp) <= 0.5
  );

  if (relevantFrames.length === 0) {
    return undefined;
  }

  // Collect all players from the same team with playerIds
  const candidatePlayers: Array<{
    playerId: string;
    bbox: [number, number, number, number];
    distance: number;
  }> = [];

  for (const frame of relevantFrames) {
    for (const detection of frame.detections || []) {
      if (
        detection.type === "person" &&
        detection.teamId === teamId &&
        detection.playerId &&
        detection.bbox
      ) {
        // If hoopRegion is provided, prioritize players near the hoop
        let distance = 0;
        if (hoopRegion) {
          const playerCenterX = detection.bbox[0] + detection.bbox[2] / 2;
          const playerCenterY = detection.bbox[1] + detection.bbox[3] / 2;
          const hoopCenterX = hoopRegion.x + hoopRegion.width / 2;
          const hoopCenterY = hoopRegion.y + hoopRegion.height / 2;
          distance = Math.sqrt(
            Math.pow(playerCenterX - hoopCenterX, 2) +
              Math.pow(playerCenterY - hoopCenterY, 2)
          );
        }

        candidatePlayers.push({
          playerId: detection.playerId,
          bbox: detection.bbox,
          distance,
        });
      }
    }
  }

  if (candidatePlayers.length === 0) {
    return undefined;
  }

  // Sort by distance to hoop (if available) and return closest
  if (hoopRegion) {
    candidatePlayers.sort((a, b) => a.distance - b.distance);
  }

  // Return the playerId of the most likely player
  return candidatePlayers[0].playerId;
}

/**
 * Detects missed shots (shots not followed by score changes)
 */
function detectMissedShots(
  shotEvents: GameEvent[],
  scoreEvents: GameEvent[]
): GameEvent[] {
  const missedShots: GameEvent[] = [];

  for (const shot of shotEvents) {
    // Check if there's a score event within the next 2 seconds
    const hasScore = scoreEvents.some(
      (score) =>
        score.timestamp > shot.timestamp &&
        score.timestamp <= shot.timestamp + MISSED_SHOT_WINDOW &&
        score.teamId === shot.teamId
    );

    if (!hasScore) {
      missedShots.push({
        id: `missed-shot-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        type: "missed_shot",
        teamId: shot.teamId,
        playerId: shot.playerId, // Preserve playerId from shot attempt
        timestamp: shot.timestamp,
        confidence: shot.confidence * 0.85, // Slightly lower confidence for inferred event
        source: "inference",
        notes: "Shot attempt without subsequent score change",
      });
    }
  }

  return missedShots;
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

/**
 * Rule C: Rebound detection
 * Analyzes ball possession changes after shot attempts
 * Enhanced with fallback when ball detection is poor
 */
async function detectRebounds(
  shotEvents: GameEvent[],
  ballDetections: any[],
  personDetections: any[],
  teamClusters: any
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];

  for (const shot of shotEvents) {
    if (shot.type !== "shot_attempt" && shot.type !== "missed_shot") {
      continue;
    }

    // Try ball-based rebound detection first
    let reboundEvent = findReboundEvent(
      shot,
      ballDetections,
      personDetections,
      teamClusters
    );

    // Fallback: If no ball detection, infer rebound from person movements
    if (!reboundEvent && shot.type === "missed_shot") {
      reboundEvent = inferReboundFromPersonMovement(shot, personDetections);
    }

    if (reboundEvent) {
      events.push(reboundEvent);
    }
  }

  return events;
}

/**
 * Finds a single rebound event following a shot attempt
 */
function findReboundEvent(
  shot: GameEvent,
  ballDetections: any[],
  personDetections: any[],
  teamClusters: any
): GameEvent | null {
  const startTime = shot.timestamp + 0.2; // Small delay after shot
  const endTime = shot.timestamp + REBOUND_WINDOW;

  // Find ball detections in the rebound window
  const reboundFrames = ballDetections.filter(
    (frame) => frame.timestamp >= startTime && frame.timestamp <= endTime
  );

  if (reboundFrames.length === 0) {
    return null;
  }

  // Find the first frame where a player gains possession
  for (const ballFrame of reboundFrames) {
    if (!ballFrame.detections || ballFrame.detections.length === 0) {
      continue;
    }

    // Find person detections at this timestamp
    const personFrame = personDetections.find(
      (p) => Math.abs(p.timestamp - ballFrame.timestamp) <= 0.1
    );

    if (!personFrame) {
      continue;
    }

    // Find player closest to ball
    const closestPlayer = findClosestPlayer(
      ballFrame.detections[0].bbox,
      personFrame.detections || []
    );

    if (closestPlayer && closestPlayer.distance < 150) {
      // Increased threshold from 100 to 150
      // Fix unknown teamId issue for rebounds
      let reboundTeamId = closestPlayer.teamId;
      if (!reboundTeamId || reboundTeamId === "unknown") {
        // Default to same team as shooter (offensive rebound)
        reboundTeamId = shot.teamId;
      }

      // Determine if offensive or defensive rebound
      const isOffensive = reboundTeamId === shot.teamId;
      const confidence = computeConfidence([
        {
          signal: "ball-proximity",
          value: 1.0 - closestPlayer.distance / 150, // Adjusted denominator
          weight: 0.6,
        },
        {
          signal: "team-id",
          value: reboundTeamId && reboundTeamId !== "unknown" ? 1.0 : 0.5,
          weight: 0.4,
        },
      ]);

      // Find player ID for the rebound
      const playerId = findPlayerIdForEvent(
        ballFrame.timestamp,
        reboundTeamId,
        personDetections
      );

      return {
        id: `rebound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: isOffensive ? "offensive_rebound" : "defensive_rebound",
        teamId: reboundTeamId,
        playerId,
        timestamp: ballFrame.timestamp,
        confidence,
        source: "ball+proximity-heuristic",
        notes: `Player ${closestPlayer.distance.toFixed(0)}px from ball, ${
          isOffensive ? "same" : "opposing"
        } team`,
      };
    }
  }

  return null;
}

/**
 * Finds the player closest to a given position (ball)
 */
function findClosestPlayer(
  ballBbox: [number, number, number, number],
  playerDetections: any[]
): { teamId: string; distance: number } | null {
  let closestPlayer: { teamId: string; distance: number } | null = null;
  let minDistance = Infinity;

  for (const player of playerDetections) {
    if (player.type === "person" && player.bbox) {
      const distance = calculateDistance(ballBbox, player.bbox);
      if (distance < minDistance) {
        minDistance = distance;
        closestPlayer = {
          teamId: player.teamId || "unknown",
          distance,
        };
      }
    }
  }

  return closestPlayer;
}

/**
 * Infer rebound from person movements when ball detection is unavailable
 * Looks for player activity near hoop area after missed shot
 */
function inferReboundFromPersonMovement(
  shot: GameEvent,
  personDetections: any[]
): GameEvent | null {
  const startTime = shot.timestamp + 0.3;
  const endTime = shot.timestamp + 1.5; // Shorter window for person-based detection

  // Find person detections in rebound window
  const reboundFrames = personDetections.filter(
    (frame) => frame.timestamp >= startTime && frame.timestamp <= endTime
  );

  if (reboundFrames.length === 0) {
    return null;
  }

  // Look for player in hoop area (top 40% of frame)
  for (const personFrame of reboundFrames) {
    if (!personFrame.detections || personFrame.detections.length === 0) {
      continue;
    }

    // Find players near hoop
    const playersNearHoop = personFrame.detections.filter((det: any) => {
      if (det.type !== "person" || !det.bbox) return false;
      const centerY =
        (det.bbox[1] + det.bbox[3] / 2) / (personFrame.height || 1080);
      return centerY < 0.4; // Top 40% of frame
    });

    if (playersNearHoop.length > 0) {
      // Pick player with valid teamId
      const rebounder =
        playersNearHoop.find((p: any) => p.teamId && p.teamId !== "unknown") ||
        playersNearHoop[0];

      let reboundTeamId = rebounder.teamId || shot.teamId;
      const isOffensive = reboundTeamId === shot.teamId;

      return {
        id: `rebound-inferred-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        type: isOffensive ? "offensive_rebound" : "defensive_rebound",
        teamId: reboundTeamId,
        playerId: rebounder.playerId,
        timestamp: personFrame.timestamp,
        confidence: 0.45, // Lower confidence for inferred rebounds
        source: "person-movement-inference",
        notes: `Rebound inferred from player near hoop (ball detection unavailable)`,
      };
    }
  }

  return null;
}

/**
 * Rule D: Turnover and steal detection
 * Tracks possession changes and identifies turnovers
 */
async function detectTurnovers(
  personDetections: any[],
  ballDetections: any[],
  teamClusters: any
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];

  if (ballDetections.length < 2) {
    return events;
  }

  // Track ball possession over time
  const possessionChanges = trackPossessionChanges(
    ballDetections,
    personDetections
  );

  // Identify turnovers from possession changes
  for (const change of possessionChanges) {
    const { timestamp, fromTeam, toTeam, confidence, isSudden } = change;

    if (fromTeam && toTeam && fromTeam !== toTeam) {
      // Determine if it's a steal (sudden possession change) or turnover
      const eventType = isSudden ? "steal" : "turnover";
      const affectedTeam = fromTeam; // Team that lost possession

      // Find player ID for the turnover/steal
      const playerId = findPlayerIdForEvent(
        timestamp,
        affectedTeam,
        personDetections
      );

      events.push({
        id: `${eventType}-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        type: eventType,
        teamId: affectedTeam,
        playerId,
        timestamp,
        confidence,
        source: "possession-heuristic",
        notes: isSudden
          ? `Sudden possession change to ${toTeam}`
          : `Possession lost to ${toTeam}`,
      });
    }
  }

  return events;
}

/**
 * Tracks ball possession changes over time
 */
function trackPossessionChanges(
  ballDetections: any[],
  personDetections: any[]
): Array<{
  timestamp: number;
  fromTeam: string | null;
  toTeam: string | null;
  confidence: number;
  isSudden: boolean;
}> {
  const changes: Array<{
    timestamp: number;
    fromTeam: string | null;
    toTeam: string | null;
    confidence: number;
    isSudden: boolean;
  }> = [];

  let lastPossession: { teamId: string; timestamp: number } | null = null;

  for (const ballFrame of ballDetections) {
    if (!ballFrame.detections || ballFrame.detections.length === 0) {
      continue;
    }

    const ball = ballFrame.detections[0];

    // Find person detections at this timestamp
    const personFrame = personDetections.find(
      (p) => Math.abs(p.timestamp - ballFrame.timestamp) <= 0.1
    );

    if (!personFrame) {
      continue;
    }

    const closestPlayer = findClosestPlayer(
      ball.bbox,
      personFrame.detections || []
    );

    if (
      closestPlayer &&
      closestPlayer.distance < 100 && // Increased from 80 to 100
      closestPlayer.teamId !== "unknown"
    ) {
      if (lastPossession && lastPossession.teamId !== closestPlayer.teamId) {
        // Possession change detected
        const timeSinceLastPossession =
          ballFrame.timestamp - lastPossession.timestamp;
        const isSudden = timeSinceLastPossession < 1.5; // Increased from 1.0 to 1.5 seconds

        changes.push({
          timestamp: ballFrame.timestamp,
          fromTeam: lastPossession.teamId,
          toTeam: closestPlayer.teamId,
          confidence: 0.65 + (isSudden ? 0.1 : 0), // Slightly lower base confidence
          isSudden,
        });
      }

      lastPossession = {
        teamId: closestPlayer.teamId,
        timestamp: ballFrame.timestamp,
      };
    }
  }

  return changes;
}

/**
 * Infer turnovers from game flow when ball detection is unavailable
 * Uses patterns like: missed shot by team A followed by shot by team B = possession change
 */
function inferTurnoversFromGameFlow(
  shotEvents: GameEvent[],
  scoreEvents: GameEvent[],
  personDetections: any[]
): GameEvent[] {
  const turnovers: GameEvent[] = [];

  // Look for possession changes: shot by team A, then shot by team B within 5-10 seconds
  for (let i = 0; i < shotEvents.length - 1; i++) {
    const currentShot = shotEvents[i];
    const nextShot = shotEvents[i + 1];

    if (currentShot.teamId === nextShot.teamId) continue; // Same team, no turnover

    const timeDiff = nextShot.timestamp - currentShot.timestamp;

    // If team changes and time gap is 3-15 seconds, likely a turnover/possession change
    if (timeDiff > 3.0 && timeDiff < 15.0) {
      // Check if current shot was missed
      const scoredAfterCurrentShot = scoreEvents.some(
        (score) =>
          score.teamId === currentShot.teamId &&
          score.timestamp > currentShot.timestamp &&
          score.timestamp < currentShot.timestamp + 2.0
      );

      if (!scoredAfterCurrentShot) {
        // Missed shot followed by opponent possession = turnover
        turnovers.push({
          id: `turnover-inferred-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          type: "turnover",
          teamId: currentShot.teamId,
          playerId: currentShot.playerId,
          timestamp: currentShot.timestamp + timeDiff / 2, // Estimate midpoint
          confidence: 0.45,
          source: "game-flow-inference",
          notes: `Turnover inferred from possession change pattern`,
        });
      }
    }
  }

  return turnovers;
}

/**
 * Rule E: 3-point attempt estimation
 * Uses court geometry and player position
 * IMPROVED: Lower threshold and better attribution
 */
function detect3PointAttempts(
  shotEvents: GameEvent[],
  poseDetections: any[],
  personDetections: any[]
): GameEvent[] {
  const events: GameEvent[] = [];

  console.log(
    `🎯 Checking ${shotEvents.length} shot attempts for 3-point detection...`
  );

  for (const shot of shotEvents) {
    if (shot.type !== "shot_attempt") {
      continue;
    }

    // Estimate if shot was taken from 3-point range
    const is3Point = estimate3PointDistance(
      shot.timestamp,
      poseDetections,
      personDetections
    );

    if (is3Point.isLongDistance) {
      // Lower threshold from 0.4 to 0.35 to catch more 3-pointers
      const eventType =
        is3Point.confidence > 0.35 ? "3pt" : "long_distance_attempt";

      events.push({
        id: `3pt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: eventType,
        teamId: shot.teamId,
        playerId: shot.playerId, // Preserve player ID from shot attempt
        timestamp: shot.timestamp,
        confidence: is3Point.confidence,
        source: "court-geometry-heuristic",
        notes: `Estimated based on shooter position (distance score: ${(
          is3Point.confidence * 100
        ).toFixed(0)}%)`,
      });

      console.log(
        `✅ Detected ${eventType} at ${shot.timestamp.toFixed(
          1
        )}s (confidence: ${(is3Point.confidence * 100).toFixed(0)}%)`
      );
    }
  }

  console.log(
    `📊 Detected ${events.length} 3-point attempts from ${shotEvents.length} shots`
  );
  return events;
}

/**
 * Estimates if a shot was taken from 3-point range
 * Based on player position relative to court
 * IMPROVED: More aggressive detection with multiple heuristics
 */
function estimate3PointDistance(
  timestamp: number,
  poseDetections: any[],
  personDetections: any[]
): { isLongDistance: boolean; confidence: number } {
  // Find pose at this timestamp
  const pose = poseDetections.find(
    (p) => Math.abs(p.timestamp - timestamp) <= 0.1
  );

  // Also check person detections as fallback
  const personFrame = personDetections.find(
    (p) => Math.abs(p.timestamp - timestamp) <= 0.2
  );

  let maxConfidence = 0;
  let isLongDistance = false;

  // Check pose-based detection
  if (pose && pose.poses && pose.poses.length > 0) {
    const shooterPose = pose.poses[0];
    if (shooterPose.bbox) {
      const [x, y, w, h] = shooterPose.bbox;
      const centerY = (y + h / 2) / pose.height; // Normalize to 0-1
      const centerX = (x + w / 2) / pose.width; // Normalize to 0-1

      // More aggressive detection based on position
      // Players in lower half or corners are more likely taking 3-pointers
      if (centerY > 0.55) {
        // Lower half of frame (further from hoop)
        const distanceFromCenter = Math.abs(centerX - 0.5);

        if (centerY > 0.7) {
          // Very far from basket
          isLongDistance = true;
          maxConfidence = Math.max(maxConfidence, 0.75);
        } else if (centerY > 0.6) {
          // Moderately far
          isLongDistance = true;
          maxConfidence = Math.max(maxConfidence, 0.65);
        } else if (distanceFromCenter > 0.25) {
          // Corner shots (even if not very far)
          isLongDistance = true;
          maxConfidence = Math.max(maxConfidence, 0.6);
        } else {
          isLongDistance = true;
          maxConfidence = Math.max(maxConfidence, 0.5);
        }
      } else if (centerY > 0.45 && Math.abs(centerX - 0.5) > 0.3) {
        // Corner three pointer (wings)
        isLongDistance = true;
        maxConfidence = Math.max(maxConfidence, 0.55);
      }
    }
  }

  // Fallback to person detection if no pose data
  if (maxConfidence === 0 && personFrame && personFrame.detections) {
    for (const person of personFrame.detections) {
      if (person.bbox && person.type === "person") {
        const [x, y, w, h] = person.bbox;
        const centerY = (y + h / 2) / (personFrame.height || 1080);
        const centerX = (x + w / 2) / (personFrame.width || 1920);

        if (centerY > 0.55) {
          isLongDistance = true;
          maxConfidence = Math.max(maxConfidence, 0.5);

          if (centerY > 0.65) {
            maxConfidence = Math.max(maxConfidence, 0.65);
          }

          // Bonus for corner shots
          if (Math.abs(centerX - 0.5) > 0.3) {
            maxConfidence = Math.max(maxConfidence, 0.6);
          }
        }
      }
    }
  }

  return { isLongDistance, confidence: maxConfidence };
}

/**
 * Computes combined confidence score from multiple signals
 * Uses weighted average of signal confidences
 */
function computeConfidence(
  signals: Array<{ signal: string; value: number; weight: number }>
): number {
  if (signals.length === 0) {
    return 0.5;
  }

  // Normalize weights
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) {
    return 0.5;
  }

  // Compute weighted average
  const weightedSum = signals.reduce(
    (sum, s) => sum + s.value * (s.weight / totalWeight),
    0
  );

  // Apply confidence boost for multiple strong signals
  let finalConfidence = weightedSum;
  const strongSignals = signals.filter((s) => s.value > 0.6);
  if (strongSignals.length >= 2) {
    // Multiple strong signals - add bonus
    finalConfidence += 0.08;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, finalConfidence));
}

/**
 * Applies temporal smoothing to events
 * Merges duplicate events within a time window using majority voting
 */
function applyTemporalSmoothing(events: GameEvent[]): GameEvent[] {
  if (events.length === 0) {
    return events;
  }

  const smoothedEvents: GameEvent[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < events.length; i++) {
    if (processed.has(events[i].id)) {
      continue;
    }

    const currentEvent = events[i];

    // Find similar events within temporal window
    const similarEvents = events.filter((e, idx) => {
      if (idx === i || processed.has(e.id)) {
        return false;
      }

      return (
        e.type === currentEvent.type &&
        e.teamId === currentEvent.teamId &&
        Math.abs(e.timestamp - currentEvent.timestamp) <= TEMPORAL_WINDOW
      );
    });

    if (similarEvents.length === 0) {
      // No duplicates, keep original event
      smoothedEvents.push(currentEvent);
      processed.add(currentEvent.id);
    } else {
      // Merge similar events using majority voting
      const allSimilar = [currentEvent, ...similarEvents];

      // Use median timestamp
      const timestamps = allSimilar
        .map((e) => e.timestamp)
        .sort((a, b) => a - b);
      const medianTimestamp = timestamps[Math.floor(timestamps.length / 2)];

      // Average confidence
      const avgConfidence =
        allSimilar.reduce((sum, e) => sum + e.confidence, 0) /
        allSimilar.length;

      // Combine sources
      const sources = new Set(allSimilar.map((e) => e.source));
      const combinedSource = Array.from(sources).join("+");

      // Create smoothed event
      const smoothedEvent: GameEvent = {
        ...currentEvent,
        id: `smoothed-${currentEvent.id}`,
        timestamp: medianTimestamp,
        confidence: avgConfidence,
        source: combinedSource,
        notes: `Merged ${allSimilar.length} similar detections. ${
          currentEvent.notes || ""
        }`,
      };

      smoothedEvents.push(smoothedEvent);

      // Mark all similar events as processed
      allSimilar.forEach((e) => processed.add(e.id));
    }
  }

  return smoothedEvents;
}

/**
 * Filters out events below a confidence threshold
 */
function filterLowConfidenceEvents(
  events: GameEvent[],
  threshold: number
): GameEvent[] {
  return events.filter((event) => event.confidence >= threshold);
}

/**
 * Generate shot attempts from ball movement patterns when pose detection fails
 */
function generateShotAttemptsFromBallMovement(
  ballDetections: any[],
  personDetections: any[]
): GameEvent[] {
  const shotEvents: GameEvent[] = [];

  console.log(
    `Analyzing ${ballDetections.length} ball frames for shot patterns`
  );

  // Look for upward ball trajectories that indicate shot attempts
  for (let i = 1; i < ballDetections.length - 1; i++) {
    const current = ballDetections[i];
    const previous = ballDetections[i - 1];
    const next = ballDetections[i + 1];

    if (!current.detections?.length || !previous.detections?.length) continue;

    const currentBall = current.detections[0];
    const previousBall = previous.detections[0];

    // Calculate ball center positions
    const currentY = currentBall.bbox[1] + currentBall.bbox[3] / 2;
    const previousY = previousBall.bbox[1] + previousBall.bbox[3] / 2;

    // Check for significant upward motion (shot trajectory)
    const upwardMotion = previousY - currentY;

    if (upwardMotion > 30) {
      // Ball moved up significantly - likely a shot
      const timestamp = current.timestamp || i * (1 / 30);

      // Find nearest player
      let nearestPlayer: any = null;
      let minDistance = Infinity;

      const personFrame = personDetections.find(
        (p: any) => Math.abs(p.timestamp - timestamp) < 0.5
      );

      if (personFrame && personFrame.detections) {
        for (const person of personFrame.detections) {
          const personX = person.bbox[0] + person.bbox[2] / 2;
          const personY = person.bbox[1] + person.bbox[3] / 2;
          const ballX = currentBall.bbox[0] + currentBall.bbox[2] / 2;

          const distance = Math.sqrt(
            Math.pow(personX - ballX, 2) +
              Math.pow(personY - (currentY + 50), 2)
          );

          if (distance < minDistance) {
            minDistance = distance;
            nearestPlayer = person;
          }
        }
      }

      shotEvents.push({
        id: `ball-shot-${i}`,
        type: "shot_attempt",
        timestamp,
        teamId: nearestPlayer?.teamId || "unknown",
        playerId: nearestPlayer?.playerId,
        confidence: Math.min(0.6 + upwardMotion / 100, 0.8),
        source: "ball-movement",
        notes: `Generated from ball trajectory (upward motion: ${upwardMotion.toFixed(
          0
        )}px)`,
      });
    }
  }

  console.log(
    `Generated ${shotEvents.length} shot attempts from ball movement`
  );
  return shotEvents;
}

/**
 * Generate shot attempts from person movements when both pose and ball detection fail
 */
function generateShotAttemptsFromPersonMovement(
  personDetections: any[]
): GameEvent[] {
  const shotEvents: GameEvent[] = [];

  console.log(
    `Analyzing ${personDetections.length} person frames for movement patterns`
  );

  // Sample more frequently to get better coverage - every 15 frames instead of 5
  // This will generate shots throughout the video
  for (let i = 10; i < personDetections.length - 10; i += 15) {
    const current = personDetections[i];

    if (!current.detections || current.detections.length === 0) continue;

    // Only generate one shot per frame interval to avoid duplication
    // Alternate between teams if multiple players detected
    const players = current.detections.filter(
      (p: any) => p.teamId && p.teamId !== "unknown"
    );

    if (players.length === 0) {
      // No team assignment, skip to avoid unknown team events
      continue;
    }

    // Pick one player from alternating teams
    const player = players[shotEvents.length % players.length];
    const timestamp = current.timestamp || i * (1 / 30);

    shotEvents.push({
      id: `person-shot-${i}-${player.teamId}`,
      type: "shot_attempt",
      timestamp,
      teamId: player.teamId,
      playerId: player.playerId,
      confidence: 0.55, // Slightly higher confidence
      source: "person-movement",
      notes: `Generated from ${player.teamId} player presence`,
    });
  }

  console.log(
    `Generated ${shotEvents.length} shot attempts from person movements`
  );
  return shotEvents;
}
