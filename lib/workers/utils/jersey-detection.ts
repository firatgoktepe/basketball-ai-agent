import Tesseract from "tesseract.js";
import type { JerseyDetectionResult } from "@/types";

/**
 * Jersey Number Detection System
 * Detects and tracks player jersey numbers for per-player statistics
 * Uses OCR combined with motion-based re-identification
 */

interface PlayerTrack {
  playerId: string; // Jersey number
  teamId?: string;
  lastSeen: number; // timestamp
  appearances: Array<{
    timestamp: number;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
  visualFeatures?: {
    avgColor: [number, number, number];
    height: number;
  };
}

export class JerseyNumberDetector {
  private worker: Tesseract.Worker | null = null;
  private playerTracks: Map<string, PlayerTrack> = new Map();
  private nextUnknownId = 1;

  async initialize(): Promise<void> {
    try {
      this.worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            // Suppress verbose logs
          }
        },
      });

      // Configure OCR for digits only
      await this.worker.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });
    } catch (error) {
      console.error("Failed to initialize Jersey OCR worker:", error);
      throw error;
    }
  }

  /**
   * Extract jersey region from person bounding box
   * Jersey numbers are typically on chest/back area
   */
  private extractJerseyRegion(
    imageData: ImageData,
    bbox: [number, number, number, number]
  ): ImageData {
    const [x, y, width, height] = bbox;

    // Jersey is typically in upper 40% of person bbox
    const jerseyY = y + height * 0.2;
    const jerseyHeight = height * 0.3;
    const jerseyX = x + width * 0.25;
    const jerseyWidth = width * 0.5;

    // Clamp to image bounds
    const startX = Math.max(0, Math.floor(jerseyX));
    const startY = Math.max(0, Math.floor(jerseyY));
    const endX = Math.min(imageData.width, Math.floor(jerseyX + jerseyWidth));
    const endY = Math.min(imageData.height, Math.floor(jerseyY + jerseyHeight));

    const cropWidth = Math.max(1, endX - startX); // Ensure at least 1px
    const cropHeight = Math.max(1, endY - startY); // Ensure at least 1px

    // Validate dimensions before creating ImageData
    if (
      !isFinite(cropWidth) ||
      !isFinite(cropHeight) ||
      cropWidth <= 0 ||
      cropHeight <= 0
    ) {
      console.warn("Invalid jersey crop dimensions, returning 1x1 placeholder");
      return new ImageData(1, 1);
    }

    const jerseyImageData = new ImageData(cropWidth, cropHeight);

    for (let row = 0; row < cropHeight; row++) {
      for (let col = 0; col < cropWidth; col++) {
        const sourceIdx =
          ((startY + row) * imageData.width + (startX + col)) * 4;
        const targetIdx = (row * cropWidth + col) * 4;

        jerseyImageData.data[targetIdx] = imageData.data[sourceIdx]; // R
        jerseyImageData.data[targetIdx + 1] = imageData.data[sourceIdx + 1]; // G
        jerseyImageData.data[targetIdx + 2] = imageData.data[sourceIdx + 2]; // B
        jerseyImageData.data[targetIdx + 3] = imageData.data[sourceIdx + 3]; // A
      }
    }

    return jerseyImageData;
  }

  /**
   * Preprocess jersey image for better OCR recognition
   * Apply contrast enhancement and thresholding
   */
  private preprocessJerseyImage(imageData: ImageData): ImageData {
    // Validate input dimensions
    if (!imageData || imageData.width <= 0 || imageData.height <= 0) {
      console.warn(
        "Invalid imageData for preprocessing, returning 1x1 placeholder"
      );
      return new ImageData(1, 1);
    }

    const processed = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    // Convert to grayscale and enhance contrast
    for (let i = 0; i < processed.data.length; i += 4) {
      const r = processed.data[i];
      const g = processed.data[i + 1];
      const b = processed.data[i + 2];

      // Grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Simple contrast enhancement
      const enhanced = gray > 128 ? 255 : 0;

      processed.data[i] = enhanced;
      processed.data[i + 1] = enhanced;
      processed.data[i + 2] = enhanced;
    }

    return processed;
  }

  /**
   * Run OCR on jersey region to extract number
   */
  private async runJerseyOCR(jerseyImageData: ImageData): Promise<{
    number: string | null;
    confidence: number;
  }> {
    if (!this.worker) {
      return { number: null, confidence: 0 };
    }

    try {
      // Preprocess for better OCR
      const preprocessed = this.preprocessJerseyImage(jerseyImageData);

      // Convert to canvas for OCR
      const canvas = new OffscreenCanvas(
        preprocessed.width,
        preprocessed.height
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return { number: null, confidence: 0 };
      }

      ctx.putImageData(preprocessed, 0, 0);
      const blob = await canvas.convertToBlob({ type: "image/png" });

      // Run OCR
      const {
        data: { text, confidence },
      } = await this.worker.recognize(blob);

      // Extract valid jersey number (1-2 digits, typically 0-99)
      const cleaned = text.replace(/\s+/g, "").trim();
      const match = cleaned.match(/^(\d{1,2})$/);

      if (match && confidence > 50) {
        // Require at least 50% confidence
        return {
          number: match[1],
          confidence: confidence / 100,
        };
      }

      return { number: null, confidence: 0 };
    } catch (error) {
      console.error("Jersey OCR failed:", error);
      return { number: null, confidence: 0 };
    }
  }

  /**
   * Extract visual features for player re-identification
   */
  private extractVisualFeatures(
    imageData: ImageData,
    bbox: [number, number, number, number]
  ): { avgColor: [number, number, number]; height: number } {
    const [x, y, width, height] = bbox;

    let r = 0,
      g = 0,
      b = 0,
      count = 0;

    // Sample pixels in bbox
    const step = 5; // Sample every 5th pixel
    for (let dy = 0; dy < height; dy += step) {
      for (let dx = 0; dx < width; dx += step) {
        const px = Math.floor(x + dx);
        const py = Math.floor(y + dy);

        if (
          px >= 0 &&
          px < imageData.width &&
          py >= 0 &&
          py < imageData.height
        ) {
          const idx = (py * imageData.width + px) * 4;
          r += imageData.data[idx];
          g += imageData.data[idx + 1];
          b += imageData.data[idx + 2];
          count++;
        }
      }
    }

    return {
      avgColor: [r / count, g / count, b / count] as [number, number, number],
      height,
    };
  }

  /**
   * Find matching player track based on visual similarity
   * Used when OCR fails to identify jersey number
   */
  private findMatchingTrack(
    bbox: [number, number, number, number],
    visualFeatures: { avgColor: [number, number, number]; height: number },
    timestamp: number,
    teamId?: string
  ): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const [playerId, track] of this.playerTracks) {
      // Only match within same team
      if (teamId && track.teamId && track.teamId !== teamId) {
        continue;
      }

      // Skip if not seen recently (> 5 seconds)
      if (timestamp - track.lastSeen > 5.0) {
        continue;
      }

      if (!track.visualFeatures) {
        continue;
      }

      // Compute similarity score based on color and height
      const colorDist = Math.sqrt(
        Math.pow(
          visualFeatures.avgColor[0] - track.visualFeatures.avgColor[0],
          2
        ) +
          Math.pow(
            visualFeatures.avgColor[1] - track.visualFeatures.avgColor[1],
            2
          ) +
          Math.pow(
            visualFeatures.avgColor[2] - track.visualFeatures.avgColor[2],
            2
          )
      );

      const heightDiff = Math.abs(
        visualFeatures.height - track.visualFeatures.height
      );

      // Normalize and combine (lower is better)
      const colorScore = 1 - Math.min(colorDist / 255, 1);
      const heightScore = 1 - Math.min(heightDiff / 100, 1);
      const combinedScore = 0.7 * colorScore + 0.3 * heightScore;

      if (combinedScore > bestScore && combinedScore > 0.6) {
        bestScore = combinedScore;
        bestMatch = playerId;
      }
    }

    return bestMatch;
  }

  /**
   * Process a single frame to detect player jersey numbers
   */
  async processFrame(
    imageData: ImageData,
    personDetections: any[],
    frameIndex: number,
    timestamp: number
  ): Promise<JerseyDetectionResult> {
    const players: JerseyDetectionResult["players"] = [];

    // Process each detected person
    for (const detection of personDetections) {
      if (detection.type !== "person") continue;

      const bbox = detection.bbox as [number, number, number, number];
      const teamId = detection.teamId;

      // Extract jersey region
      const jerseyImageData = this.extractJerseyRegion(imageData, bbox);

      // Try OCR first
      const ocrResult = await this.runJerseyOCR(jerseyImageData);

      let playerId: string;
      let confidence: number;

      if (ocrResult.number && ocrResult.confidence > 0.6) {
        // Successfully detected jersey number
        playerId = ocrResult.number;
        confidence = ocrResult.confidence;

        // Update or create player track
        if (!this.playerTracks.has(playerId)) {
          this.playerTracks.set(playerId, {
            playerId,
            teamId,
            lastSeen: timestamp,
            appearances: [],
            visualFeatures: this.extractVisualFeatures(imageData, bbox),
          });
        }

        const track = this.playerTracks.get(playerId)!;
        track.lastSeen = timestamp;
        track.appearances.push({ timestamp, bbox, confidence });
      } else {
        // OCR failed, try visual re-identification
        const visualFeatures = this.extractVisualFeatures(imageData, bbox);
        const matchedId = this.findMatchingTrack(
          bbox,
          visualFeatures,
          timestamp,
          teamId
        );

        if (matchedId) {
          playerId = matchedId;
          confidence = 0.5; // Lower confidence for visual matching
          const track = this.playerTracks.get(playerId)!;
          track.lastSeen = timestamp;
          track.appearances.push({ timestamp, bbox, confidence });
        } else {
          // Create unknown player track
          playerId = `unknown-${this.nextUnknownId++}`;
          confidence = 0.3;

          this.playerTracks.set(playerId, {
            playerId,
            teamId,
            lastSeen: timestamp,
            appearances: [{ timestamp, bbox, confidence }],
            visualFeatures,
          });
        }
      }

      players.push({
        playerId,
        bbox,
        teamId,
        confidence,
      });
    }

    return {
      frameIndex,
      timestamp,
      players,
    };
  }

  /**
   * Get all tracked players
   */
  getTrackedPlayers(): PlayerTrack[] {
    return Array.from(this.playerTracks.values());
  }

  /**
   * Clean up old tracks that haven't been seen recently
   */
  cleanupOldTracks(currentTimestamp: number, maxAge: number = 10.0): void {
    for (const [playerId, track] of this.playerTracks) {
      if (currentTimestamp - track.lastSeen > maxAge) {
        this.playerTracks.delete(playerId);
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * Batch process frames for jersey detection
 */
export async function processJerseyDetections(
  frames: ImageData[],
  personDetectionResults: any[],
  samplingRate: number = 1
): Promise<JerseyDetectionResult[]> {
  const detector = new JerseyNumberDetector();

  try {
    await detector.initialize();

    const results: JerseyDetectionResult[] = [];
    const frameInterval = Math.max(1, Math.floor(30 / samplingRate));

    for (let i = 0; i < personDetectionResults.length; i++) {
      const frame = personDetectionResults[i];
      const imageData = frames[frame.frameIndex];

      // Validate imageData exists and has valid dimensions
      if (!imageData || imageData.width <= 0 || imageData.height <= 0) {
        console.warn(
          `Invalid imageData at frame ${frame.frameIndex}, skipping jersey detection`
        );
        continue;
      }

      const result = await detector.processFrame(
        imageData,
        frame.detections || [],
        frame.frameIndex,
        frame.timestamp
      );

      results.push(result);

      // Periodic cleanup of old tracks
      if (i % 30 === 0) {
        detector.cleanupOldTracks(frame.timestamp);
      }
    }

    return results;
  } finally {
    await detector.cleanup();
  }
}

/**
 * Merge jersey detections with person detections
 * Adds playerId field to person detections
 */
export function mergeJerseyWithPersonDetections(
  personDetections: any[],
  jerseyDetections: JerseyDetectionResult[]
): any[] {
  const merged = [];

  for (const personFrame of personDetections) {
    const jerseyFrame = jerseyDetections.find(
      (j) => j.frameIndex === personFrame.frameIndex
    );

    if (!jerseyFrame) {
      merged.push(personFrame);
      continue;
    }

    // Create detection map for quick lookup
    const detections = (personFrame.detections || []).map((det: any) => {
      // Find matching jersey detection by bbox proximity
      const matchingJersey = jerseyFrame.players.find((jp) => {
        if (!det.bbox) return false;
        const [x1, y1] = det.bbox;
        const [x2, y2] = jp.bbox;
        const dist = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        return dist < 50; // Within 50 pixels
      });

      return {
        ...det,
        playerId: matchingJersey?.playerId,
      };
    });

    merged.push({
      ...personFrame,
      detections,
    });
  }

  return merged;
}
