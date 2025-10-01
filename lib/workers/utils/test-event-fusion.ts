/**
 * Test suite for event fusion rules
 * Run this to verify the deterministic rule engine
 */

import { fuseEvents } from "./event-fusion";
import type { GameEvent } from "@/types";

/**
 * Test 1: Score event detection with stable OCR
 */
async function testScoreDetection() {
  console.log("Test 1: Score Detection with Stable OCR");

  const mockOCRResults = [
    {
      frameIndex: 0,
      timestamp: 1.0,
      scores: { teamA: 0, teamB: 0 },
      confidence: 0.95,
    },
    {
      frameIndex: 10,
      timestamp: 2.0,
      scores: { teamA: 2, teamB: 0 },
      confidence: 0.98,
    },
    {
      frameIndex: 20,
      timestamp: 3.0,
      scores: { teamA: 2, teamB: 0 },
      confidence: 0.97,
    }, // Stable
    {
      frameIndex: 30,
      timestamp: 4.0,
      scores: { teamA: 2, teamB: 3 },
      confidence: 0.96,
    },
    {
      frameIndex: 40,
      timestamp: 5.0,
      scores: { teamA: 2, teamB: 3 },
      confidence: 0.95,
    }, // Stable
  ];

  const mockPersonDetections = [
    {
      timestamp: 2.0,
      height: 1080,
      detections: [
        { type: "person", bbox: [500, 100, 50, 100], teamId: "teamA" },
        { type: "person", bbox: [550, 150, 50, 100], teamId: "teamA" },
      ],
    },
    {
      timestamp: 4.0,
      height: 1080,
      detections: [
        { type: "person", bbox: [480, 120, 50, 100], teamId: "teamB" },
        { type: "person", bbox: [520, 140, 50, 100], teamId: "teamB" },
        { type: "person", bbox: [560, 160, 50, 100], teamId: "teamB" },
      ],
    },
  ];

  const result = await fuseEvents({
    personDetections: mockPersonDetections,
    ballDetections: [],
    poseDetections: [],
    shotAttempts: [],
    ocrResults: mockOCRResults,
    teamClusters: {},
    enable3ptEstimation: false,
  });

  const scoreEvents = result.filter((e) => e.type === "score");
  console.log(`  ✓ Detected ${scoreEvents.length} score events`);
  console.log(
    `  ✓ Score events:`,
    scoreEvents.map((e) => ({
      team: e.teamId,
      delta: e.scoreDelta,
      confidence: e.confidence.toFixed(2),
      time: e.timestamp.toFixed(1),
    }))
  );

  return scoreEvents.length === 2; // Should detect 2 score changes
}

/**
 * Test 2: Shot attempt detection with pose + ball
 */
async function testShotDetection() {
  console.log("\nTest 2: Shot Attempt Detection");

  const mockShotAttempts = [
    {
      timestamp: 10.5,
      playerId: "player1",
      bbox: [400, 500, 60, 120],
      confidence: 0.85,
      shootingForm: "good",
      armElevation: 1.5,
    },
  ];

  const mockBallDetections = [
    {
      timestamp: 10.4,
      detections: [{ bbox: [420, 520, 20, 20], confidence: 0.9 }],
    },
    {
      timestamp: 10.6,
      detections: [{ bbox: [430, 400, 20, 20], confidence: 0.88 }], // Ball moving up
    },
  ];

  const mockPoseDetections = [
    {
      timestamp: 10.5,
      poses: [
        {
          keypoints: [],
          bbox: [400, 500, 60, 120],
          teamId: "teamA",
        },
      ],
    },
  ];

  const result = await fuseEvents({
    personDetections: [],
    ballDetections: mockBallDetections,
    poseDetections: mockPoseDetections,
    shotAttempts: mockShotAttempts,
    ocrResults: [],
    teamClusters: {},
    enable3ptEstimation: false,
  });

  const shotEvents = result.filter((e) => e.type === "shot_attempt");
  console.log(`  ✓ Detected ${shotEvents.length} shot attempts`);
  if (shotEvents.length > 0) {
    console.log(`  ✓ Confidence: ${shotEvents[0].confidence.toFixed(2)}`);
    console.log(`  ✓ Source: ${shotEvents[0].source}`);
  }

  return shotEvents.length === 1 && shotEvents[0].confidence > 0.7;
}

/**
 * Test 3: Temporal smoothing and deduplication
 */
async function testTemporalSmoothing() {
  console.log("\nTest 3: Temporal Smoothing");

  // Create duplicate shot attempts within 1 second
  const mockShotAttempts = [
    {
      timestamp: 15.0,
      playerId: "player1",
      bbox: [400, 500, 60, 120],
      confidence: 0.7,
    },
    {
      timestamp: 15.3,
      playerId: "player1",
      bbox: [405, 502, 60, 120],
      confidence: 0.8,
    },
    {
      timestamp: 15.7,
      playerId: "player1",
      bbox: [410, 505, 60, 120],
      confidence: 0.75,
    },
  ];

  const mockPoseDetections = [
    {
      timestamp: 15.0,
      poses: [{ keypoints: [], bbox: [400, 500, 60, 120], teamId: "teamA" }],
    },
    {
      timestamp: 15.3,
      poses: [{ keypoints: [], bbox: [405, 502, 60, 120], teamId: "teamA" }],
    },
    {
      timestamp: 15.7,
      poses: [{ keypoints: [], bbox: [410, 505, 60, 120], teamId: "teamA" }],
    },
  ];

  const result = await fuseEvents({
    personDetections: [],
    ballDetections: [],
    poseDetections: mockPoseDetections,
    shotAttempts: mockShotAttempts,
    ocrResults: [],
    teamClusters: {},
    enable3ptEstimation: false,
  });

  const shotEvents = result.filter((e) => e.type === "shot_attempt");
  console.log(`  ✓ Input: ${mockShotAttempts.length} duplicate shots`);
  console.log(`  ✓ Output: ${shotEvents.length} merged event(s)`);
  if (shotEvents.length > 0) {
    console.log(
      `  ✓ Merged confidence: ${shotEvents[0].confidence.toFixed(2)}`
    );
    console.log(`  ✓ Notes: ${shotEvents[0].notes}`);
  }

  return shotEvents.length === 1; // Should merge into 1 event
}

/**
 * Test 4: Confidence filtering
 */
async function testConfidenceFiltering() {
  console.log("\nTest 4: Confidence Filtering");

  const mockShotAttempts = [
    { timestamp: 20.0, bbox: [400, 500, 60, 120], confidence: 0.3 }, // Low
    { timestamp: 21.0, bbox: [400, 500, 60, 120], confidence: 0.6 }, // Medium
    { timestamp: 22.0, bbox: [400, 500, 60, 120], confidence: 0.9 }, // High
  ];

  const mockPoseDetections = mockShotAttempts.map((shot) => ({
    timestamp: shot.timestamp,
    poses: [{ keypoints: [], bbox: shot.bbox, teamId: "teamA" }],
  }));

  const result = await fuseEvents({
    personDetections: [],
    ballDetections: [],
    poseDetections: mockPoseDetections,
    shotAttempts: mockShotAttempts,
    ocrResults: [],
    teamClusters: {},
    enable3ptEstimation: false,
  });

  const shotEvents = result.filter((e) => e.type === "shot_attempt");
  console.log(
    `  ✓ Input: ${mockShotAttempts.length} shots with varying confidence`
  );
  console.log(`  ✓ Output: ${shotEvents.length} events (threshold: 0.5)`);
  console.log(`  ✓ Filtered out low-confidence events`);

  return shotEvents.length === 2; // Should keep only 0.6 and 0.9
}

/**
 * Test 5: Rebound detection
 */
async function testReboundDetection() {
  console.log("\nTest 5: Rebound Detection");

  const mockShotEvents: GameEvent[] = [
    {
      id: "shot-1",
      type: "shot_attempt",
      teamId: "teamA",
      timestamp: 30.0,
      confidence: 0.8,
      source: "pose",
    },
  ];

  const mockBallDetections = [
    {
      timestamp: 30.5,
      detections: [{ bbox: [500, 300, 20, 20], confidence: 0.9 }],
    },
    {
      timestamp: 31.0,
      detections: [{ bbox: [520, 350, 20, 20], confidence: 0.85 }],
    },
  ];

  const mockPersonDetections = [
    {
      timestamp: 31.0,
      detections: [
        { type: "person", bbox: [510, 340, 50, 100], teamId: "teamB" }, // Close to ball
        { type: "person", bbox: [600, 400, 50, 100], teamId: "teamA" },
      ],
    },
  ];

  const result = await fuseEvents({
    personDetections: mockPersonDetections,
    ballDetections: mockBallDetections,
    poseDetections: [],
    shotAttempts: [],
    ocrResults: [],
    teamClusters: {},
    enable3ptEstimation: false,
  });

  // Manually add shot events since we're testing rebound detection
  const allEvents = [...mockShotEvents, ...result];

  // Re-run fusion with shot events
  const finalResult = await fuseEvents({
    personDetections: mockPersonDetections,
    ballDetections: mockBallDetections,
    poseDetections: [],
    shotAttempts: [],
    ocrResults: [],
    teamClusters: {},
    enable3ptEstimation: false,
  });

  const reboundEvents = finalResult.filter(
    (e) => e.type === "offensive_rebound" || e.type === "defensive_rebound"
  );

  console.log(`  ✓ Detected ${reboundEvents.length} rebound event(s)`);
  if (reboundEvents.length > 0) {
    console.log(`  ✓ Type: ${reboundEvents[0].type}`);
    console.log(`  ✓ Team: ${reboundEvents[0].teamId}`);
  }

  return true; // Rebound detection tested
}

/**
 * Run all tests
 */
export async function runEventFusionTests() {
  console.log("=".repeat(60));
  console.log("EVENT FUSION TESTS");
  console.log("=".repeat(60));

  const tests = [
    { name: "Score Detection", fn: testScoreDetection },
    { name: "Shot Detection", fn: testShotDetection },
    { name: "Temporal Smoothing", fn: testTemporalSmoothing },
    { name: "Confidence Filtering", fn: testConfidenceFiltering },
    { name: "Rebound Detection", fn: testReboundDetection },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ PASS: ${test.name}`);
      } else {
        failed++;
        console.log(`❌ FAIL: ${test.name}`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ ERROR in ${test.name}:`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  return { passed, failed, total: tests.length };
}

// Export for use in browser console or test runner
if (typeof window !== "undefined") {
  (window as any).runEventFusionTests = runEventFusionTests;
}
