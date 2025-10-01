/**
 * Test Runner for Annotated Clips
 *
 * Runs the analysis pipeline on annotated test clips and computes accuracy metrics
 */

import type {
  AnnotatedClip,
  EvaluationResult,
  ScoreEvent,
  ShotAttempt,
  Rebound,
  Turnover,
} from "./test-data-schema";
import type { GameData, GameEvent } from "@/types";

export class TestRunner {
  /**
   * Run a single annotated clip through the analysis pipeline
   */
  async runClip(
    clip: AnnotatedClip,
    analyzeFunction: (videoPath: string, options: any) => Promise<GameData>
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    try {
      // Run the analysis
      const result = await analyzeFunction(clip.filename, {
        samplingRate: 1,
        enableBallDetection: false,
        enablePoseEstimation: false,
        enable3ptEstimation: false,
      });

      const processingTime = (Date.now() - startTime) / 1000;

      // Evaluate results
      const scoreEventAccuracy = this.evaluateScoreEvents(
        clip.groundTruth.scoreEvents,
        result.events.filter((e) => e.type === "score")
      );

      const shotAttemptAccuracy = this.evaluateShotAttempts(
        clip.groundTruth.shotAttempts,
        result.events.filter((e) => e.type === "shot_attempt")
      );

      const reboundAccuracy = this.evaluateRebounds(
        clip.groundTruth.rebounds,
        result.events.filter(
          (e) =>
            e.type === "offensive_rebound" || e.type === "defensive_rebound"
        )
      );

      const turnoverAccuracy = this.evaluateTurnovers(
        clip.groundTruth.turnovers,
        result.events.filter((e) => e.type === "turnover")
      );

      const teamAttributionAccuracy = this.evaluateTeamAttribution(
        clip.groundTruth.scoreEvents,
        result.events.filter((e) => e.type === "score")
      );

      const warnings = this.generateWarnings(clip, result);

      return {
        clipId: clip.id,
        scoreEventAccuracy,
        shotAttemptAccuracy,
        reboundAccuracy,
        turnoverAccuracy,
        teamAttributionAccuracy,
        processingTime,
        warnings,
      };
    } catch (error) {
      throw new Error(
        `Failed to run clip ${clip.id}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Evaluate score event detection
   */
  private evaluateScoreEvents(
    groundTruth: ScoreEvent[],
    detected: GameEvent[]
  ): {
    precision: number;
    recall: number;
    f1Score: number;
    timestampError: number;
  } {
    let truePositives = 0;
    let totalTimestampError = 0;
    const matchedGT = new Set<number>();

    // For each detected event, find closest ground truth event
    for (const detectedEvent of detected) {
      let closestMatch: { index: number; timeDiff: number } | null = null;

      for (let idx = 0; idx < groundTruth.length; idx++) {
        if (matchedGT.has(idx)) continue;

        const gtEvent = groundTruth[idx];
        const timeDiff = Math.abs(detectedEvent.timestamp - gtEvent.timestamp);
        if (
          timeDiff <= 1.0 &&
          (!closestMatch || timeDiff < closestMatch.timeDiff)
        ) {
          closestMatch = { index: idx, timeDiff };
        }
      }

      if (closestMatch !== null) {
        truePositives++;
        totalTimestampError += closestMatch.timeDiff;
        matchedGT.add(closestMatch.index);
      }
    }

    const precision = detected.length > 0 ? truePositives / detected.length : 0;
    const recall =
      groundTruth.length > 0 ? truePositives / groundTruth.length : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    const timestampError =
      truePositives > 0 ? totalTimestampError / truePositives : 0;

    return { precision, recall, f1Score, timestampError };
  }

  /**
   * Evaluate shot attempt inference
   */
  private evaluateShotAttempts(
    groundTruth: ShotAttempt[],
    detected: GameEvent[]
  ): {
    precision: number;
    recall: number;
    f1Score: number;
  } {
    let truePositives = 0;
    const matchedGT = new Set<number>();

    for (const detectedEvent of detected) {
      const closestIdx = this.findClosestEvent(
        detectedEvent.timestamp,
        groundTruth,
        matchedGT,
        1.0
      );
      if (closestIdx !== null) {
        truePositives++;
        matchedGT.add(closestIdx);
      }
    }

    const precision = detected.length > 0 ? truePositives / detected.length : 0;
    const recall =
      groundTruth.length > 0 ? truePositives / groundTruth.length : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return { precision, recall, f1Score };
  }

  /**
   * Evaluate rebound detection
   */
  private evaluateRebounds(
    groundTruth: Rebound[],
    detected: GameEvent[]
  ): {
    precision: number;
    recall: number;
    f1Score: number;
  } {
    let truePositives = 0;
    const matchedGT = new Set<number>();

    for (const detectedEvent of detected) {
      const closestIdx = this.findClosestEvent(
        detectedEvent.timestamp,
        groundTruth,
        matchedGT,
        2.0
      );
      if (closestIdx !== null) {
        truePositives++;
        matchedGT.add(closestIdx);
      }
    }

    const precision = detected.length > 0 ? truePositives / detected.length : 0;
    const recall =
      groundTruth.length > 0 ? truePositives / groundTruth.length : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return { precision, recall, f1Score };
  }

  /**
   * Evaluate turnover detection
   */
  private evaluateTurnovers(
    groundTruth: Turnover[],
    detected: GameEvent[]
  ): {
    precision: number;
    recall: number;
    f1Score: number;
  } {
    let truePositives = 0;
    const matchedGT = new Set<number>();

    for (const detectedEvent of detected) {
      const closestIdx = this.findClosestEvent(
        detectedEvent.timestamp,
        groundTruth,
        matchedGT,
        2.0
      );
      if (closestIdx !== null) {
        truePositives++;
        matchedGT.add(closestIdx);
      }
    }

    const precision = detected.length > 0 ? truePositives / detected.length : 0;
    const recall =
      groundTruth.length > 0 ? truePositives / groundTruth.length : 0;
    const f1Score =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;

    return { precision, recall, f1Score };
  }

  /**
   * Evaluate team attribution accuracy for score events
   */
  private evaluateTeamAttribution(
    groundTruth: ScoreEvent[],
    detected: GameEvent[]
  ): number {
    let correctAttributions = 0;
    const matchedGT = new Set<number>();

    for (const detectedEvent of detected) {
      let closestMatch: { index: number; timeDiff: number } | null = null;

      for (let idx = 0; idx < groundTruth.length; idx++) {
        if (matchedGT.has(idx)) continue;

        const gtEvent = groundTruth[idx];
        const timeDiff = Math.abs(detectedEvent.timestamp - gtEvent.timestamp);
        if (
          timeDiff <= 1.0 &&
          (!closestMatch || timeDiff < closestMatch.timeDiff)
        ) {
          closestMatch = { index: idx, timeDiff };
        }
      }

      if (closestMatch !== null) {
        matchedGT.add(closestMatch.index);
        if (detectedEvent.teamId === groundTruth[closestMatch.index].teamId) {
          correctAttributions++;
        }
      }
    }

    return matchedGT.size > 0 ? correctAttributions / matchedGT.size : 0;
  }

  /**
   * Find closest event within tolerance window
   */
  private findClosestEvent(
    timestamp: number,
    events: Array<{ timestamp: number }>,
    matched: Set<number>,
    tolerance: number
  ): number | null {
    let closestIdx: number | null = null;
    let minDiff = Infinity;

    events.forEach((event, idx) => {
      if (matched.has(idx)) return;

      const diff = Math.abs(timestamp - event.timestamp);
      if (diff <= tolerance && diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    return closestIdx;
  }

  /**
   * Generate warnings based on clip conditions and results
   */
  private generateWarnings(clip: AnnotatedClip, result: GameData): string[] {
    const warnings: string[] = [];

    if (clip.conditions.lighting === "poor") {
      warnings.push("Poor lighting conditions may affect detection accuracy");
    }

    if (clip.conditions.cameraStability === "shaky") {
      warnings.push("Shaky camera footage may reduce tracking reliability");
    }

    if (clip.conditions.scoreboardVisibility !== "clear") {
      warnings.push("Scoreboard visibility issues may impact OCR accuracy");
    }

    if (result.events.length === 0) {
      warnings.push("No events detected - check analysis configuration");
    }

    return warnings;
  }

  /**
   * Run entire test suite and generate report
   */
  async runTestSuite(
    clips: AnnotatedClip[],
    analyzeFunction: (videoPath: string, options: any) => Promise<GameData>
  ): Promise<{
    results: EvaluationResult[];
    summary: {
      avgScoreAccuracy: number;
      avgTeamAttribution: number;
      avgShotInference: number;
      avgProcessingTime: number;
      passRate: number;
    };
  }> {
    const results: EvaluationResult[] = [];

    for (const clip of clips) {
      try {
        const result = await this.runClip(clip, analyzeFunction);
        results.push(result);
      } catch (error) {
        console.error(`Failed to evaluate clip ${clip.id}:`, error);
      }
    }

    // Calculate summary statistics
    const summary = {
      avgScoreAccuracy:
        results.reduce((sum, r) => sum + r.scoreEventAccuracy.f1Score, 0) /
        results.length,
      avgTeamAttribution:
        results.reduce((sum, r) => sum + r.teamAttributionAccuracy, 0) /
        results.length,
      avgShotInference:
        results.reduce((sum, r) => sum + r.shotAttemptAccuracy.f1Score, 0) /
        results.length,
      avgProcessingTime:
        results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      passRate:
        results.filter(
          (r) =>
            r.scoreEventAccuracy.f1Score >= 0.95 &&
            r.teamAttributionAccuracy >= 0.8
        ).length / results.length,
    };

    return { results, summary };
  }
}
