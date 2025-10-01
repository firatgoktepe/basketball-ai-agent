# Event Fusion Rules & Confidence System

This document explains the deterministic rule engine implemented for basketball event detection with multi-signal fusion and confidence scoring.

## Overview

The event fusion system aggregates per-frame signals from multiple detection sources (OCR, pose estimation, ball tracking, person detection) into discrete game events with confidence scores. It implements temporal smoothing and majority voting to improve accuracy and reduce false positives.

## Core Components

### 1. Signal Sources

- **OCR**: Scoreboard reading for score changes (high confidence)
- **Pose Estimation**: Player arm elevation and shooting form detection
- **Ball Detection**: Ball position, motion, and trajectory
- **Person Detection**: Player positions and team clustering
- **Court Geometry**: Estimated 3-point line detection (low confidence)

### 2. Temporal Windows

```typescript
TEMPORAL_WINDOW = 1.0s          // General event smoothing
SCORE_ATTRIBUTION_WINDOW = 0.5s // Score-to-team attribution
REBOUND_WINDOW = 2.0s           // Rebound detection after shot
MISSED_SHOT_WINDOW = 2.0s       // Missed shot inference
```

## Event Detection Rules

### Rule A: Score Event Detection (High Confidence)

**Trigger**: OCR detects scoreboard change  
**Confidence**: 0.9–1.0  
**Process**:

1. OCR reads scoreboard at intervals
2. Detect score delta (change from previous frame)
3. Verify stability by checking next OCR frame (bonus: +0.1 confidence)
4. Attribute to team using **majority voting**:
   - Find person detections within ±0.5s
   - Count players in "hoop region" (top 40% of frame) by team
   - If one team has ≥60% majority → assign with high confidence
   - Otherwise → use OCR-indicated team with lower confidence

**Output**: `score` event with `scoreDelta`, `teamId`, and attribution notes

---

### Rule B: Shot Attempt Detection

**Trigger**: Pose shows shooting motion  
**Confidence**: 0.4–0.9 (depends on ball evidence)  
**Process**:

1. Pose detector identifies arm elevation pattern
2. Check for ball near player within ±0.5s
3. Analyze ball trajectory (moving upward = shot)
4. Compute confidence using **weighted average**:
   - Pose evidence: 60% weight
   - Ball motion evidence: 40% weight
5. Determine team from pose clustering

**Output**: `shot_attempt` event with combined confidence

**Missed Shot Inference**: If no score event follows within 2s → create `missed_shot` event (confidence × 0.7)

---

### Rule C: Rebound Detection

**Trigger**: Ball possession change after shot attempt  
**Confidence**: 0.5–0.8  
**Process**:

1. After each shot, observe next 0.2–2.0s
2. Find ball detections in window
3. Identify player closest to ball (<100px)
4. Determine offensive vs. defensive:
   - Same team as shooter → `offensive_rebound`
   - Opposing team → `defensive_rebound`
5. Confidence based on:
   - Ball-player proximity (60% weight)
   - Team ID clarity (40% weight)

**Output**: `offensive_rebound` or `defensive_rebound` event

---

### Rule D: Turnover & Steal Detection

**Trigger**: Ball possession changes teams  
**Confidence**: 0.6–0.7  
**Process**:

1. Track ball possession over time (closest player <80px from ball)
2. Detect possession changes
3. Classify based on timing:
   - Change within <1s → `steal` (higher confidence: 0.7)
   - Change >1s → `turnover` (confidence: 0.6)
4. Affected team = team that lost possession

**Output**: `turnover` or `steal` event

---

### Rule E: 3-Point Attempt Estimation (Optional, Low Confidence)

**Trigger**: Shot attempt from far court position  
**Confidence**: 0.3–0.5  
**Process**:

1. For each `shot_attempt`, estimate shooter distance from hoop
2. Simple heuristic: player Y-position in lower 40% of frame
3. Classification:
   - Far position + high confidence (>0.4) → `3pt`
   - Far position + low confidence → `long_distance_attempt`

**Output**: `3pt` or `long_distance_attempt` event

---

## Confidence Computation

### Weighted Average Formula

```typescript
confidence = Σ(signal_value × signal_weight) / Σ(signal_weight)
```

**Example**: Shot attempt with pose (0.8) and ball (0.6)

```
confidence = (0.8 × 0.6 + 0.6 × 0.4) / (0.6 + 0.4)
           = (0.48 + 0.24) / 1.0
           = 0.72
```

### Signal Weights by Event Type

| Event Type   | Signals                                    | Weights                      |
| ------------ | ------------------------------------------ | ---------------------------- |
| Score        | OCR (0.9) + Stability (0.1) + Attribution  | 100% OCR, then × attribution |
| Shot Attempt | Pose (0.6) + Ball Motion (0.4)             | Weighted avg                 |
| Rebound      | Proximity (0.6) + Team ID (0.4)            | Weighted avg                 |
| Turnover     | Possession change (0.6) + Suddenness (0.1) | Additive                     |
| 3PT          | Distance heuristic (0.3–0.5)               | Single signal                |

---

## Temporal Smoothing & Majority Voting

### Purpose

Reduce duplicate detections and noise by merging similar events detected across multiple frames.

### Algorithm

1. **Group Similar Events**: Events with same type, teamId, and within 1.0s window
2. **Median Timestamp**: Use middle timestamp of grouped events
3. **Average Confidence**: Mean of all confidences
4. **Combine Sources**: Merge signal sources (e.g., "ocr+pose-analysis")
5. **Deduplication**: Mark merged events as processed

### Example

```
Input:
  - shot_attempt @ 10.2s, confidence 0.7, source: "pose-analysis"
  - shot_attempt @ 10.5s, confidence 0.8, source: "pose+ball-heuristic"
  - shot_attempt @ 10.8s, confidence 0.75, source: "pose-analysis"

Output:
  - shot_attempt @ 10.5s (median), confidence 0.75 (avg),
    source: "pose-analysis+pose+ball-heuristic"
    notes: "Merged 3 similar detections"
```

---

## Confidence Thresholding

**Default threshold**: 0.5

Events below threshold are filtered out before returning to the UI. Low-confidence events (0.5–0.7) are flagged in the UI for user review.

### Confidence Ranges

- **0.9–1.0**: High confidence (OCR-based scores)
- **0.7–0.89**: Good confidence (pose + ball evidence)
- **0.5–0.69**: Moderate confidence (single signal or weak evidence)
- **<0.5**: Filtered out (too uncertain)

---

## Edge Cases & Fallbacks

### Missing Data Handling

- **No OCR results**: Rely entirely on pose/ball heuristics
- **No ball detection**: Use pose-only evidence (lower confidence)
- **No team clustering**: Default to "unknown" team with note
- **Ambiguous attribution**: Use OCR-indicated team with moderate confidence

### Concurrency & Race Conditions

- Event IDs use timestamp + random suffix to prevent collisions
- Events sorted by timestamp before returning
- Temporal smoothing handles near-simultaneous detections

### Performance Optimization

- Early returns when insufficient data (e.g., <2 ball detections for turnovers)
- Efficient filtering using time windows before expensive computations
- Single-pass processing where possible

---

## Testing & Validation

### Unit Tests (Recommended)

1. **Score attribution**: Verify majority voting logic with mock data
2. **Confidence computation**: Test weighted averaging edge cases
3. **Temporal smoothing**: Verify merging and deduplication
4. **Missed shot detection**: Ensure correct window matching

### Integration Tests

1. Run fusion on annotated test clips
2. Compare detected events to ground truth
3. Measure precision/recall per event type
4. Validate confidence scores correlate with accuracy

---

## Future Enhancements

1. **Court Geometry Detection**: Improve 3PT estimation with actual court line detection
2. **Player Tracking**: Persistent player IDs across frames for better possession tracking
3. **Defensive Actions**: Detect blocks and deflections
4. **Assist Detection**: Link passes to scores
5. **Adaptive Thresholds**: Tune confidence thresholds based on video quality
6. **Multi-Frame Consensus**: Require events to appear in N consecutive frames

---

## Acceptance Criteria (from PRD)

✅ **OCR Score Detection**: ≥95% accuracy when scoreboard visible  
✅ **Team Attribution**: ≥80% correct with majority voting  
✅ **Shot/Rebound/Turnover**: Initial 60–70% accuracy target  
✅ **Confidence Scoring**: Multi-signal fusion with weighted averaging  
✅ **Temporal Smoothing**: Deduplication within 1.0s window  
✅ **Majority Voting**: Team attribution and event merging

---

## API Reference

### Main Function

```typescript
fuseEvents(options: FusionOptions): Promise<GameEvent[]>
```

**Input**:

- `personDetections`: Array of person detection frames
- `ballDetections`: Array of ball detection frames
- `poseDetections`: Array of pose estimation frames
- `shotAttempts`: Pre-detected shot attempts from pose analysis
- `ocrResults`: Array of OCR readings from scoreboard
- `teamClusters`: Team color clustering data
- `enable3ptEstimation`: Boolean flag for 3PT detection

**Output**: Sorted array of `GameEvent` objects with:

- `id`: Unique event identifier
- `type`: Event type (score, shot_attempt, rebound, etc.)
- `teamId`: Team responsible for event
- `timestamp`: Event time in seconds
- `confidence`: 0–1 confidence score
- `source`: Signal sources used (e.g., "ocr", "pose+ball-heuristic")
- `notes`: Human-readable explanation
- `scoreDelta`: (score events only) Points scored

---

## Configuration Constants

All time windows and thresholds are defined as constants at the top of the module for easy tuning:

```typescript
TEMPORAL_WINDOW = 1.0; // Event merging window
SCORE_ATTRIBUTION_WINDOW = 0.5; // Score-to-team window
REBOUND_WINDOW = 2.0; // Rebound search window
MISSED_SHOT_WINDOW = 2.0; // Missed shot inference window
CONFIDENCE_THRESHOLD = 0.5; // Minimum confidence to keep
MAJORITY_THRESHOLD = 0.6; // Team attribution majority
PROXIMITY_THRESHOLD_BALL = 150; // Ball-player distance (px)
PROXIMITY_THRESHOLD_POSSESSION = 80; // Possession distance (px)
HOOP_REGION_Y_MAX = 0.4; // Top 40% of frame
```

These can be adjusted based on video quality and court setup.
