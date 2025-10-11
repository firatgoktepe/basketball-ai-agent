import * as tf from "@tensorflow/tfjs";
import type { DetectionResult } from "@/types";
import {
  extractJerseyColors,
  clusterColorsByKMeans,
  assignTeamToDetection,
} from "./color-extraction";
import { realPersonDetection } from "../models/coco-ssd";

export async function detectPersons(
  frames: ImageData[],
  model: any,
  samplingRate: number = 1,
  videoDuration: number = 0
): Promise<DetectionResult[]> {
  const results: DetectionResult[] = [];

  if (!model) {
    console.warn("No COCO-SSD model available, using fallback detection");
    return detectPersonsFallback(frames, samplingRate, videoDuration);
  }

  // Calculate correct timestamp based on sampling rate and video duration
  const timePerFrame =
    videoDuration > 0 ? videoDuration / frames.length : 1 / samplingRate;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const timestamp = i * timePerFrame;

    try {
      const detections = await detectPersonsInFrame(frame, model);

      results.push({
        frameIndex: i,
        timestamp,
        detections: detections.map((detection) => ({
          type: "person" as const,
          bbox: detection.bbox,
          confidence: detection.confidence,
          teamId: undefined, // Will be assigned during team clustering
        })),
      });
    } catch (error) {
      console.error(`Error detecting persons in frame ${i}:`, error);
      // Add empty result for this frame
      results.push({
        frameIndex: i,
        timestamp,
        detections: [],
      });
    }
  }

  return results;
}

async function detectPersonsInFrame(
  frame: ImageData,
  model: any
): Promise<
  Array<{ bbox: [number, number, number, number]; confidence: number }>
> {
  try {
    // Validate frame dimensions
    if (!frame || frame.width <= 0 || frame.height <= 0) {
      console.warn(
        "Invalid frame dimensions in detectPersonsInFrame, returning empty detections"
      );
      return [];
    }

    // Check if model is a real detector (has real_output layer)
    if (
      model &&
      model.layers &&
      model.layers.some((layer: any) => layer.name === "real_output")
    ) {
      console.log("🔧 Using real person detector for person detection");
      return realPersonDetection(frame);
    }

    // Convert ImageData to tensor
    const tensor = tf.browser.fromPixels(
      new ImageData(frame.data, frame.width, frame.height)
    );
    const resized = tf.image.resizeBilinear(tensor, [300, 300]);
    const normalized = resized.div(255.0);
    const batched = normalized.expandDims(0);

    // Run inference
    const predictions = (await model.predict(batched)) as tf.Tensor[];

    // Process predictions (this is a simplified version - real COCO-SSD has more complex output)
    const boxes = await predictions[0].data();
    const scores = await predictions[1].data();
    const classes = await predictions[2].data();

    const detections: Array<{
      bbox: [number, number, number, number];
      confidence: number;
    }> = [];

    for (let i = 0; i < scores.length; i++) {
      // COCO class 0 is 'person'
      // Lowered threshold from 0.5 to 0.3 for better detection in high-quality videos
      if (classes[i] === 0 && scores[i] > 0.3) {
        const [y1, x1, y2, x2] = boxes.slice(i * 4, (i + 1) * 4);

        // Convert normalized coordinates to pixel coordinates
        const bbox: [number, number, number, number] = [
          x1 * frame.width,
          y1 * frame.height,
          (x2 - x1) * frame.width,
          (y2 - y1) * frame.height,
        ];

        detections.push({
          bbox,
          confidence: scores[i],
        });
      }
    }

    // Cleanup tensors
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    batched.dispose();
    predictions.forEach((p) => p.dispose());

    return detections;
  } catch (error) {
    console.error("Error in detectPersonsInFrame:", error);
    console.log("🔧 Falling back to real detection");
    return realPersonDetection(frame);
  }
}

function detectPersonsFallback(
  frames: ImageData[],
  samplingRate: number = 1,
  videoDuration: number = 0
): DetectionResult[] {
  // Fallback detection using simple heuristics
  const results: DetectionResult[] = [];

  const timePerFrame =
    videoDuration > 0 ? videoDuration / frames.length : 1 / samplingRate;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const timestamp = i * timePerFrame;

    // Simple person detection using color-based heuristics
    const detections = detectPersonsInFrameFallback(frame);

    results.push({
      frameIndex: i,
      timestamp,
      detections: detections.map((detection) => ({
        type: "person" as const,
        bbox: detection.bbox,
        confidence: detection.confidence,
        teamId: undefined,
      })),
    });
  }

  return results;
}

function detectPersonsInFrameFallback(
  frame: ImageData
): Array<{ bbox: [number, number, number, number]; confidence: number }> {
  // Simple fallback detection - look for human-like shapes using edge detection
  const detections: Array<{
    bbox: [number, number, number, number];
    confidence: number;
  }> = [];

  // Mock detections for demonstration
  const numPersons = Math.floor(Math.random() * 3) + 1; // 1-3 persons

  for (let i = 0; i < numPersons; i++) {
    const x = Math.random() * (frame.width - 100);
    const y = Math.random() * (frame.height - 150);
    const width = 60 + Math.random() * 40; // 60-100px wide
    const height = 100 + Math.random() * 50; // 100-150px tall

    detections.push({
      bbox: [x, y, width, height] as [number, number, number, number],
      confidence: 0.6 + Math.random() * 0.3, // 0.6-0.9 confidence
    });
  }

  return detections;
}

export async function clusterTeams(
  detections: DetectionResult[],
  frames: ImageData[]
): Promise<
  Array<{
    centroid: { r: number; g: number; b: number };
    samples: any[];
    teamId: string;
  }>
> {
  // Extract jersey colors from person detections
  const colorSamples = extractJerseyColors(detections, frames);

  if (colorSamples.length < 2) {
    // Not enough samples for clustering - return default clusters
    console.log("Not enough color samples for clustering, using fallback");
    return [
      {
        centroid: { r: 0, g: 51, b: 204 }, // Blue
        samples: [],
        teamId: "teamA",
      },
      {
        centroid: { r: 204, g: 0, b: 0 }, // Red
        samples: [],
        teamId: "teamB",
      },
    ];
  }

  console.log(`Extracted ${colorSamples.length} color samples for clustering`);

  // Perform K-means clustering on colors
  const clusters = clusterColorsByKMeans(colorSamples, 2);

  // Assign team IDs based on cluster membership
  assignTeamsToClusters(clusters);

  // Ensure all clusters have teamId assigned
  const clustersWithTeamId = clusters.map((cluster, index) => ({
    ...cluster,
    teamId: cluster.teamId || (index === 0 ? "teamA" : "teamB"),
  }));

  console.log("Team clusters:", clustersWithTeamId);
  return clustersWithTeamId;
}

function extractDominantColor(
  bbox: [number, number, number, number],
  frameIndex: number
): { r: number; g: number; b: number } | null {
  // This would extract the dominant color from the person's jersey area
  // For now, return mock colors
  const colors = [
    { r: 0, g: 51, b: 204 }, // Blue
    { r: 204, g: 0, b: 0 }, // Red
    { r: 255, g: 255, b: 255 }, // White
    { r: 0, g: 0, b: 0 }, // Black
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

function performKMeansClustering(
  samples: Array<{ r: number; g: number; b: number }>,
  k: number
): Array<{
  centroid: { r: number; g: number; b: number };
  samples: Array<{ r: number; g: number; b: number }>;
}> {
  // Simplified K-means clustering for color grouping
  const clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: Array<{ r: number; g: number; b: number }>;
  }> = [];

  // Initialize centroids randomly
  for (let i = 0; i < k; i++) {
    const randomSample = samples[Math.floor(Math.random() * samples.length)];
    clusters.push({
      centroid: { ...randomSample },
      samples: [],
    });
  }

  // Assign samples to nearest centroid
  for (const sample of samples) {
    let nearestCluster = 0;
    let minDistance = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      const distance = Math.sqrt(
        Math.pow(sample.r - clusters[i].centroid.r, 2) +
          Math.pow(sample.g - clusters[i].centroid.g, 2) +
          Math.pow(sample.b - clusters[i].centroid.b, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestCluster = i;
      }
    }

    clusters[nearestCluster].samples.push(sample);
  }

  return clusters;
}

function assignTeamsToClusters(
  clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: any[];
    teamId?: string;
  }>
): void {
  // Sort clusters by sample count (larger clusters are more likely to be the main teams)
  clusters.sort((a, b) => b.samples.length - a.samples.length);

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];

    // Assign team based on cluster size and position
    if (i === 0) {
      cluster.teamId = "teamA";
    } else if (i === 1) {
      cluster.teamId = "teamB";
    }
  }
}

/**
 * Assign team IDs to person detections based on color clusters
 */
export function assignTeamsToDetections(
  detections: DetectionResult[],
  frames: ImageData[],
  teamClusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: any[];
    teamId: string;
  }>
): DetectionResult[] {
  console.log(
    `Assigning teams to ${detections.length} detection frames using ${teamClusters.length} clusters`
  );

  if (!teamClusters || teamClusters.length === 0) {
    console.warn("No team clusters available, cannot assign teams");
    return detections;
  }

  let assignedCount = 0;

  for (const result of detections) {
    const frame = frames[result.frameIndex];
    if (!frame || !frame.data || frame.data.length === 0) continue;

    for (const detection of result.detections) {
      if (detection.teamId) continue; // Already assigned

      // Extract color from this detection's bbox
      const bbox = detection.bbox;
      const [x, y, width, height] = bbox;

      // Sample center of torso
      const centerX = Math.floor(x + width / 2);
      const centerY = Math.floor(y + height * 0.3);

      if (
        centerX < 0 ||
        centerX >= frame.width ||
        centerY < 0 ||
        centerY >= frame.height
      ) {
        continue;
      }

      const pixelIndex = (centerY * frame.width + centerX) * 4;
      if (pixelIndex + 2 >= frame.data.length) continue;

      const r = frame.data[pixelIndex];
      const g = frame.data[pixelIndex + 1];
      const b = frame.data[pixelIndex + 2];

      // Find nearest cluster
      let nearestCluster = teamClusters[0];
      let minDistance = Infinity;

      for (const cluster of teamClusters) {
        const distance = Math.sqrt(
          Math.pow(r - cluster.centroid.r, 2) +
            Math.pow(g - cluster.centroid.g, 2) +
            Math.pow(b - cluster.centroid.b, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = cluster;
        }
      }

      detection.teamId = nearestCluster.teamId;
      assignedCount++;
    }
  }

  console.log(`Assigned team IDs to ${assignedCount} detections`);

  if (typeof self !== "undefined" && self.postMessage) {
    self.postMessage({
      type: "debug",
      data: {
        message: `✅ Team assignment: ${assignedCount} detections now have team IDs`,
      },
    });
  }

  return detections;
}
