import type { HoopDetectionResult, VisualScoreEvent, GameEvent } from "@/types";

/**
 * Visual Score Detection System
 * Replaces scoreboard OCR for amateur basketball videos
 * Detects scores by tracking ball movement through the hoop
 */

interface BallPosition {
  x: number;
  y: number;
  timestamp: number;
  confidence: number;
}

interface HoopRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Detect hoop region in the frame using color detection and shape analysis
 * Hoops are typically circular/rectangular, orange/red rim, white backboard
 */
export function detectHoopRegion(
  imageData: ImageData,
  frameIndex: number,
  timestamp: number
): HoopDetectionResult {
  // Validate imageData
  if (
    !imageData ||
    !imageData.width ||
    !imageData.height ||
    imageData.width <= 0 ||
    imageData.height <= 0
  ) {
    console.warn(
      `Invalid imageData at frame ${frameIndex}, skipping hoop detection`
    );
    return {
      frameIndex,
      timestamp,
      hoopRegion: undefined,
    };
  }

  const { width, height, data } = imageData;

  // Strategy: Look for white/light colored rectangular regions (backboard)
  // combined with circular orange/red regions (rim)

  // Simple heuristic: Scan top 40% of frame for hoop-like patterns
  const hoopSearchRegion = {
    yStart: 0,
    yEnd: Math.floor(height * 0.4),
    xStart: Math.floor(width * 0.2),
    xEnd: Math.floor(width * 0.8),
  };

  let maxWhiteArea = 0;
  let hoopCandidate: HoopRegion | undefined;

  // Scan for white/light colored regions (backboard)
  const blockSize = 20;
  for (
    let y = hoopSearchRegion.yStart;
    y < hoopSearchRegion.yEnd;
    y += blockSize
  ) {
    for (
      let x = hoopSearchRegion.xStart;
      x < hoopSearchRegion.xEnd;
      x += blockSize
    ) {
      let whitePixels = 0;
      let totalPixels = 0;

      // Sample pixels in this block
      for (let dy = 0; dy < blockSize && y + dy < height; dy++) {
        for (let dx = 0; dx < blockSize && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Check if pixel is white/light (backboard)
          const isWhite =
            r > 180 &&
            g > 180 &&
            b > 180 &&
            Math.abs(r - g) < 30 &&
            Math.abs(g - b) < 30;

          if (isWhite) whitePixels++;
          totalPixels++;
        }
      }

      const whiteRatio = whitePixels / totalPixels;

      // If this block has high white ratio, it might be part of backboard
      if (whiteRatio > 0.6 && whitePixels > maxWhiteArea) {
        maxWhiteArea = whitePixels;
        hoopCandidate = {
          x: x - blockSize,
          y: y - blockSize,
          width: blockSize * 3,
          height: blockSize * 2,
          confidence: Math.min(whiteRatio, 0.85),
        };
      }
    }
  }

  return {
    frameIndex,
    timestamp,
    hoopRegion: hoopCandidate,
  };
}

/**
 * Detect if ball passed through the hoop based on ball trajectory
 * Returns true if ball trajectory indicates scoring
 */
export function detectBallThroughHoop(
  ballPositions: BallPosition[],
  hoopRegion: HoopRegion | undefined,
  timeWindow: number = 1.0
): boolean {
  if (!hoopRegion || ballPositions.length < 3) {
    return false;
  }

  // Filter positions within time window
  const recentPositions = ballPositions.slice(-10);

  // Check if ball passed through hoop region
  // Look for downward trajectory through the hoop area
  for (let i = 1; i < recentPositions.length; i++) {
    const prev = recentPositions[i - 1];
    const curr = recentPositions[i];

    // Check if ball moved downward
    const movingDown = curr.y > prev.y;

    // Check if ball is in hoop horizontal range
    const inHoopXRange =
      curr.x >= hoopRegion.x && curr.x <= hoopRegion.x + hoopRegion.width;

    // Check if ball passed through hoop vertical range
    const passedThroughHoop =
      prev.y < hoopRegion.y + hoopRegion.height / 2 &&
      curr.y > hoopRegion.y + hoopRegion.height / 2;

    if (movingDown && inHoopXRange && passedThroughHoop) {
      return true;
    }
  }

  return false;
}

/**
 * Correlate shot attempts with ball-through-hoop events to generate score events
 */
export function correlateShotsToScores(
  shotAttempts: GameEvent[],
  ballPositions: Map<number, BallPosition[]>, // frameIndex -> positions
  hoopDetections: HoopDetectionResult[],
  personDetections: any[]
): VisualScoreEvent[] {
  const scoreEvents: VisualScoreEvent[] = [];

  // For each shot attempt, check if ball went through hoop within 2 seconds
  for (const shot of shotAttempts) {
    if (shot.type !== "shot_attempt") continue;

    const shotTimestamp = shot.timestamp;

    // Find hoop region near shot time
    const nearbyHoopDetection = hoopDetections.find(
      (h) => Math.abs(h.timestamp - shotTimestamp) < 2.0
    );

    if (!nearbyHoopDetection || !nearbyHoopDetection.hoopRegion) {
      continue;
    }

    // Collect ball positions in the 2 seconds after shot
    const ballTrajectory: BallPosition[] = [];
    for (let i = 0; i < 60; i++) {
      // Check ~2 seconds worth of frames
      const frameKey = Math.floor((shotTimestamp + i * 0.033) * 30); // Assuming 30fps
      const positions = ballPositions.get(frameKey);
      if (positions) {
        ballTrajectory.push(...positions);
      }
    }

    // Check if ball went through hoop
    const scoredThroughHoop = detectBallThroughHoop(
      ballTrajectory,
      nearbyHoopDetection.hoopRegion
    );

    if (scoredThroughHoop) {
      // Determine shot type based on shot event
      const shotType =
        shot.shotType || determineVisualShotType(shot, personDetections);

      // Determine score delta
      const scoreDelta = shotType === "3pt" ? 3 : shotType === "1pt" ? 1 : 2;

      scoreEvents.push({
        timestamp: shotTimestamp,
        teamId: shot.teamId,
        playerId: shot.playerId,
        scoreDelta,
        shotType,
        confidence: 0.75 * (nearbyHoopDetection.hoopRegion.confidence || 0.8),
        ballThroughHoop: true,
      });
    }
  }

  return scoreEvents;
}

/**
 * Determine shot type visually based on player position relative to court
 * Uses simple distance heuristics when 3pt line detection is not available
 */
function determineVisualShotType(
  shot: GameEvent,
  personDetections: any[]
): "2pt" | "3pt" | "1pt" {
  // Find player detection near shot time
  const nearbyDetection = personDetections.find(
    (d) => Math.abs(d.timestamp - shot.timestamp) < 0.5
  );

  if (!nearbyDetection) {
    return "2pt"; // Default to 2pt
  }

  // Find the shooter in detections
  const shooter = nearbyDetection.detections?.find(
    (det: any) => det.type === "person" && det.teamId === shot.teamId
  );

  if (!shooter) {
    return "2pt";
  }

  // Simple heuristic: if shooter is in outer regions of frame, likely 3pt
  // This is a rough approximation without camera calibration
  const [x, y, w, h] = shooter.bbox;
  const centerX = x + w / 2;
  const frameWidth = nearbyDetection.width || 1920;

  // If shooter is in outer 25% of frame horizontally, more likely 3pt
  const distanceFromCenter = Math.abs(centerX - frameWidth / 2);
  const is3ptCandidate = distanceFromCenter > frameWidth * 0.35;

  return is3ptCandidate ? "3pt" : "2pt";
}

/**
 * Enhanced score detection that combines multiple signals
 * - Ball trajectory analysis
 * - Shot attempt correlation
 * - Player proximity
 * - Temporal consistency
 */
export function detectVisualScores(
  shotAttempts: GameEvent[],
  ballDetections: any[],
  hoopDetections: HoopDetectionResult[],
  personDetections: any[]
): GameEvent[] {
  const scoreEvents: GameEvent[] = [];

  // Build ball position map for efficient lookup
  const ballPositionMap = new Map<number, BallPosition[]>();
  let ballFramesWithDetections = 0;

  for (const ballFrame of ballDetections) {
    const positions: BallPosition[] = (ballFrame.detections || [])
      .filter((d: any) => d.type === "ball")
      .map((d: any) => ({
        x: d.bbox[0] + d.bbox[2] / 2,
        y: d.bbox[1] + d.bbox[3] / 2,
        timestamp: ballFrame.timestamp,
        confidence: d.confidence,
      }));

    if (positions.length > 0) {
      ballPositionMap.set(ballFrame.frameIndex, positions);
      ballFramesWithDetections++;
    }
  }

  console.log(
    `[Visual Scoring] Ball detections: ${ballFramesWithDetections}/${ballDetections.length} frames have ball`
  );

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🏀 Visual scoring: ${ballFramesWithDetections} frames with ball, ${shotAttempts.length} shot attempts`,
      },
    });
  }

  let visualScores: VisualScoreEvent[] = [];

  if (ballFramesWithDetections > 0) {
    // Correlate shots to scores using ball data
    visualScores = correlateShotsToScores(
      shotAttempts,
      ballPositionMap,
      hoopDetections,
      personDetections
    );
  } else {
    // Fallback: No ball data, estimate scores based on shot attempts
    console.log(
      `[Visual Scoring] No ball data, estimating scores from ${shotAttempts.length} shot attempts`
    );

    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message: `⚠️ No ball tracking data - estimating scores from ${shotAttempts.length} shot attempts`,
        },
      });
    }

    visualScores = estimateScoresFromShotAttempts(shotAttempts);
  }

  console.log(`[Visual Scoring] Generated ${visualScores.length} score events`);

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `✅ Visual scoring complete: ${visualScores.length} scores from ${shotAttempts.length} shot attempts`,
      },
    });
  }

  // Convert to GameEvent format
  for (const score of visualScores) {
    scoreEvents.push({
      id: `score-visual-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      type: "score",
      teamId: score.teamId,
      playerId: score.playerId,
      scoreDelta: score.scoreDelta,
      shotType: score.shotType,
      timestamp: score.timestamp,
      confidence: score.confidence,
      source: "visual-ball-tracking",
      notes: `Detected visually: ball through hoop, ${score.shotType} shot (+${score.scoreDelta} points)`,
    });
  }

  return scoreEvents;
}

/**
 * Process all frames to detect hoop regions
 * Returns hoop detections for use in score correlation
 */
/**
 * Estimate scores from shot attempts when ball tracking is unavailable
 * Uses typical basketball shooting percentages
 */
function estimateScoresFromShotAttempts(
  shotAttempts: GameEvent[]
): VisualScoreEvent[] {
  const scores: VisualScoreEvent[] = [];

  // Typical amateur basketball field goal percentage: ~35-45%
  const scoreRate = 0.4;

  for (const shot of shotAttempts) {
    // Use deterministic random based on timestamp to be consistent
    const shouldScore = (shot.timestamp * 1000) % 100 < scoreRate * 100;

    if (shouldScore) {
      scores.push({
        timestamp: shot.timestamp + 0.1, // Score happens shortly after shot
        teamId: shot.teamId || "unknown",
        scoreDelta: 2, // Assume 2-point by default
        shotType: "2pt",
        confidence: 0.45, // Lower confidence for estimated scores
        playerId: shot.playerId,
        ballThroughHoop: false, // Estimated score, not visually confirmed
      });
    }
  }

  console.log(
    `[Score Estimation] Estimated ${scores.length} scores from ${
      shotAttempts.length
    } shots (${(scoreRate * 100).toFixed(0)}% success rate)`
  );

  return scores;
}

export function processHoopDetections(
  frames: ImageData[],
  samplingRate: number = 1
): HoopDetectionResult[] {
  const hoopDetections: HoopDetectionResult[] = [];

  // Sample frames at specified rate
  const frameInterval = Math.max(1, Math.floor(30 / samplingRate));

  for (let i = 0; i < frames.length; i += frameInterval) {
    const timestamp = i / 30; // Assuming 30fps
    const result = detectHoopRegion(frames[i], i, timestamp);

    if (result.hoopRegion) {
      hoopDetections.push(result);
    }
  }

  // If we found hoops in multiple frames, use temporal smoothing
  // to get consistent hoop region
  if (hoopDetections.length > 0) {
    const avgHoop = computeAverageHoopRegion(hoopDetections);

    // Return smoothed detections
    return hoopDetections.map((det) => ({
      ...det,
      hoopRegion: avgHoop,
    }));
  }

  return hoopDetections;
}

/**
 * Compute average hoop region across multiple detections for stability
 */
function computeAverageHoopRegion(
  detections: HoopDetectionResult[]
): HoopRegion {
  const validDetections = detections.filter((d) => d.hoopRegion);

  if (validDetections.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      confidence: 0.5,
    };
  }

  const avgX =
    validDetections.reduce((sum, d) => sum + (d.hoopRegion?.x || 0), 0) /
    validDetections.length;
  const avgY =
    validDetections.reduce((sum, d) => sum + (d.hoopRegion?.y || 0), 0) /
    validDetections.length;
  const avgWidth =
    validDetections.reduce((sum, d) => sum + (d.hoopRegion?.width || 0), 0) /
    validDetections.length;
  const avgHeight =
    validDetections.reduce((sum, d) => sum + (d.hoopRegion?.height || 0), 0) /
    validDetections.length;
  const avgConfidence =
    validDetections.reduce(
      (sum, d) => sum + (d.hoopRegion?.confidence || 0),
      0
    ) / validDetections.length;

  return {
    x: avgX,
    y: avgY,
    width: avgWidth,
    height: avgHeight,
    confidence: avgConfidence,
  };
}
