# Testing Guide

This document describes the testing infrastructure, evaluation methodology, and how to run tests for the Basketball Quick Stats application.

## Overview

The testing approach focuses on measuring the accuracy of automated detection against manually annotated ground truth data across a diverse set of basketball video clips.

## Test Data Structure

### Annotated Clips

Each test clip includes:

- Video file metadata (filename, duration, resolution)
- Recording conditions (lighting, stability, scoreboard visibility)
- Ground truth annotations:
  - Score events with timestamps and team attribution
  - Shot attempts (made/missed, 2pt/3pt)
  - Rebounds (offensive/defensive)
  - Turnovers
  - Expected team statistics

### Directory Structure

```
test-clips/
├── broadcast/
│   ├── broadcast_clear.mp4
│   ├── broadcast_clear.json
│   └── ...
├── amateur/
│   ├── amateur_moderate.mp4
│   ├── amateur_moderate.json
│   └── ...
└── annotations.json  # Master annotation file
```

## Evaluation Metrics

### 1. Score Event Detection

- **Precision**: % of detected score events that are correct
- **Recall**: % of actual score events that were detected
- **F1 Score**: Harmonic mean of precision and recall
- **Timestamp Error**: Average time difference (seconds) between detected and actual events
- **Target**: F1 ≥ 0.95, Timestamp Error ≤ 1.0s

### 2. Team Attribution

- **Accuracy**: % of score events correctly attributed to the right team
- **Target**: ≥ 80% correct attribution

### 3. Shot Attempt Inference

- **Precision/Recall/F1**: Detection accuracy for shot attempts
- **Target**: F1 ≥ 0.60 (initial target for broadcast footage)

### 4. Rebound Detection

- **Precision/Recall/F1**: Detection accuracy for rebounds
- **Target**: F1 ≥ 0.60

### 5. Performance

- **Processing Time**: Time to process a 2-minute clip
- **Target**: No UI freezing (Web Workers functioning correctly)

## Running Tests

### Programmatic Testing

```typescript
import { TestRunner } from "@/lib/test-utils/test-runner";
import { testSuiteConfig } from "@/lib/test-utils/sample-test-data";

const runner = new TestRunner();

// Run full test suite
const { results, summary } = await runner.runTestSuite(
  testSuiteConfig.clips,
  analyzeFunction
);

console.log("Average Score Accuracy:", summary.avgScoreAccuracy);
console.log("Average Team Attribution:", summary.avgTeamAttribution);
console.log("Pass Rate:", summary.passRate);
```

### Evaluation Script

Run the standalone evaluation script:

```bash
# Run all test clips
npm run test:evaluation

# Run specific clip
npm run test:evaluation -- --clip test-001-broadcast-clear

# Export results to JSON
npm run test:evaluation -- --export ./results.json
```

## Test Clip Requirements

### Minimum Set (MVP)

- 2 broadcast-quality clips (good lighting, steady camera, clear scoreboard)
- 3 amateur clips (moderate lighting, some shake, partial scoreboard)
- 2 edge case clips (poor lighting OR shaky OR occluded scoreboard)

### Ideal Set (Production)

- 10-20 clips spanning:
  - Different camera angles (broadcast, courtside, elevated amateur)
  - Various lighting conditions (indoor, outdoor, day, night)
  - Different scoreboard types (digital, manual, LED)
  - Multiple team color combinations
  - Different player counts (3v3, 5v5, full court)

## Annotation Process

### Manual Annotation

1. **Watch video and note all events**:

   - Every score change → timestamp, team, points, new total
   - Every shot attempt → timestamp, team, made/missed, 2pt/3pt
   - Every rebound → timestamp, team, offensive/defensive
   - Every turnover → timestamp, team, type

2. **Create JSON annotation file**:

   ```json
   {
     "id": "test-001-broadcast-clear",
     "filename": "broadcast_clear.mp4",
     "duration": 120,
     "groundTruth": {
       "scoreEvents": [
         {
           "timestamp": 12.4,
           "teamId": "teamA",
           "scoreDelta": 2,
           "newScore": 14,
           "confidence": "high"
         }
       ]
     }
   }
   ```

3. **Validate annotations**:
   - Watch video multiple times to ensure accuracy
   - Have second reviewer verify timestamps
   - Check that all events are captured

## Acceptance Criteria

From the PRD, the following targets must be met:

| Metric                           | Target                        | Priority |
| -------------------------------- | ----------------------------- | -------- |
| Scoreboard OCR (visible)         | ≥ 95% accuracy, ±1s timestamp | Critical |
| Team attribution (scored points) | ≥ 80% correct                 | Critical |
| Shot/rebound/turnover inference  | 60-70% accuracy               | Medium   |
| Performance (2min @ 1fps)        | No UI freeze                  | Critical |
| Timeline markers                 | Clickable & functional        | Critical |
| Export functionality             | JSON/CSV working              | High     |

## Continuous Evaluation

### After Major Changes

1. Run full test suite
2. Compare metrics against baseline
3. Document any regressions
4. Update annotations if rules changed intentionally

### Release Checklist

- [ ] All test clips pass minimum thresholds
- [ ] No new warnings or errors
- [ ] Processing time within acceptable range
- [ ] UI remains responsive during analysis
- [ ] Export functionality verified

## Adding New Test Clips

1. Prepare video file (MP4, < 500MB)
2. Annotate manually following schema
3. Add to `sample-test-data.ts` or JSON file
4. Run evaluation to verify annotations are reasonable
5. Commit both video and annotation files

## Known Limitations

- **OCR Accuracy**: Highly dependent on scoreboard font, size, and contrast
- **Ball Detection**: Small, fast objects are challenging; requires clear visibility
- **Pose Estimation**: Works best with front/side views; struggles with overhead angles
- **Team Clustering**: Similar jersey colors or mixed uniforms reduce accuracy
- **3PT Estimation**: Requires clear court view and is currently experimental

## Future Improvements

- [ ] Automated annotation tool for faster ground truth creation
- [ ] Larger test corpus (50+ clips) spanning more scenarios
- [ ] Per-condition metrics (e.g., accuracy vs. lighting quality)
- [ ] Regression tracking dashboard
- [ ] CI/CD integration for automated testing on commits

## Contributing Test Data

If you have basketball footage with known statistics, consider contributing:

1. Ensure you have rights to the footage
2. Annotate according to schema
3. Anonymize if necessary (no player names/faces)
4. Submit via pull request with annotation file

Test data helps improve the system for everyone!
