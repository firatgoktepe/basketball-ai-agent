import type { GameEvent, PoseResult } from "@/types";

/**
 * Advanced Action Recognition System
 * Detects basketball-specific actions: blocks, passes, dunks, assists, layups, dribbles
 */

const POSE_KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

/**
 * Detect blocks: Defensive player interfering with shot attempt
 * Looks for defensive player with raised arms near shooter
 */
export function detectBlocks(
  shotAttempts: GameEvent[],
  poseDetections: PoseResult[],
  personDetections: any[]
): GameEvent[] {
  const blocks: GameEvent[] = [];

  for (const shot of shotAttempts) {
    if (shot.type !== "shot_attempt") continue;

    // Find poses near shot time
    const nearbyPoses = poseDetections.filter(
      (p) => Math.abs(p.timestamp - shot.timestamp) < 0.3
    );

    for (const poseFrame of nearbyPoses) {
      for (const pose of poseFrame.poses) {
        // Skip if same team as shooter
        if (pose.teamId === shot.teamId) continue;

        // Check for defensive stance: arms raised high
        const leftWrist = pose.keypoints[9]; // left_wrist
        const rightWrist = pose.keypoints[10]; // right_wrist
        const leftShoulder = pose.keypoints[5]; // left_shoulder
        const rightShoulder = pose.keypoints[6]; // right_shoulder

        if (
          leftWrist &&
          rightWrist &&
          leftShoulder &&
          rightShoulder &&
          leftWrist.confidence > 0.3 &&
          rightWrist.confidence > 0.3
        ) {
          // Arms raised if wrists are above shoulders
          const leftArmRaised = leftWrist.y < leftShoulder.y - 30;
          const rightArmRaised = rightWrist.y < rightShoulder.y - 30;

          if (leftArmRaised || rightArmRaised) {
            // Check proximity to shooter
            const shooterFrame = personDetections.find(
              (p) => Math.abs(p.timestamp - shot.timestamp) < 0.2
            );

            if (shooterFrame) {
              const shooter = shooterFrame.detections?.find(
                (d: any) => d.teamId === shot.teamId
              );

              if (shooter && pose.bbox) {
                const [sx, sy] = shooter.bbox;
                const [bx, by] = pose.bbox;
                const dist = Math.sqrt(
                  Math.pow(sx - bx, 2) + Math.pow(sy - by, 2)
                );

                // If defender is close to shooter (within ~100 pixels)
                if (dist < 150) {
                  blocks.push({
                    id: `block-${Date.now()}-${Math.random()
                      .toString(36)
                      .substr(2, 9)}`,
                    type: "block",
                    teamId: pose.teamId || "unknown",
                    playerId: pose.playerId,
                    timestamp: poseFrame.timestamp,
                    confidence: 0.65,
                    source: "pose-analysis",
                    notes: `Defensive block detected: raised arms near shooter`,
                  });

                  break; // Only one block per shot
                }
              }
            }
          }
        }
      }
    }
  }

  return blocks;
}

/**
 * Detect passes: Ball transfer between same-team players
 * Looks for ball proximity changes between players
 */
export function detectPasses(
  ballDetections: any[],
  personDetections: any[],
  teamClusters: any
): GameEvent[] {
  const passes: GameEvent[] = [];

  let previousHolder: {
    teamId: string;
    playerId?: string;
    timestamp: number;
  } | null = null;

  for (const ballFrame of ballDetections) {
    const ballDet = ballFrame.detections?.find((d: any) => d.type === "ball");
    if (!ballDet) continue;

    const [ballX, ballY] = [
      ballDet.bbox[0] + ballDet.bbox[2] / 2,
      ballDet.bbox[1] + ballDet.bbox[3] / 2,
    ];

    // Find closest player to ball
    const personFrame = personDetections.find(
      (p) => Math.abs(p.timestamp - ballFrame.timestamp) < 0.1
    );

    if (!personFrame) continue;

    let closestPlayer: any = null;
    let minDist = Infinity;

    for (const det of personFrame.detections || []) {
      if (det.type !== "person") continue;

      const [px, py] = [
        det.bbox[0] + det.bbox[2] / 2,
        det.bbox[1] + det.bbox[3] / 2,
      ];
      const dist = Math.sqrt(Math.pow(ballX - px, 2) + Math.pow(ballY - py, 2));

      if (dist < minDist && dist < 80) {
        // Within ~80 pixels
        minDist = dist;
        closestPlayer = det;
      }
    }

    if (closestPlayer) {
      const currentHolder = {
        teamId: closestPlayer.teamId || "unknown",
        playerId: closestPlayer.playerId,
        timestamp: ballFrame.timestamp,
      };

      // Check if ball changed hands within same team
      if (
        previousHolder &&
        previousHolder.teamId === currentHolder.teamId &&
        previousHolder.playerId !== currentHolder.playerId &&
        currentHolder.timestamp - previousHolder.timestamp < 2.0
      ) {
        // Pass detected
        passes.push({
          id: `pass-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "pass",
          teamId: currentHolder.teamId,
          playerId: previousHolder.playerId, // Passer
          timestamp: currentHolder.timestamp,
          confidence: 0.6,
          source: "ball-tracking",
          notes: `Pass from player ${previousHolder.playerId || "unknown"} to ${
            currentHolder.playerId || "unknown"
          }`,
        });
      }

      previousHolder = currentHolder;
    }
  }

  return passes;
}

/**
 * Detect dunks: High-confidence close-range shot with vertical arm motion
 * Identified by player near hoop with arms fully extended upward
 */
export function detectDunks(
  shotAttempts: GameEvent[],
  poseDetections: PoseResult[],
  personDetections: any[]
): GameEvent[] {
  const dunks: GameEvent[] = [];

  for (const shot of shotAttempts) {
    if (shot.type !== "shot_attempt") continue;

    // Find pose near shot time
    const nearbyPose = poseDetections.find(
      (p) => Math.abs(p.timestamp - shot.timestamp) < 0.2
    );

    if (!nearbyPose) continue;

    for (const pose of nearbyPose.poses) {
      if (pose.teamId !== shot.teamId) continue;

      // Check for dunk indicators:
      // 1. Arms fully extended above head
      // 2. Player very close to hoop (top of frame)
      const leftWrist = pose.keypoints[9];
      const rightWrist = pose.keypoints[10];
      const nose = pose.keypoints[0];

      if (
        !leftWrist ||
        !rightWrist ||
        !nose ||
        leftWrist.confidence < 0.3 ||
        rightWrist.confidence < 0.3
      ) {
        continue;
      }

      // Arms extended above head
      const armsExtended =
        leftWrist.y < nose.y - 50 || rightWrist.y < nose.y - 50;

      // Player in top region of frame (near hoop)
      const nearHoop = pose.bbox && pose.bbox[1] < 200; // Within top 200 pixels

      if (armsExtended && nearHoop) {
        dunks.push({
          id: `dunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "dunk",
          teamId: shot.teamId,
          playerId: pose.playerId || shot.playerId,
          timestamp: shot.timestamp,
          confidence: 0.75,
          source: "pose-analysis",
          notes: `Dunk detected: arms extended above head near hoop`,
        });

        break; // Only one dunk per shot
      }
    }
  }

  return dunks;
}

/**
 * Detect layups: Close-range shots with approach motion
 * Identified by player movement toward hoop with shooting motion
 */
export function detectLayups(
  shotAttempts: GameEvent[],
  poseDetections: PoseResult[],
  personDetections: any[]
): GameEvent[] {
  const layups: GameEvent[] = [];

  for (const shot of shotAttempts) {
    if (shot.type !== "shot_attempt") continue;

    // Find consecutive pose frames around shot
    const poseSequence = poseDetections
      .filter((p) => Math.abs(p.timestamp - shot.timestamp) < 0.5)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (poseSequence.length < 2) continue;

    // Look for upward arm motion combined with forward body motion
    for (let i = 1; i < poseSequence.length; i++) {
      const prevFrame = poseSequence[i - 1];
      const currFrame = poseSequence[i];

      const prevPose = prevFrame.poses.find((p) => p.teamId === shot.teamId);
      const currPose = currFrame.poses.find((p) => p.teamId === shot.teamId);

      if (!prevPose || !currPose) continue;

      // Check for upward arm extension
      const prevWrist = prevPose.keypoints[10]; // right wrist
      const currWrist = currPose.keypoints[10];

      if (
        !prevWrist ||
        !currWrist ||
        prevWrist.confidence < 0.3 ||
        currWrist.confidence < 0.3
      ) {
        continue;
      }

      const armRaised = currWrist.y < prevWrist.y - 20;

      // Check if player is in close range (top half of frame)
      const inCloseRange = currPose.bbox && currPose.bbox[1] < 300;

      if (armRaised && inCloseRange) {
        layups.push({
          id: `layup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "layup",
          teamId: shot.teamId,
          playerId: currPose.playerId || shot.playerId,
          timestamp: shot.timestamp,
          confidence: 0.7,
          source: "pose-analysis",
          notes: `Layup detected: close-range shot with approach motion`,
        });

        break;
      }
    }
  }

  return layups;
}

/**
 * Detect assists: Pass immediately before score
 * Links pass events to score events within 2 seconds
 */
export function detectAssists(
  passes: GameEvent[],
  scores: GameEvent[]
): GameEvent[] {
  const assists: GameEvent[] = [];

  for (const score of scores) {
    // Find pass within 2 seconds before score
    const recentPass = passes
      .filter(
        (p) =>
          p.teamId === score.teamId &&
          score.timestamp - p.timestamp > 0 &&
          score.timestamp - p.timestamp < 2.0
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0]; // Get most recent

    if (recentPass) {
      assists.push({
        id: `assist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: "assist",
        teamId: recentPass.teamId,
        playerId: recentPass.playerId, // The passer
        timestamp: recentPass.timestamp,
        confidence: 0.7 * recentPass.confidence * score.confidence,
        source: "event-correlation",
        notes: `Assist: pass led to score at ${score.timestamp.toFixed(1)}s`,
      });
    }
  }

  return assists;
}

/**
 * Detect dribbles: Player with ball showing repetitive bouncing motion
 * Identified by ball proximity to player with vertical ball oscillation
 */
export function detectDribbles(
  ballDetections: any[],
  personDetections: any[]
): GameEvent[] {
  const dribbles: GameEvent[] = [];

  // Track ball height over time for oscillation detection
  const ballHeights: Array<{
    timestamp: number;
    y: number;
    playerId?: string;
  }> = [];

  for (const ballFrame of ballDetections) {
    const ballDet = ballFrame.detections?.find((d: any) => d.type === "ball");
    if (!ballDet) continue;

    const ballY = ballDet.bbox[1] + ballDet.bbox[3] / 2;

    // Find closest player
    const personFrame = personDetections.find(
      (p) => Math.abs(p.timestamp - ballFrame.timestamp) < 0.1
    );

    let closestPlayerId: string | undefined;

    if (personFrame) {
      const ballX = ballDet.bbox[0] + ballDet.bbox[2] / 2;
      let minDist = Infinity;

      for (const det of personFrame.detections || []) {
        if (det.type !== "person") continue;

        const [px, py] = [
          det.bbox[0] + det.bbox[2] / 2,
          det.bbox[1] + det.bbox[3] / 2,
        ];
        const dist = Math.sqrt(
          Math.pow(ballX - px, 2) + Math.pow(ballY - py, 2)
        );

        if (dist < minDist && dist < 60) {
          minDist = dist;
          closestPlayerId = det.playerId;
        }
      }
    }

    ballHeights.push({
      timestamp: ballFrame.timestamp,
      y: ballY,
      playerId: closestPlayerId,
    });
  }

  // Detect oscillation pattern (dribbling)
  const windowSize = 10; // Check 10 frames
  for (let i = windowSize; i < ballHeights.length; i++) {
    const window = ballHeights.slice(i - windowSize, i);
    const playerId = window[window.length - 1].playerId;

    if (!playerId) continue;

    // Count direction changes (oscillation)
    let directionChanges = 0;
    for (let j = 1; j < window.length - 1; j++) {
      const prev = window[j - 1].y;
      const curr = window[j].y;
      const next = window[j + 1].y;

      // Check for local min/max (direction change)
      if ((curr < prev && curr < next) || (curr > prev && curr > next)) {
        directionChanges++;
      }
    }

    // If 3+ direction changes, likely dribbling
    if (directionChanges >= 3) {
      const timestamp = window[window.length - 1].timestamp;

      // Check if we already recorded dribble for this player recently
      const recentDribble = dribbles.find(
        (d) =>
          d.playerId === playerId && Math.abs(d.timestamp - timestamp) < 1.0
      );

      if (!recentDribble) {
        // Find team for this player
        const personFrame = personDetections.find(
          (p) => Math.abs(p.timestamp - timestamp) < 0.1
        );
        const player = personFrame?.detections?.find(
          (d: any) => d.playerId === playerId
        );

        dribbles.push({
          id: `dribble-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          type: "dribble",
          teamId: player?.teamId || "unknown",
          playerId,
          timestamp,
          confidence: 0.6,
          source: "ball-tracking",
          notes: `Dribbling detected: ${directionChanges} bounces observed`,
        });
      }
    }
  }

  return dribbles;
}

/**
 * Detect foul shots: 1-point free throw attempts
 * Identified by lone shooter at foul line (no nearby defenders)
 * Typically requires ball to be stationary before shot
 */
export function detectFoulShots(
  shotAttempts: GameEvent[],
  personDetections: any[],
  ballDetections: any[]
): GameEvent[] {
  const foulShots: GameEvent[] = [];

  for (const shot of shotAttempts) {
    if (shot.type !== "shot_attempt") continue;

    // Find person detections near shot
    const personFrame = personDetections.find(
      (p) => Math.abs(p.timestamp - shot.timestamp) < 0.3
    );

    if (!personFrame) continue;

    const shooter = personFrame.detections?.find(
      (d: any) => d.teamId === shot.teamId
    );

    if (!shooter) continue;

    // Check if shooter is isolated (no defenders nearby)
    const defenders = personFrame.detections?.filter(
      (d: any) => d.type === "person" && d.teamId !== shot.teamId
    );

    if (!defenders || defenders.length === 0) {
      // No defenders visible - potential foul shot scenario
      // Additional check: ball should be relatively stationary before shot
      const ballFrame = ballDetections.find(
        (b) => Math.abs(b.timestamp - shot.timestamp + 0.5) < 0.2
      ); // 0.5s before shot

      if (ballFrame) {
        const ball = ballFrame.detections?.find((d: any) => d.type === "ball");

        // Check if ball was near shooter's position
        if (ball && shooter.bbox) {
          const [ballX, ballY] = [
            ball.bbox[0] + ball.bbox[2] / 2,
            ball.bbox[1] + ball.bbox[3] / 2,
          ];
          const [shooterX, shooterY] = [
            shooter.bbox[0] + shooter.bbox[2] / 2,
            shooter.bbox[1] + shooter.bbox[3] / 2,
          ];
          const dist = Math.sqrt(
            Math.pow(ballX - shooterX, 2) + Math.pow(ballY - shooterY, 2)
          );

          if (dist < 50) {
            // Ball was near shooter
            foulShots.push({
              id: `foul-shot-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              type: "foul_shot",
              teamId: shot.teamId,
              playerId: shot.playerId,
              shotType: "1pt",
              timestamp: shot.timestamp,
              confidence: 0.55, // Lower confidence as it's heuristic-based
              source: "isolation-heuristic",
              notes: `Foul shot detected: isolated shooter with stationary ball`,
            });
          }
        }
      }
    }
  }

  return foulShots;
}

/**
 * Process all enhanced actions in the video
 * Combines multiple detection algorithms
 */
export function detectAllActions(
  shotAttempts: GameEvent[],
  scores: GameEvent[],
  poseDetections: PoseResult[],
  personDetections: any[],
  ballDetections: any[],
  teamClusters: any
): GameEvent[] {
  const allActions: GameEvent[] = [];

  // Detect blocks
  const blocks = detectBlocks(shotAttempts, poseDetections, personDetections);
  allActions.push(...blocks);

  // Detect passes
  const passes = detectPasses(ballDetections, personDetections, teamClusters);
  allActions.push(...passes);

  // Detect dunks
  const dunks = detectDunks(shotAttempts, poseDetections, personDetections);
  allActions.push(...dunks);

  // Detect layups
  const layups = detectLayups(shotAttempts, poseDetections, personDetections);
  allActions.push(...layups);

  // Detect assists (requires scores and passes)
  const assists = detectAssists(passes, scores);
  allActions.push(...assists);

  // Detect dribbles
  const dribbles = detectDribbles(ballDetections, personDetections);
  allActions.push(...dribbles);

  // Detect foul shots
  const foulShots = detectFoulShots(
    shotAttempts,
    personDetections,
    ballDetections
  );
  allActions.push(...foulShots);

  return allActions;
}
