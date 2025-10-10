import type { DetectionResult } from "@/types";

export interface ColorSample {
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  v: number;
  frameIndex: number;
  bbox: [number, number, number, number];
}

export function extractJerseyColors(
  detections: DetectionResult[],
  frames: ImageData[]
): ColorSample[] {
  const colorSamples: ColorSample[] = [];

  console.log(
    `🔍 Extracting jersey colors from ${detections.length} detection frames`
  );

  // Limit processing to avoid hanging on large datasets
  const maxFramesToProcess = Math.min(detections.length, 30);
  console.log(
    `📊 Processing first ${maxFramesToProcess} frames for color extraction`
  );

  for (let i = 0; i < maxFramesToProcess; i++) {
    const result = detections[i];
    const frame = frames[result.frameIndex];

    if (!frame) {
      console.warn(`⚠️ Frame ${result.frameIndex} not found`);
      continue;
    }

    // Validate frame data
    if (!frame.data || frame.width <= 0 || frame.height <= 0) {
      console.warn(`⚠️ Invalid frame data at index ${result.frameIndex}`);
      continue;
    }

    if (i % 10 === 0) {
      console.log(`🔍 Processing frame ${i}/${maxFramesToProcess}...`);
    }

    for (const detection of result.detections) {
      try {
        const colors = extractColorsFromBbox(frame, detection.bbox);
        colorSamples.push(
          ...colors.map((color) => ({
            ...color,
            frameIndex: result.frameIndex,
            bbox: detection.bbox,
          }))
        );
      } catch (error) {
        console.error(`Error extracting colors from bbox:`, error);
      }
    }
  }

  console.log(`📊 Total color samples extracted: ${colorSamples.length}`);
  if (colorSamples.length === 0) {
    console.warn("⚠️ No color samples extracted - team clustering will fail");
  }

  return colorSamples;
}

function extractColorsFromBbox(
  frame: ImageData,
  bbox: [number, number, number, number]
): Array<{ r: number; g: number; b: number; h: number; s: number; v: number }> {
  const [x, y, width, height] = bbox;
  const colors: Array<{
    r: number;
    g: number;
    b: number;
    h: number;
    s: number;
    v: number;
  }> = [];

  // Validate frame data is accessible
  if (!frame.data || frame.data.length === 0) {
    console.error("Frame data is empty or detached");
    return colors;
  }

  // Focus on the torso area (upper 60% of the person)
  const torsoHeight = Math.floor(height * 0.6);
  const torsoY = y;

  // Sample colors from the torso area
  const step = Math.max(1, Math.floor(width / 10)); // Sample every 10th pixel horizontally

  for (let dy = 0; dy < torsoHeight; dy += step) {
    for (let dx = 0; dx < width; dx += step) {
      const pixelX = Math.floor(x + dx);
      const pixelY = Math.floor(torsoY + dy);

      if (
        pixelX >= 0 &&
        pixelX < frame.width &&
        pixelY >= 0 &&
        pixelY < frame.height
      ) {
        const pixelIndex = (pixelY * frame.width + pixelX) * 4;

        // Check if index is within bounds
        if (pixelIndex + 3 >= frame.data.length) {
          continue;
        }

        const r = frame.data[pixelIndex];
        const g = frame.data[pixelIndex + 1];
        const b = frame.data[pixelIndex + 2];
        const a = frame.data[pixelIndex + 3];

        // Skip transparent or very dark pixels
        if (a < 128 || r + g + b < 30) continue;

        const { h, s, v } = rgbToHsv(r, g, b);

        // Filter out skin tones and background colors
        if (isJerseyColor(r, g, b, h, s, v)) {
          colors.push({ r, g, b, h, s, v });
        }
      }
    }
  }

  return colors;
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

  const s = max === 0 ? 0 : diff / max;
  const v = max;

  return { h, s, v };
}

function isJerseyColor(
  r: number,
  g: number,
  b: number,
  h: number,
  s: number,
  v: number
): boolean {
  // Filter out skin tones (hue around 0-30 and 330-360, low saturation)
  if (s < 0.3 && ((h >= 0 && h <= 30) || (h >= 330 && h <= 360))) {
    return false;
  }

  // Filter out very dark or very light colors
  if (v < 0.2 || v > 0.95) {
    return false;
  }

  // Filter out grayscale colors (low saturation)
  if (s < 0.1) {
    return false;
  }

  // Prefer saturated colors typical of sports jerseys
  return s > 0.2;
}

export function clusterColorsByKMeans(
  colorSamples: ColorSample[],
  k: number = 2
): Array<{
  centroid: { r: number; g: number; b: number };
  samples: ColorSample[];
  teamId?: string;
}> {
  if (colorSamples.length < k) {
    return [];
  }

  const clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: ColorSample[];
    teamId?: string;
  }> = [];

  // Initialize centroids with random samples
  for (let i = 0; i < k; i++) {
    const randomSample =
      colorSamples[Math.floor(Math.random() * colorSamples.length)];
    clusters.push({
      centroid: { r: randomSample.r, g: randomSample.g, b: randomSample.b },
      samples: [],
    });
  }

  // Perform K-means iterations
  for (let iteration = 0; iteration < 10; iteration++) {
    // Clear samples
    clusters.forEach((cluster) => (cluster.samples = []));

    // Assign samples to nearest centroid
    for (const sample of colorSamples) {
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

    // Update centroids
    for (const cluster of clusters) {
      if (cluster.samples.length > 0) {
        cluster.centroid.r =
          cluster.samples.reduce((sum, s) => sum + s.r, 0) /
          cluster.samples.length;
        cluster.centroid.g =
          cluster.samples.reduce((sum, s) => sum + s.g, 0) /
          cluster.samples.length;
        cluster.centroid.b =
          cluster.samples.reduce((sum, s) => sum + s.b, 0) /
          cluster.samples.length;
      }
    }
  }

  // Assign team IDs based on color characteristics
  assignTeamIds(clusters);

  return clusters;
}

function assignTeamIds(
  clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: ColorSample[];
    teamId?: string;
  }>
): void {
  // Sort clusters by sample count (larger clusters are more likely to be the main teams)
  clusters.sort((a, b) => b.samples.length - a.samples.length);

  console.log(`🎯 Assigning team IDs to ${clusters.length} clusters`);

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const { r, g, b } = cluster.centroid;
    const { h, s, v } = rgbToHsv(r, g, b);

    console.log(
      `Cluster ${i}: RGB(${Math.round(r)}, ${Math.round(g)}, ${Math.round(
        b
      )}) HSV(${h.toFixed(1)}, ${s.toFixed(2)}, ${v.toFixed(2)}) - ${
        cluster.samples.length
      } samples`
    );

    // Assign team based on color characteristics
    if (i === 0) {
      cluster.teamId = "teamA";
    } else if (i === 1) {
      cluster.teamId = "teamB";
    }
  }

  // Check if clusters are too similar and force different colors
  if (clusters.length >= 2) {
    const cluster1 = clusters[0];
    const cluster2 = clusters[1];
    const distance = Math.sqrt(
      Math.pow(cluster1.centroid.r - cluster2.centroid.r, 2) +
        Math.pow(cluster1.centroid.g - cluster2.centroid.g, 2) +
        Math.pow(cluster1.centroid.b - cluster2.centroid.b, 2)
    );

    console.log(`📏 Color distance between clusters: ${distance.toFixed(1)}`);

    if (distance < 50) {
      // Colors are too similar
      console.warn("⚠️ Team colors are too similar - forcing different colors");
      // Force one team to be more blue, another more red
      if (cluster1.centroid.b > cluster1.centroid.r) {
        cluster1.centroid.r = Math.max(0, cluster1.centroid.r - 50);
        cluster1.centroid.b = Math.min(255, cluster1.centroid.b + 50);
      } else {
        cluster1.centroid.r = Math.min(255, cluster1.centroid.r + 50);
        cluster1.centroid.b = Math.max(0, cluster1.centroid.b - 50);
      }

      if (cluster2.centroid.r > cluster2.centroid.b) {
        cluster2.centroid.r = Math.max(0, cluster2.centroid.r - 50);
        cluster2.centroid.b = Math.min(255, cluster2.centroid.b + 50);
      } else {
        cluster2.centroid.r = Math.min(255, cluster2.centroid.r + 50);
        cluster2.centroid.b = Math.max(0, cluster2.centroid.b - 50);
      }
    }
  }
}

export function assignTeamToDetection(
  detection: any,
  colorSamples: ColorSample[],
  clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: ColorSample[];
    teamId?: string;
  }>
): string | undefined {
  // Find the most similar cluster for this detection
  // This is a simplified version - in reality, you'd analyze the actual colors in the detection

  if (clusters.length === 0) return undefined;

  // For now, assign based on detection position (left vs right side of court)
  const [x, y, width, height] = detection.bbox;
  const centerX = x + width / 2;

  // Simple heuristic: left side = teamA, right side = teamB
  // In a real implementation, you'd analyze the actual jersey colors
  return centerX < 400 ? "teamA" : "teamB";
}
