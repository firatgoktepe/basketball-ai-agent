/**
 * Detection Thresholds Configuration
 *
 * Central configuration for all detection confidence thresholds and parameters.
 * Tune these values to improve analysis quality and confidence scores.
 */

export const DETECTION_THRESHOLDS = {
  // Person Detection
  PERSON_DETECTION: {
    // Main confidence threshold for COCO-SSD person detection
    // Lower values = more detections but potentially more false positives
    // Higher values = fewer but more confident detections
    CONFIDENCE_THRESHOLD: 0.3, // Lowered from 0.5 for better detection in high-quality videos

    // Fallback detection (when COCO-SSD fails)
    FALLBACK_MIN_CONFIDENCE: 0.4, // Minimum confidence for fallback detections
    FALLBACK_BASE_CONFIDENCE: 0.55, // Base confidence for shape-based detection
  },

  // Pose Estimation
  POSE_ESTIMATION: {
    // Keypoint visibility threshold
    KEYPOINT_CONFIDENCE: 0.01, // Very low to catch all visible keypoints

    // Minimum visible keypoints required for analysis
    MIN_VISIBLE_KEYPOINTS: 1, // At least 1 keypoint

    // Arm elevation thresholds for shooting detection
    MIN_ARM_ELEVATION: 0.05, // Lowered from 0.1 for more sensitivity
    MIN_SHOT_CONFIDENCE: 0.05, // Lowered from 0.1

    // Confidence calculation parameters
    ARM_CONFIDENCE_MIN: 0.05, // Minimum keypoint confidence for arm analysis
  },

  // Ball Detection
  BALL_DETECTION: {
    // HSV color-based detection
    HSV_MIN_CONFIDENCE: 0.4, // Minimum confidence for HSV ball detection
    HSV_CIRCULARITY_WEIGHT: 0.3, // Weight for shape circularity
    HSV_COLOR_WEIGHT: 0.4, // Weight for orange color match
    HSV_SIZE_WEIGHT: 0.3, // Weight for expected size

    // Ball motion for shot detection
    MIN_UPWARD_MOTION: 8, // Lowered from 10 pixels for sensitivity
    BALL_MOTION_BASE_CONFIDENCE: 0.6, // Increased from 0.5
  },

  // Event Fusion
  EVENT_FUSION: {
    // Confidence thresholds for filtering
    MIN_EVENT_CONFIDENCE: 0.45, // Lowered from 0.5 to keep more events
    HIGH_CONFIDENCE_THRESHOLD: 0.85, // Lowered from 0.9 for achievable high confidence
    MEDIUM_CONFIDENCE_THRESHOLD: 0.65, // Lowered from 0.7

    // Signal weights for confidence calculation
    SIGNAL_WEIGHTS: {
      // Shot attempt signals
      POSE_WEIGHT: 0.65, // Increased from 0.6 - give more weight to good pose
      BALL_MOTION_WEIGHT: 0.35, // Decreased from 0.4

      // Score attribution signals
      OCR_WEIGHT: 0.9,
      TEAM_ATTRIBUTION_WEIGHT: 0.1,

      // Rebound signals
      PROXIMITY_WEIGHT: 0.6,
      TEAM_ID_WEIGHT: 0.4,
    },

    // Temporal windows (in seconds)
    TEMPORAL_WINDOW: 1.0,
    SCORE_ATTRIBUTION_WINDOW: 0.5,
    REBOUND_WINDOW: 2.0,
    MISSED_SHOT_WINDOW: 2.0,
  },

  // Team Clustering
  TEAM_CLUSTERING: {
    // Minimum detections per team for reliable clustering
    MIN_DETECTIONS_PER_TEAM: 3, // Lowered from 5

    // Color similarity threshold
    COLOR_SIMILARITY_THRESHOLD: 30, // HSV color distance

    // Confidence boost for good clustering
    CLUSTERING_CONFIDENCE_BOOST: 0.15, // Added to base confidence when clustering is strong
  },

  // Quality Adjustments
  QUALITY_ADJUSTMENTS: {
    // Boost confidence for high-quality detections
    HIGH_QUALITY_BOOST: 0.1, // Add 0.1 to confidence when multiple signals agree

    // Penalty for single-signal detections
    SINGLE_SIGNAL_PENALTY: -0.05, // Subtract 0.05 when only one signal

    // Bonus for temporal consistency (same event detected across frames)
    TEMPORAL_CONSISTENCY_BONUS: 0.1, // Add 0.1 when event is stable across 3+ frames
  },
};

/**
 * Confidence range definitions for UI display
 */
export const CONFIDENCE_RANGES = {
  HIGH: { min: 0.85, max: 1.0, label: "High", color: "green" },
  MEDIUM: { min: 0.65, max: 0.84, label: "Medium", color: "yellow" },
  LOW: { min: 0.45, max: 0.64, label: "Low", color: "orange" },
  VERY_LOW: { min: 0, max: 0.44, label: "Very Low (Filtered)", color: "red" },
};

/**
 * Get confidence level label for a given confidence score
 */
export function getConfidenceLevel(
  confidence: number
): "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" {
  if (confidence >= CONFIDENCE_RANGES.HIGH.min) return "HIGH";
  if (confidence >= CONFIDENCE_RANGES.MEDIUM.min) return "MEDIUM";
  if (confidence >= CONFIDENCE_RANGES.LOW.min) return "LOW";
  return "VERY_LOW";
}

/**
 * Apply quality adjustments to base confidence
 */
export function adjustConfidence(
  baseConfidence: number,
  options: {
    signalCount?: number;
    temporalConsistency?: boolean;
    highQuality?: boolean;
  }
): number {
  let adjusted = baseConfidence;

  // High quality boost
  if (options.highQuality) {
    adjusted += DETECTION_THRESHOLDS.QUALITY_ADJUSTMENTS.HIGH_QUALITY_BOOST;
  }

  // Single signal penalty
  if (options.signalCount === 1) {
    adjusted += DETECTION_THRESHOLDS.QUALITY_ADJUSTMENTS.SINGLE_SIGNAL_PENALTY;
  }

  // Temporal consistency bonus
  if (options.temporalConsistency) {
    adjusted +=
      DETECTION_THRESHOLDS.QUALITY_ADJUSTMENTS.TEMPORAL_CONSISTENCY_BONUS;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, adjusted));
}
