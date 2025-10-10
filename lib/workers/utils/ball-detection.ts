import type { DetectionResult } from "@/types";
import type {
  ONNXBallDetector,
  BallDetectionResult,
} from "../models/onnx-ball-detection";

export interface BallDetection {
  bbox: [number, number, number, number];
  confidence: number;
  trajectory?: { x: number; y: number; velocity: number };
}

interface BallTracker {
  detections: BallDetection[];
  lastPosition: { x: number; y: number } | null;
  velocity: { x: number; y: number } | null;
}

export async function detectBall(
  frames: ImageData[],
  onnxDetector?: ONNXBallDetector,
  samplingRate: number = 1,
  videoDuration: number = 0
): Promise<DetectionResult[]> {
  const results: DetectionResult[] = [];
  const tracker = new BallTracker();

  console.log(`[Ball Detection] Starting detection on ${frames.length} frames`);
  
  const timePerFrame = videoDuration > 0 ? videoDuration / frames.length : 1 / samplingRate;
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const timestamp = i * timePerFrame;

    // Log progress every 10 frames
    if (i % 10 === 0) {
      console.log(`[Ball Detection] Processing frame ${i}/${frames.length}`);
    }

    // Validate frame dimensions
    if (!frame || frame.width <= 0 || frame.height <= 0) {
      console.warn(`Invalid frame dimensions at index ${i}, skipping ball detection`);
      results.push({
        frameIndex: i,
        timestamp,
        detections: [],
      });
      continue;
    }

    // Validate frame data
    if (!frame.data || frame.data.length === 0) {
      console.warn(`Invalid frame data at index ${i}, skipping ball detection`);
      results.push({
        frameIndex: i,
        timestamp,
        detections: [],
      });
      continue;
    }

    let ballDetections: BallDetection[] = [];

    // Try ONNX detection first if available
    if (onnxDetector) {
      try {
        const onnxResults = await onnxDetector.detectBalls(frame);
        ballDetections = onnxResults.map((result) => ({
          bbox: result.bbox,
          confidence: result.confidence,
          trajectory: tracker.lastPosition
            ? {
              x: result.bbox[0] + result.bbox[2] / 2,
              y: result.bbox[1] + result.bbox[3] / 2,
              velocity: tracker.velocity
                ? Math.sqrt(tracker.velocity.x ** 2 + tracker.velocity.y ** 2)
                : 0,
            }
            : undefined,
        }));
      } catch (error) {
        console.warn("ONNX ball detection failed, falling back to HSV:", error);
        // Fall back to HSV detection
        ballDetections = detectBallInFrame(frame, tracker);
      }
    } else {
      // Use HSV segmentation as fallback
      ballDetections = detectBallInFrame(frame, tracker);
    }

    // Update tracker with new detections
    tracker.updateDetections(ballDetections, timestamp);

    results.push({
      frameIndex: i,
      timestamp,
      detections: ballDetections.map((detection) => ({
        type: "ball" as const,
        bbox: detection.bbox,
        confidence: detection.confidence,
      })),
    });
  }

  console.log(`[Ball Detection] Completed detection on ${frames.length} frames, found ball in ${results.filter(r => r.detections.length > 0).length} frames`);

  return results;
}

function detectBallInFrame(
  frame: ImageData,
  tracker: BallTracker
): BallDetection[] {
  const { data, width, height } = frame;
  const detections: BallDetection[] = [];

  // Validate data
  if (!data || data.length === 0) {
    return detections;
  }

  // HSV color range for basketball - MUCH more permissive for amateur videos
  const orangeRange = {
    hMin: 0, // Extended to include red-orange
    hMax: 40, // Extended to include yellow-orange
    sMin: 30, // Much lower saturation (was 100)
    sMax: 255,
    vMin: 50, // Lower brightness threshold (was 100)
    vMax: 255,
  };

  // Convert RGB to HSV and find orange regions
  const orangePixels: { x: number; y: number }[] = [];

  // Increase sampling step for performance on large images
  const step = width > 1000 ? 4 : 2; // Sample every 4th pixel for HD, 2nd for smaller

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;

      // Bounds check
      if (index + 2 >= data.length) {
        continue;
      }

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      const hsv = rgbToHsv(r, g, b);

      if (isInOrangeRange(hsv, orangeRange)) {
        orangePixels.push({ x, y });

        // Limit collection to prevent memory issues
        if (orangePixels.length > 5000) {
          break;
        }
      }
    }

    // Break outer loop if we hit the limit
    if (orangePixels.length > 5000) {
      break;
    }
  }

  // Cluster orange pixels into potential ball regions
  const clusters = clusterOrangePixels(orangePixels, width, height);

  for (const cluster of clusters) {
    // Check if cluster has circular characteristics
    const circularity = calculateCircularity(cluster);
    const size = cluster.length;

    // Filter by size and circularity
    if (size > 20 && size < 2000 && circularity > 0.6) {
      const bbox = calculateBoundingBox(cluster);
      const confidence = calculateBallConfidence(cluster, circularity, tracker);

      if (confidence > 0.3) {
        detections.push({
          bbox,
          confidence,
          trajectory: tracker.lastPosition
            ? {
              x: bbox[0] + bbox[2] / 2,
              y: bbox[1] + bbox[3] / 2,
              velocity: tracker.velocity
                ? Math.sqrt(tracker.velocity.x ** 2 + tracker.velocity.y ** 2)
                : 0,
            }
            : undefined,
        });
      }
    }
  }

  return detections;
}

function rgbToHsv(
  r: number,
  g: number,
  b: number
): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff) % 6;
    } else if (max === g) {
      h = (b - r) / diff + 2;
    } else {
      h = (r - g) / diff + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : Math.round((diff / max) * 255);
  const v = Math.round(max * 255);

  return { h, s, v };
}

function isInOrangeRange(
  hsv: { h: number; s: number; v: number },
  range: any
): boolean {
  return (
    hsv.h >= range.hMin &&
    hsv.h <= range.hMax &&
    hsv.s >= range.sMin &&
    hsv.s <= range.sMax &&
    hsv.v >= range.vMin &&
    hsv.v <= range.vMax
  );
}

function clusterOrangePixels(
  pixels: { x: number; y: number }[],
  width: number,
  height: number
): { x: number; y: number }[][] {
  const clusters: { x: number; y: number }[][] = [];
  const visited = new Set<string>();
  const maxDistance = 30; // Maximum distance between pixels in same cluster
  const maxClusters = 20; // Limit number of clusters to prevent hanging
  const maxIterations = 10000; // Prevent infinite loops

  let iterations = 0;

  for (const pixel of pixels) {
    if (clusters.length >= maxClusters) break;

    const key = `${pixel.x},${pixel.y}`;
    if (visited.has(key)) continue;

    const cluster: { x: number; y: number }[] = [];
    const queue = [pixel];
    visited.add(key);

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = queue.shift()!;
      cluster.push(current);

      // Check neighboring pixels
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          const neighborKey = `${nx},${ny}`;

          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            !visited.has(neighborKey) &&
            pixels.some((p) => p.x === nx && p.y === ny)
          ) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= maxDistance) {
              visited.add(neighborKey);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }
    }

    if (cluster.length > 10) {
      // Minimum cluster size
      clusters.push(cluster);
    }
  }

  return clusters;
}

function calculateCircularity(cluster: { x: number; y: number }[]): number {
  if (cluster.length < 3) return 0;

  // Calculate centroid
  const centroid = {
    x: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
    y: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length,
  };

  // Calculate average distance from centroid
  const avgDistance =
    cluster.reduce((sum, p) => {
      const dist = Math.sqrt((p.x - centroid.x) ** 2 + (p.y - centroid.y) ** 2);
      return sum + dist;
    }, 0) / cluster.length;

  // Calculate variance in distance (lower variance = more circular)
  const variance =
    cluster.reduce((sum, p) => {
      const dist = Math.sqrt((p.x - centroid.x) ** 2 + (p.y - centroid.y) ** 2);
      return sum + (dist - avgDistance) ** 2;
    }, 0) / cluster.length;

  // Circularity is inverse of coefficient of variation
  return avgDistance > 0
    ? Math.max(0, 1 - Math.sqrt(variance) / avgDistance)
    : 0;
}

function calculateBoundingBox(
  cluster: { x: number; y: number }[]
): [number, number, number, number] {
  const xs = cluster.map((p) => p.x);
  const ys = cluster.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return [minX, minY, maxX - minX, maxY - minY];
}

function calculateBallConfidence(
  cluster: { x: number; y: number }[],
  circularity: number,
  tracker: BallTracker
): number {
  let confidence = circularity * 0.6; // Base confidence from circularity

  // Size factor (prefer medium-sized objects)
  const size = cluster.length;
  const sizeFactor = Math.max(0, 1 - Math.abs(size - 100) / 100);
  confidence += sizeFactor * 0.2;

  // Motion consistency factor
  if (tracker.lastPosition) {
    const currentCenter = {
      x: cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length,
      y: cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length,
    };

    const expectedPosition = {
      x: tracker.lastPosition.x + (tracker.velocity?.x || 0),
      y: tracker.lastPosition.y + (tracker.velocity?.y || 0),
    };

    const distance = Math.sqrt(
      (currentCenter.x - expectedPosition.x) ** 2 +
      (currentCenter.y - expectedPosition.y) ** 2
    );

    const motionFactor = Math.max(0, 1 - distance / 50); // Within 50 pixels
    confidence += motionFactor * 0.2;
  }

  return Math.min(1, confidence);
}

class BallTracker {
  detections: BallDetection[] = [];
  lastPosition: { x: number; y: number } | null = null;
  velocity: { x: number; y: number } | null = null;

  updateDetections(detections: BallDetection[], timestamp: number) {
    this.detections = detections;

    if (detections.length > 0) {
      const bestDetection = detections.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      const currentPosition = {
        x: bestDetection.bbox[0] + bestDetection.bbox[2] / 2,
        y: bestDetection.bbox[1] + bestDetection.bbox[3] / 2,
      };

      if (this.lastPosition) {
        this.velocity = {
          x: currentPosition.x - this.lastPosition.x,
          y: currentPosition.y - this.lastPosition.y,
        };
      }

      this.lastPosition = currentPosition;
    }
  }
}
