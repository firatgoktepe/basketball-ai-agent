import Tesseract from "tesseract.js";
import type { OCRResult, GameEvent } from "@/types";

interface ScoreboardOCRConfig {
  cropRegion: { x: number; y: number; width: number; height: number };
  samplingRate: number; // frames per second
  onScoreChange?: (event: GameEvent) => void;
}

export class ScoreboardOCRProcessor {
  private config: ScoreboardOCRConfig;
  private previousScores: { teamA: number; teamB: number } | null = null;
  private isProcessing = false;
  private worker: Tesseract.Worker | null = null;

  constructor(config: ScoreboardOCRConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      // Configure OCR for better scoreboard recognition
      await this.worker.setParameters({
        tessedit_char_whitelist:
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -:",
      });
    } catch (error) {
      console.error("Failed to initialize OCR worker:", error);
      throw error;
    }
  }

  async processFrame(
    frame: ImageData,
    frameIndex: number,
    timestamp: number
  ): Promise<OCRResult> {
    if (!this.worker) {
      throw new Error("OCR worker not initialized");
    }

    try {
      // Crop the scoreboard region
      const croppedImageData = this.cropImageData(
        frame,
        this.config.cropRegion
      );

      // Convert ImageData to canvas for OCR
      const canvas = new OffscreenCanvas(
        this.config.cropRegion.width,
        this.config.cropRegion.height
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      ctx.putImageData(croppedImageData, 0, 0);

      // Convert canvas to image for OCR
      const imageBlob = await canvas.convertToBlob({ type: "image/png" });

      // Run OCR on the cropped region
      const {
        data: { text, confidence },
      } = await this.worker.recognize(imageBlob);

      // Parse score from OCR text
      const scores = this.parseScoreFromText(text);

      // Check for score changes and generate events
      if (this.previousScores) {
        const scoreChange = this.detectScoreChange(this.previousScores, scores);
        if (scoreChange) {
          this.generateScoreEvent(scoreChange, timestamp);
        }
      }

      this.previousScores = scores;

      return {
        frameIndex,
        timestamp,
        scores,
        confidence: confidence / 100, // Convert to 0-1 scale
      };
    } catch (error) {
      console.error("OCR failed for frame", frameIndex, error);
      return {
        frameIndex,
        timestamp,
        scores: { teamA: 0, teamB: 0 },
        confidence: 0.0,
      };
    }
  }

  private cropImageData(
    imageData: ImageData,
    cropRegion: { x: number; y: number; width: number; height: number }
  ): ImageData {
    const { x, y, width, height } = cropRegion;

    // Validate dimensions
    if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
      console.warn("Invalid crop region dimensions, returning 1x1 placeholder");
      return new ImageData(1, 1);
    }

    const croppedData = new ImageData(width, height);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const sourceIndex = ((y + row) * imageData.width + (x + col)) * 4;
        const targetIndex = (row * width + col) * 4;

        croppedData.data[targetIndex] = imageData.data[sourceIndex]; // R
        croppedData.data[targetIndex + 1] = imageData.data[sourceIndex + 1]; // G
        croppedData.data[targetIndex + 2] = imageData.data[sourceIndex + 2]; // B
        croppedData.data[targetIndex + 3] = imageData.data[sourceIndex + 3]; // A
      }
    }

    return croppedData;
  }

  private parseScoreFromText(text: string): { teamA: number; teamB: number } {
    // Clean the text and look for score patterns
    const cleanText = text.replace(/\s+/g, " ").trim().toLowerCase();

    // Look for common score patterns
    const patterns = [
      // "Team A 45 - 42 Team B" or "45 - 42"
      /(\d+)\s*[-–]\s*(\d+)/,
      // "45:42" or "45 42"
      /(\d+)\s*[:]\s*(\d+)/,
      // "Score: 45-42" or "45 42"
      /(?:score|pts?|points?)[:\s]*(\d+)\s*[-–:]\s*(\d+)/i,
      // Just two numbers separated by space
      /(\d+)\s+(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const teamA = parseInt(match[1]) || 0;
        const teamB = parseInt(match[2]) || 0;

        // Validate reasonable score values (0-200 points)
        if (teamA >= 0 && teamA <= 200 && teamB >= 0 && teamB <= 200) {
          return { teamA, teamB };
        }
      }
    }

    // Fallback: look for any numbers in the text
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const teamA = parseInt(numbers[0]) || 0;
      const teamB = parseInt(numbers[1]) || 0;

      // Validate reasonable score values
      if (teamA >= 0 && teamA <= 200 && teamB >= 0 && teamB <= 200) {
        return { teamA, teamB };
      }
    }

    // Return 0 if no valid score found
    return { teamA: 0, teamB: 0 };
  }

  private detectScoreChange(
    previous: { teamA: number; teamB: number },
    current: { teamA: number; teamB: number }
  ): { teamId: string; scoreDelta: number } | null {
    const teamADelta = current.teamA - previous.teamA;
    const teamBDelta = current.teamB - previous.teamB;

    // Only detect changes if exactly one team scored
    if (teamADelta > 0 && teamBDelta === 0) {
      return { teamId: "teamA", scoreDelta: teamADelta };
    } else if (teamBDelta > 0 && teamADelta === 0) {
      return { teamId: "teamB", scoreDelta: teamBDelta };
    }

    return null;
  }

  private generateScoreEvent(
    scoreChange: { teamId: string; scoreDelta: number },
    timestamp: number
  ): void {
    const event: GameEvent = {
      id: `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "score",
      teamId: scoreChange.teamId,
      scoreDelta: scoreChange.scoreDelta,
      timestamp,
      confidence: 0.9, // High confidence for OCR-detected score changes
      source: "ocr",
      notes: `Detected by scoreboard OCR: +${scoreChange.scoreDelta} points`,
    };

    this.config.onScoreChange?.(event);
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

// Utility function for batch processing
export async function processFramesWithOCR(
  frames: ImageData[],
  config: ScoreboardOCRConfig
): Promise<OCRResult[]> {
  const processor = new ScoreboardOCRProcessor(config);

  try {
    await processor.initialize();

    const results: OCRResult[] = [];
    const frameInterval = Math.max(1, Math.floor(30 / config.samplingRate)); // Calculate frame interval

    for (let i = 0; i < frames.length; i += frameInterval) {
      const frame = frames[i];
      const timestamp = i * (1 / 30); // Assuming 30fps

      const result = await processor.processFrame(frame, i, timestamp);
      results.push(result);
    }

    return results;
  } finally {
    await processor.cleanup();
  }
}
