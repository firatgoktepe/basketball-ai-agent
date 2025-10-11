import type { PoseResult } from "@/types";
import type { MoveNetPoseEstimator, Pose } from "../models/movenet";
import type { LocalMoveNetPoseEstimator } from "../models/movenet-local";

export interface ShotAttempt {
  playerId: string;
  timestamp: number;
  confidence: number;
  keypoints: {
    leftWrist: { x: number; y: number; confidence: number };
    rightWrist: { x: number; y: number; confidence: number };
    leftElbow: { x: number; y: number; confidence: number };
    rightElbow: { x: number; y: number; confidence: number };
    leftShoulder: { x: number; y: number; confidence: number };
    rightShoulder: { x: number; y: number; confidence: number };
  };
  armElevation: number;
  shootingForm: "left_handed" | "right_handed" | "unknown";
}

export async function extractPoses(
  frames: ImageData[],
  model: MoveNetPoseEstimator | LocalMoveNetPoseEstimator,
  samplingRate: number = 1,
  videoDuration: number = 0
): Promise<PoseResult[]> {
  const results: PoseResult[] = [];

  // Debug: Log pose extraction start
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Starting pose extraction: ${frames.length} frames`,
      },
    });
  }

  const timePerFrame =
    videoDuration > 0 ? videoDuration / frames.length : 1 / samplingRate;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const timestamp = i * timePerFrame;

    // Log progress
    if (i % 10 === 0) {
      console.log(`[Pose Estimation] Processing frame ${i}/${frames.length}`);
    }

    try {
      // Validate frame dimensions
      if (!frame || frame.width <= 0 || frame.height <= 0) {
        console.warn(
          `Invalid frame dimensions at index ${i}, skipping pose estimation`
        );
        results.push({
          frameIndex: i,
          timestamp,
          poses: [],
        });
        continue;
      }

      // Validate frame data
      if (!frame.data || frame.data.length === 0) {
        console.warn(
          `Invalid frame data at index ${i}, skipping pose estimation`
        );
        results.push({
          frameIndex: i,
          timestamp,
          poses: [],
        });
        continue;
      }

      // Use MoveNet model for pose estimation
      const poses = await model.estimatePoses(frame);

      // Log if no poses detected
      if (poses.length === 0 && i < 5) {
        console.log(`[Pose Estimation] Frame ${i}: No poses detected`);
      }

      results.push({
        frameIndex: i,
        timestamp,
        poses: poses.map((pose) => ({
          keypoints: pose.keypoints.map((kp) => ({
            x: kp.x,
            y: kp.y,
            confidence: kp.confidence,
          })),
          bbox: pose.bbox,
          teamId: undefined, // Will be assigned during team clustering
        })),
      });

      // Debug: Log pose extraction progress for first few frames
      if (i < 5) {
        if (typeof self !== "undefined" && self.postMessage) {
          self.postMessage({
            type: "debug",
            data: {
              message: `🔍 Frame ${i}: extracted ${poses.length} poses`,
            },
          });
        }
      }
    } catch (error) {
      console.error(`Pose estimation failed for frame ${i}:`, error);
      // Fallback to empty poses
      results.push({
        frameIndex: i,
        timestamp,
        poses: [],
      });
    }
  }

  // Debug: Log pose extraction results
  if (typeof self !== "undefined" && self.postMessage) {
    const totalPoses = results.reduce((sum, r) => sum + r.poses.length, 0);
    self.postMessage({
      type: "debug",
      data: {
        message: `📊 Pose extraction complete: ${totalPoses} total poses across ${results.length} frames`,
      },
    });
  }

  return results;
}

export function detectShotAttempts(
  poseResults: PoseResult[],
  ballDetections?: any[]
): ShotAttempt[] {
  const shotAttempts: ShotAttempt[] = [];
  const shotDetectionWindow = 1.0; // 1 second window for shot detection

  // Debug: Log shot detection start
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Starting shot detection: ${
          poseResults.length
        } pose frames, ${ballDetections?.length || 0} ball detections`,
      },
    });
  }

  // Fallback: If no poses detected, try to generate some basic shot attempts from ball motion
  if (poseResults.length === 0 && ballDetections && ballDetections.length > 0) {
    return generateFallbackShotAttempts(ballDetections);
  }

  for (let i = 0; i < poseResults.length; i++) {
    const currentFrame = poseResults[i];

    // Debug: Log pose frame info
    if (i < 5) {
      // Only log first 5 frames to avoid spam
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `🔍 Frame ${i}: ${currentFrame.poses.length} poses detected`,
          },
        });
      }
    }

    for (const pose of currentFrame.poses) {
      const shotAttempt = analyzePoseForShot(pose, currentFrame.timestamp);

      if (shotAttempt && shotAttempt.confidence > 0.5) {
        // Check for ball proximity if ball detection is available
        if (ballDetections && ballDetections.length > 0) {
          const ballProximity = checkBallProximity(
            shotAttempt,
            ballDetections,
            currentFrame.timestamp,
            shotDetectionWindow
          );

          if (ballProximity) {
            shotAttempts.push({
              ...shotAttempt,
              confidence: Math.min(
                1,
                shotAttempt.confidence + ballProximity * 0.2
              ),
            });
          }
        } else {
          shotAttempts.push(shotAttempt);
        }
      }
    }
  }

  // Debug: Log shot detection results
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `📊 Shot detection complete: found ${shotAttempts.length} shot attempts`,
      },
    });
  }

  // If we still have no shot attempts and we have ball detections, use ball movement as fallback
  if (
    shotAttempts.length === 0 &&
    ballDetections &&
    ballDetections.length > 0
  ) {
    console.log(
      "[Shot Detection] No pose-based shots detected, generating from ball movement"
    );
    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message: `⚠️ No pose-based shots detected, generating from ball movement`,
        },
      });
    }
    return generateFallbackShotAttempts(ballDetections);
  }

  return shotAttempts;
}

function analyzePoseForShot(
  pose: {
    keypoints: Array<{ x: number; y: number; confidence: number }>;
    bbox: [number, number, number, number];
  },
  timestamp: number
): ShotAttempt | null {
  const keypoints = pose.keypoints;

  // MoveNet keypoint indices (17 keypoints)
  const keypointNames = [
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

  // Extract relevant keypoints
  const leftWrist = keypoints[9]; // left_wrist
  const rightWrist = keypoints[10]; // right_wrist
  const leftElbow = keypoints[7]; // left_elbow
  const rightElbow = keypoints[8]; // right_elbow
  const leftShoulder = keypoints[5]; // left_shoulder
  const rightShoulder = keypoints[6]; // right_shoulder

  // Check if keypoints are visible and confident
  const requiredKeypoints = [
    leftWrist,
    rightWrist,
    leftElbow,
    rightElbow,
    leftShoulder,
    rightShoulder,
  ];

  // Debug: Log keypoint confidence values
  if (typeof self !== "undefined" && self.postMessage) {
    const keypointConfidences = requiredKeypoints
      .map(
        (kp, i) =>
          `${
            [
              "leftWrist",
              "rightWrist",
              "leftElbow",
              "rightElbow",
              "leftShoulder",
              "rightShoulder",
            ][i]
          }: ${kp.confidence.toFixed(3)}`
      )
      .join(", ");
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Keypoint confidences: ${keypointConfidences}`,
      },
    });
  }

  // Much lower confidence threshold to capture more keypoints
  const visibleKeypoints = requiredKeypoints.filter(
    (kp) => kp && kp.confidence > 0.01 // Further lowered to 0.01 for amateur videos
  );

  if (visibleKeypoints.length < 1) {
    // Lowered from 2 to 1 - be more permissive
    // Debug: Log insufficient keypoints (only occasionally to avoid spam)
    if (
      Math.random() < 0.1 &&
      typeof self !== "undefined" &&
      self.postMessage
    ) {
      self.postMessage({
        type: "debug",
        data: {
          message: `⚠️ Insufficient keypoints for pose analysis: ${visibleKeypoints.length}/6 visible (threshold: 0.01)`,
        },
      });
    }
    return null; // Not enough keypoints for analysis
  }

  // Analyze arm elevation for shooting motion
  const leftArmElevation = calculateArmElevation(
    leftShoulder,
    leftElbow,
    leftWrist
  );
  const rightArmElevation = calculateArmElevation(
    rightShoulder,
    rightElbow,
    rightWrist
  );

  // Determine shooting form
  const shootingForm = determineShootingForm(
    leftArmElevation,
    rightArmElevation
  );

  // Calculate overall shooting confidence
  const armElevation = Math.max(leftArmElevation, rightArmElevation);
  const confidence = calculateShootingConfidence(
    leftArmElevation,
    rightArmElevation,
    leftWrist,
    rightWrist,
    leftElbow,
    rightElbow
  );

  // Debug: Log pose analysis results
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Pose analysis: confidence=${confidence.toFixed(
          3
        )}, armElevation=${armElevation.toFixed(3)}, visibleKeypoints=${
          visibleKeypoints.length
        }/6`,
      },
    });
  }

  // Much lower thresholds to be more permissive
  if (confidence > 0.05 && armElevation > 0.05) {
    // Lowered from 0.1/0.1 to 0.05/0.05 for high-quality videos
    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message: `✅ Shot attempt detected: confidence=${confidence.toFixed(
            3
          )}, form=${shootingForm}`,
        },
      });
    }

    return {
      playerId: `player_${timestamp}`, // Simple ID generation
      timestamp,
      confidence,
      keypoints: {
        leftWrist,
        rightWrist,
        leftElbow,
        rightElbow,
        leftShoulder,
        rightShoulder,
      },
      armElevation,
      shootingForm,
    };
  }

  return null;
}

function calculateArmElevation(
  shoulder: { x: number; y: number; confidence: number },
  elbow: { x: number; y: number; confidence: number },
  wrist: { x: number; y: number; confidence: number }
): number {
  // Use much lower threshold and handle negative confidence values
  const minConfidence = 0.03; // Lowered from 0.05 to 0.03 for better sensitivity
  if (
    shoulder.confidence < minConfidence ||
    elbow.confidence < minConfidence ||
    wrist.confidence < minConfidence
  ) {
    return 0;
  }

  // Calculate arm angle relative to vertical
  const shoulderToElbow = {
    x: elbow.x - shoulder.x,
    y: elbow.y - shoulder.y,
  };

  const elbowToWrist = {
    x: wrist.x - elbow.x,
    y: wrist.y - elbow.y,
  };

  // Calculate angle between arm segments
  const armAngle = calculateAngle(shoulderToElbow, elbowToWrist);

  // Calculate elevation (how high the arm is raised)
  const armLength = Math.sqrt(shoulderToElbow.x ** 2 + shoulderToElbow.y ** 2);
  const elevation = Math.max(0, (shoulder.y - wrist.y) / armLength);

  // Combine angle and elevation for shooting motion
  const shootingMotion = elevation * (1 - Math.abs(armAngle - 90) / 90);

  return Math.min(1, shootingMotion);
}

function calculateAngle(
  vector1: { x: number; y: number },
  vector2: { x: number; y: number }
): number {
  const dot = vector1.x * vector2.x + vector1.y * vector2.y;
  const mag1 = Math.sqrt(vector1.x ** 2 + vector1.y ** 2);
  const mag2 = Math.sqrt(vector2.x ** 2 + vector2.y ** 2);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

function determineShootingForm(
  leftArmElevation: number,
  rightArmElevation: number
): "left_handed" | "right_handed" | "unknown" {
  const threshold = 0.3;

  if (leftArmElevation > threshold && rightArmElevation < threshold) {
    return "left_handed";
  } else if (rightArmElevation > threshold && leftArmElevation < threshold) {
    return "right_handed";
  } else if (leftArmElevation > threshold && rightArmElevation > threshold) {
    return "right_handed"; // Default to right-handed if both arms elevated
  }

  return "unknown";
}

function calculateShootingConfidence(
  leftArmElevation: number,
  rightArmElevation: number,
  leftWrist: { x: number; y: number; confidence: number },
  rightWrist: { x: number; y: number; confidence: number },
  leftElbow: { x: number; y: number; confidence: number },
  rightElbow: { x: number; y: number; confidence: number }
): number {
  let confidence = 0;

  // Base confidence from arm elevation
  const maxElevation = Math.max(leftArmElevation, rightArmElevation);
  confidence += maxElevation * 0.6;

  // Handle negative confidence values by using absolute values and scaling
  const avgConfidence = Math.max(
    0,
    (Math.abs(leftWrist.confidence) +
      Math.abs(rightWrist.confidence) +
      Math.abs(leftElbow.confidence) +
      Math.abs(rightElbow.confidence)) /
      4
  );
  confidence += Math.min(avgConfidence, 0.5) * 0.4; // Cap keypoint contribution

  // Asymmetry bonus (one arm more elevated than the other)
  const asymmetry = Math.abs(leftArmElevation - rightArmElevation);
  confidence += asymmetry * 0.2;

  return Math.min(1, confidence);
}

function checkBallProximity(
  shotAttempt: ShotAttempt,
  ballDetections: any[],
  timestamp: number,
  window: number
): number {
  const timeThreshold = window * 30; // Convert to frames (assuming 30fps)

  for (const ballFrame of ballDetections) {
    const timeDiff = Math.abs(
      ballFrame.frameIndex - Math.floor(timestamp * 30)
    );

    if (timeDiff <= timeThreshold && ballFrame.detections.length > 0) {
      const ball = ballFrame.detections[0]; // Get first ball detection
      const ballCenter = {
        x: ball.bbox[0] + ball.bbox[2] / 2,
        y: ball.bbox[1] + ball.bbox[3] / 2,
      };

      // Calculate distance to shooting hand
      const shootingHand =
        shotAttempt.shootingForm === "left_handed"
          ? shotAttempt.keypoints.leftWrist
          : shotAttempt.keypoints.rightWrist;

      const distance = Math.sqrt(
        (ballCenter.x - shootingHand.x) ** 2 +
          (ballCenter.y - shootingHand.y) ** 2
      );

      // Return proximity factor (closer = higher value)
      return Math.max(0, 1 - distance / 100);
    }
  }

  return 0;
}

/**
 * Fallback shot detection based on ball motion when pose data is insufficient
 */
function generateFallbackShotAttempts(ballDetections: any[]): ShotAttempt[] {
  const shotAttempts: ShotAttempt[] = [];

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔧 Analyzing ${ballDetections.length} frames for ball-based shot detection`,
      },
    });

    // Debug: Check structure of first ball detection
    if (ballDetections.length > 0) {
      const firstFrame = ballDetections[0];
      self.postMessage({
        type: "debug",
        data: {
          message: `🔍 First ball frame: frameIndex=${
            firstFrame.frameIndex
          }, detections=${firstFrame.detections?.length || 0}`,
        },
      });
    }
  }

  let framesWithBall = 0;
  let framesWithoutBall = 0;
  let maxUpwardMotion = 0;

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
      framesWithoutBall++;
      continue;
    }

    framesWithBall++;

    const currentBall = currentFrame.detections[0];
    const previousBall = previousFrame.detections[0];

    // Check for upward ball motion (potential shot)
    const ballCenterY = currentBall.bbox[1] + currentBall.bbox[3] / 2;
    const prevBallCenterY = previousBall.bbox[1] + previousBall.bbox[3] / 2;
    const upwardMotion = prevBallCenterY - ballCenterY; // Positive means ball moving up

    if (upwardMotion > maxUpwardMotion) {
      maxUpwardMotion = upwardMotion;
    }

    // Lowered threshold from 10 to 8 pixels for better sensitivity
    if (upwardMotion > 8) {
      const timestamp = currentFrame.timestamp || i * (1 / 30);

      shotAttempts.push({
        playerId: `fallback_player_${i}`,
        timestamp,
        confidence: Math.min(0.75, 0.6 + upwardMotion / 100), // Increased base confidence from 0.5 to 0.6
        keypoints: {
          leftWrist: { x: 0, y: 0, confidence: 0.1 },
          rightWrist: { x: 0, y: 0, confidence: 0.1 },
          leftElbow: { x: 0, y: 0, confidence: 0.1 },
          rightElbow: { x: 0, y: 0, confidence: 0.1 },
          leftShoulder: { x: 0, y: 0, confidence: 0.1 },
          rightShoulder: { x: 0, y: 0, confidence: 0.1 },
        },
        armElevation: 0.5, // Default moderate elevation
        shootingForm: "unknown",
      });
    }
  }

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `📊 Ball analysis: ${framesWithBall} frames with ball, ${framesWithoutBall} without. Max upward motion: ${maxUpwardMotion.toFixed(
          1
        )}px`,
      },
    });
  }

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔧 Fallback shot detection found ${shotAttempts.length} potential shots`,
      },
    });
  }

  return shotAttempts;
}
