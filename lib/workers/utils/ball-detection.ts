import type { DetectionResult } from "@/types";
import type {
  ONNXBallDetector,
  BallDetectionResult,
} from "../models/onnx-ball-detection";

/**
 * Ball Detection System - PERFORMANCE OPTIMIZED
 *
 * Optimizations implemented:
 * 1. Frame skipping: Process every 2nd frame (50% reduction)
 * 2. Resolution downsampling: 50% resolution for HD videos (75% pixel reduction)
 * 3. Region of Interest: Focus on middle 70% of frame (skip edges)
 * 4. Adaptive pixel sampling: 6px step for HD, 4px for SD (was 4px/2px)
 * 5. Early termination: Stop when high-confidence ball found
 * 6. Optimized clustering: Spatial hashing, reduced neighbor search
 * 7. Sampled circularity: Max 200 samples for large clusters
 * 8. Reduced limits: 3000 max pixels (was 5000), 15 max clusters (was 20)
 *
 * Expected speedup: 4-6x faster on HD videos while maintaining accuracy
 */

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

  // PERFORMANCE OPTIMIZATION: Process fewer frames for ball detection
  // Ball detection is the slowest step - we can skip frames without losing much accuracy
  const frameStep = 2; // Process every 2nd frame (50% reduction in processing time)
  const framesToProcess = Math.ceil(frames.length / frameStep);

  console.log(
    `[Ball Detection] ========== BALL DETECTION START ==========`
  );
  console.log(
    `[Ball Detection] Total frames: ${frames.length}, Processing: ${framesToProcess} (every ${frameStep} frames)`
  );
  console.log(
    `[Ball Detection] Detection method: ${onnxDetector ? 'ONNX Model' : 'HSV Color-Based'}`
  );
  console.log(
    `[Ball Detection] Frame dimensions: ${frames[0]?.width || 'unknown'}x${frames[0]?.height || 'unknown'}`
  );

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Ball Detection: ${onnxDetector ? 'Using ONNX model' : 'Using HSV color detection (orange)'}, processing ${framesToProcess} frames`,
      },
    });
  }

  const timePerFrame =
    videoDuration > 0 ? videoDuration / frames.length : 1 / samplingRate;

  for (let i = 0; i < frames.length; i += frameStep) {
    const frame = frames[i];
    const timestamp = i * timePerFrame;

    // Log progress every 5 processed frames
    if ((i / frameStep) % 5 === 0) {
      const processed = Math.floor(i / frameStep);
      console.log(
        `[Ball Detection] Processing frame ${processed}/${framesToProcess} (${Math.round(
          (processed / framesToProcess) * 100
        )}%)`
      );
    }

    // Validate frame
    if (
      !frame ||
      frame.width <= 0 ||
      frame.height <= 0 ||
      !frame.data ||
      frame.data.length === 0
    ) {
      results.push({
        frameIndex: i,
        timestamp,
        detections: [],
      });
      continue;
    }

    // PERFORMANCE OPTIMIZATION: Downsample large frames for faster processing
    // Ball detection doesn't need full resolution
    const processFrame =
      frame.width > 960 ? downsampleFrame(frame, 0.5) : frame;
    const scaleFactor = frame.width > 960 ? 2.0 : 1.0; // Scale bboxes back up

    let ballDetections: BallDetection[] = [];

    // Try ONNX detection first if available
    if (onnxDetector) {
      try {
        const onnxResults = await onnxDetector.detectBalls(processFrame);
        ballDetections = onnxResults.map((result) => ({
          bbox: [
            result.bbox[0] * scaleFactor,
            result.bbox[1] * scaleFactor,
            result.bbox[2] * scaleFactor,
            result.bbox[3] * scaleFactor,
          ] as [number, number, number, number],
          confidence: result.confidence,
          trajectory: tracker.lastPosition
            ? {
              x:
                result.bbox[0] * scaleFactor +
                (result.bbox[2] * scaleFactor) / 2,
              y:
                result.bbox[1] * scaleFactor +
                (result.bbox[3] * scaleFactor) / 2,
              velocity: tracker.velocity
                ? Math.sqrt(tracker.velocity.x ** 2 + tracker.velocity.y ** 2)
                : 0,
            }
            : undefined,
        }));
      } catch (error) {
        console.warn("ONNX ball detection failed, falling back to HSV:", error);
        // Fall back to HSV detection
        ballDetections = detectBallInFrame(processFrame, tracker);
        // Scale bboxes back to original size
        ballDetections = ballDetections.map((det) => ({
          ...det,
          bbox: [
            det.bbox[0] * scaleFactor,
            det.bbox[1] * scaleFactor,
            det.bbox[2] * scaleFactor,
            det.bbox[3] * scaleFactor,
          ] as [number, number, number, number],
        }));
      }
    } else {
      // Use HSV segmentation as fallback
      ballDetections = detectBallInFrame(processFrame, tracker);
      // Scale bboxes back to original size if downsampled
      if (scaleFactor > 1) {
        ballDetections = ballDetections.map((det) => ({
          ...det,
          bbox: [
            det.bbox[0] * scaleFactor,
            det.bbox[1] * scaleFactor,
            det.bbox[2] * scaleFactor,
            det.bbox[3] * scaleFactor,
          ] as [number, number, number, number],
        }));
      }
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

  const framesWithBall = results.filter((r) => r.detections.length > 0).length;
  const totalBalls = results.reduce((sum, r) => sum + r.detections.length, 0);

  console.log(`[Ball Detection] ========== BALL DETECTION COMPLETE ==========`);
  console.log(`[Ball Detection] Processed ${frames.length} frames`);
  console.log(`[Ball Detection] Found ball in ${framesWithBall} frames (${((framesWithBall / frames.length) * 100).toFixed(1)}%)`);
  console.log(`[Ball Detection] Total detections: ${totalBalls}`);
  console.log(`[Ball Detection] ================================================`);

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `📊 Ball Detection Complete: ${framesWithBall}/${frames.length} frames have ball (${totalBalls} total detections)`,
      },
    });
  }

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
    console.warn('[Ball Detection] Invalid frame data - skipping');
    return detections;
  }

  // Debug: Log frame info for first few frames
  const isFirstFrame = Math.random() < 0.01; // Log 1% of frames
  if (isFirstFrame) {
    console.log(`[Ball Detection] Processing frame: ${width}x${height}, data length: ${data.length}`);
  }

  // PERFORMANCE OPTIMIZATION: Focus on region of interest (middle 70% of frame)
  // Balls are rarely at the extreme edges
  const roiMargin = 0.15; // 15% margin on each side
  const xStart = Math.floor(width * roiMargin);
  const xEnd = Math.floor(width * (1 - roiMargin));
  const yStart = Math.floor(height * roiMargin);
  const yEnd = Math.floor(height * (1 - roiMargin));

  // HSV color range for basketball - EXTREMELY permissive for all lighting conditions
  // This allows detection in various lighting: indoor, outdoor, shadows, bright lights
  const orangeRange = {
    hMin: 0, // Include full red-orange-yellow spectrum
    hMax: 50, // Extended further to yellow-orange
    sMin: 20, // Very low saturation to catch washed-out balls
    sMax: 255,
    vMin: 30, // Very low brightness for dark/shadowed balls
    vMax: 255,
  };

  // Additional color ranges for different lighting conditions
  const alternativeRanges = [
    // Brown/darker basketballs (old or outdoor)
    { hMin: 10, hMax: 30, sMin: 40, sMax: 255, vMin: 40, vMax: 200 },
    // Bright/overexposed basketballs
    { hMin: 15, hMax: 40, sMin: 30, sMax: 180, vMin: 150, vMax: 255 },
  ];

  // Log HSV ranges being used (only once per batch)
  if (Math.random() < 0.01) {
    console.log(`[Ball Detection] Using HSV ranges:`, {
      primary: orangeRange,
      alternatives: alternativeRanges.length,
    });
  }

  // Convert RGB to HSV and find orange regions
  const orangePixels: { x: number; y: number }[] = [];

  // Debug: Sample colors for diagnostics
  const colorSamples: any[] = [];
  const sampleInterval = Math.floor((yEnd - yStart) / 10); // Sample 10 points

  // PERFORMANCE: Increase sampling step - check fewer pixels
  const step = width > 1000 ? 6 : 4; // Sample every 6th pixel for HD (was 4), 4th for smaller (was 2)

  for (let y = yStart; y < yEnd; y += step) {
    for (let x = xStart; x < xEnd; x += step) {
      const index = (y * width + x) * 4;

      // Bounds check
      if (index + 2 >= data.length) {
        continue;
      }

      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      const hsv = rgbToHsv(r, g, b);

      // Sample colors for debugging (every N rows)
      if (colorSamples.length < 20 && y % sampleInterval === 0 && x % sampleInterval === 0) {
        colorSamples.push({ r, g, b, h: hsv.h, s: hsv.s, v: hsv.v });
      }

      // Check primary orange range and alternative ranges
      let matchedRange = false;
      if (isInOrangeRange(hsv, orangeRange)) {
        matchedRange = true;
      } else {
        // Try alternative ranges
        for (const altRange of alternativeRanges) {
          if (isInOrangeRange(hsv, altRange)) {
            matchedRange = true;
            break;
          }
        }
      }

      if (matchedRange) {
        orangePixels.push({ x, y });

        // PERFORMANCE: Lower limit to stop early
        if (orangePixels.length > 3000) {
          // Reduced from 5000
          break;
        }
      }
    }

    // Break outer loop if we hit the limit
    if (orangePixels.length > 3000) {
      break;
    }
  }

  // Check if we hit the limit - this means TOO MUCH orange (court, jerseys, etc.)
  if (orangePixels.length >= 3000) {
    console.warn(`[Ball Detection] ⚠️ Hit 3000 pixel limit - too much orange detected (likely court/jerseys)`);
    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message: `⚠️ Too much orange detected (${orangePixels.length} pixels) - likely background/jerseys. Filtering for concentrated regions...`,
        },
      });
    }

    // Filter to only keep pixels in densest regions
    orangePixels.length = 0; // Clear and rebuild with stricter filtering

    // Use much stricter HSV ranges when we have too much orange
    const strictRange = {
      hMin: 10,
      hMax: 30,
      sMin: 80,  // Much higher saturation
      sMax: 255,
      vMin: 100, // Higher brightness
      vMax: 255,
    };

    for (let y = yStart; y < yEnd; y += step) {
      for (let x = xStart; x < xEnd; x += step) {
        const index = (y * width + x) * 4;
        if (index + 2 >= data.length) continue;

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const hsv = rgbToHsv(r, g, b);

        if (isInOrangeRange(hsv, strictRange)) {
          orangePixels.push({ x, y });
          if (orangePixels.length > 500) break; // Much lower limit
        }
      }
      if (orangePixels.length > 500) break;
    }

    console.log(`[Ball Detection] After strict filtering: ${orangePixels.length} orange pixels`);
  }

  // ALWAYS log this for debugging - use postMessage to ensure it appears
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔍 Ball Frame Analysis: Found ${orangePixels.length} orange pixels (${orangePixels.length >= 3000 ? 'FILTERED' : 'good'})`,
      },
    });
  }

  // Log color samples for first frame to help debug
  if (colorSamples.length > 0 && orangePixels.length > 0 && orangePixels.length < 1000) {
    console.log(`[Ball Detection] Color samples:`, colorSamples.slice(0, 3));
    console.log(`[Ball Detection] Found ${orangePixels.length} orange pixels in ${width}x${height} frame`);
  }

  // PERFORMANCE: Early exit if too few orange pixels
  // Further lowered threshold from 8 to 5 for maximum sensitivity
  if (orangePixels.length < 5) {
    if (orangePixels.length > 0) {
      console.log(`[Ball Detection] Only ${orangePixels.length} orange pixels found (min: 5) - frame likely has no ball`);
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `⚠️ Frame has ${orangePixels.length} orange pixels (need 5+)`,
          },
        });
      }
    }
    return detections; // Not enough orange pixels to form a ball
  }

  // Log if we found orange pixels
  console.log(`[Ball Detection] ✅ Found ${orangePixels.length} orange pixels - clustering...`);
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `✅ Found ${orangePixels.length} orange pixels - attempting clustering`,
      },
    });
  }

  // Cluster orange pixels into potential ball regions
  const clusters = clusterOrangePixels(orangePixels, width, height);

  console.log(`[Ball Detection] Clustering produced ${clusters.length} clusters from ${orangePixels.length} pixels`);
  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔧 Clustering: ${clusters.length} clusters from ${orangePixels.length} pixels`,
      },
    });
  }

  // PERFORMANCE: Early exit if no clusters
  if (clusters.length === 0) {
    console.log(`[Ball Detection] ⚠️ No clusters formed from ${orangePixels.length} orange pixels`);
    return detections;
  }

  for (const cluster of clusters) {
    // PERFORMANCE: Quick size filter before expensive circularity check
    const size = cluster.length;

    // Further lowered minimum size from 20 to 10
    if (size < 10 || size > 2000) {
      if (size < 10) {
        console.log(`[Ball Detection] Cluster too small: ${size} pixels (min: 10)`);
      }
      continue;
    }

    // Check if cluster has circular characteristics
    const circularity = calculateCircularity(cluster);

    // Log every cluster analysis
    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message: `🔍 Cluster #${clusters.length + 1}: size=${size}, circularity=${circularity.toFixed(3)}`,
        },
      });
    }

    // Filter by circularity - EXTREMELY lenient threshold for real-world basketballs
    if (circularity > 0.28) {
      // Lowered from 0.35 to accept slightly irregular shapes (shadows, sampling artifacts)
      const bbox = calculateBoundingBox(cluster);
      const confidence = calculateBallConfidence(cluster, circularity, tracker);

      console.log(`[Ball Detection] Circular cluster: size=${size}, circularity=${circularity.toFixed(3)}, confidence=${confidence.toFixed(3)}`);

      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `🎯 Circular cluster: confidence=${confidence.toFixed(3)} (need > 0.20)`,
          },
        });
      }

      // Lowered confidence threshold from 0.25 to 0.20
      if (confidence > 0.20) {
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

        console.log(`[Ball Detection] ✅ Ball candidate ACCEPTED: confidence=${confidence.toFixed(3)}, circularity=${circularity.toFixed(3)}, size=${size}`);

        if (typeof self !== "undefined" && self.postMessage) {
          self.postMessage({
            type: "debug",
            data: {
              message: `🏀 Ball detected: confidence=${confidence.toFixed(3)}, size=${size}px`,
            },
          });
        }

        // PERFORMANCE: If we found a high-confidence ball, stop looking
        if (confidence > 0.7) {
          break;
        }
      } else {
        console.log(`[Ball Detection] ❌ Cluster rejected: confidence too low (${confidence.toFixed(3)} < 0.20)`);

        if (typeof self !== "undefined" && self.postMessage) {
          self.postMessage({
            type: "debug",
            data: {
              message: `❌ Rejected: confidence ${confidence.toFixed(3)} < 0.20`,
            },
          });
        }
      }
    } else {
      console.log(`[Ball Detection] ❌ Cluster rejected: not circular enough (${circularity.toFixed(3)} < 0.28)`);

      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `❌ Rejected: circularity ${circularity.toFixed(3)} < 0.28`,
          },
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
  const maxClusters = 15; // Only keep top candidates
  const maxClusterSize = 500; // Prevent huge clusters
  const maxIterations = 10000; // Increased for better clustering

  // CRITICAL FIX: Since we sample at step=6, we need to search in a larger neighborhood
  // Otherwise, neighboring orange pixels won't be found!
  const searchRadius = 8; // Search 8 pixels in each direction (accounts for step=6)

  // Build spatial index for faster neighbor lookup
  const pixelSet = new Set(pixels.map((p) => `${p.x},${p.y}`));
  let iterations = 0;

  console.log(`[Ball Detection] Starting clustering: ${pixels.length} pixels, search radius: ${searchRadius}`);

  // Optimize: if too many pixels, use larger step in neighbor search
  const neighborStep = pixels.length > 1000 ? 2 : 1; // Skip some positions if too many pixels

  for (const pixel of pixels) {
    if (clusters.length >= maxClusters) {
      console.log(`[Ball Detection] Reached max clusters (${maxClusters}), stopping`);
      break;
    }

    if (iterations >= maxIterations) {
      console.warn(`[Ball Detection] Hit max iterations (${maxIterations}), stopping`);
      break;
    }

    const key = `${pixel.x},${pixel.y}`;
    if (visited.has(key)) continue;

    const cluster: { x: number; y: number }[] = [];
    const queue = [pixel];
    visited.add(key);

    while (
      queue.length > 0 &&
      iterations < maxIterations &&
      cluster.length < maxClusterSize
    ) {
      iterations++;
      const current = queue.shift()!;
      cluster.push(current);

      // FIXED: Search in larger neighborhood to account for pixel sampling step
      // Use optimized step to reduce search space
      for (let dy = -searchRadius; dy <= searchRadius; dy += neighborStep) {
        for (let dx = -searchRadius; dx <= searchRadius; dx += neighborStep) {
          if (dx === 0 && dy === 0) continue; // Skip self

          const nx = current.x + dx;
          const ny = current.y + dy;
          const neighborKey = `${nx},${ny}`;

          // Check distance to ensure we're within reasonable proximity
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > searchRadius) continue;

          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            !visited.has(neighborKey) &&
            pixelSet.has(neighborKey) // Fast lookup using Set
          ) {
            visited.add(neighborKey);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    // Lowered minimum cluster size from 10 to 5
    if (cluster.length >= 5 && cluster.length < maxClusterSize) {
      clusters.push(cluster);
      console.log(`[Ball Detection] ✅ Formed cluster #${clusters.length} with ${cluster.length} pixels`);

      // Log first few clusters via postMessage
      if (clusters.length <= 3 && typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `✅ Cluster #${clusters.length}: ${cluster.length} pixels`,
          },
        });
      }
    } else if (cluster.length < 5) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.1) {
        console.log(`[Ball Detection] Cluster too small: ${cluster.length} pixels (min: 5)`);
      }
    }
  }

  console.log(`[Ball Detection] Clustering complete: ${clusters.length} clusters formed from ${pixels.length} pixels (${iterations} iterations)`);

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `🔧 Clustering result: ${clusters.length} clusters from ${pixels.length} pixels`,
      },
    });
  }

  return clusters;
}

function calculateCircularity(cluster: { x: number; y: number }[]): number {
  if (cluster.length < 3) return 0;

  // PERFORMANCE: Sample cluster for large clusters instead of processing all pixels
  const sampleSize = Math.min(cluster.length, 200); // Max 200 samples
  const sampledCluster =
    cluster.length > sampleSize
      ? cluster.filter(
        (_, idx) => idx % Math.ceil(cluster.length / sampleSize) === 0
      )
      : cluster;

  // Calculate centroid
  const centroid = {
    x: sampledCluster.reduce((sum, p) => sum + p.x, 0) / sampledCluster.length,
    y: sampledCluster.reduce((sum, p) => sum + p.y, 0) / sampledCluster.length,
  };

  // Calculate average distance from centroid
  const avgDistance =
    sampledCluster.reduce((sum, p) => {
      const dist = Math.sqrt((p.x - centroid.x) ** 2 + (p.y - centroid.y) ** 2);
      return sum + dist;
    }, 0) / sampledCluster.length;

  // Calculate variance in distance (lower variance = more circular)
  const variance =
    sampledCluster.reduce((sum, p) => {
      const dist = Math.sqrt((p.x - centroid.x) ** 2 + (p.y - centroid.y) ** 2);
      return sum + (dist - avgDistance) ** 2;
    }, 0) / sampledCluster.length;

  // Circularity is inverse of coefficient of variation
  return avgDistance > 0
    ? Math.max(0, 1 - Math.sqrt(variance) / avgDistance)
    : 0;
}

function calculateBoundingBox(
  cluster: { x: number; y: number }[]
): [number, number, number, number] {
  // PERFORMANCE: Single pass to find min/max instead of multiple array operations
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  for (const p of cluster) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

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

/**
 * Downsample frame for faster processing
 * PERFORMANCE OPTIMIZATION: Reduces pixel count by scale factor
 */
function downsampleFrame(frame: ImageData, scale: number = 0.5): ImageData {
  const newWidth = Math.floor(frame.width * scale);
  const newHeight = Math.floor(frame.height * scale);
  const newData = new Uint8ClampedArray(newWidth * newHeight * 4);

  // Simple nearest-neighbor downsampling
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const srcIndex = (srcY * frame.width + srcX) * 4;
      const dstIndex = (y * newWidth + x) * 4;

      newData[dstIndex] = frame.data[srcIndex];
      newData[dstIndex + 1] = frame.data[srcIndex + 1];
      newData[dstIndex + 2] = frame.data[srcIndex + 2];
      newData[dstIndex + 3] = frame.data[srcIndex + 3];
    }
  }

  return new ImageData(newData, newWidth, newHeight);
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
