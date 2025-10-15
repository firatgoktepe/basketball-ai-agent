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
  // Filter out skin tones (hue around 0-50 and 320-360 with low saturation)
  if (s < 0.3 && ((h >= 0 && h <= 50) || (h >= 320 && h <= 360))) {
    return false;
  }

  // Filter out very dark colors (but keep darker jerseys)
  if (v < 0.15) {
    return false;
  }

  // Filter out very light/white colors (but keep light jerseys)
  if (v > 0.98 && s < 0.1) {
    return false;
  }

  // Filter out pure grayscale colors (very low saturation)
  if (s < 0.08) {
    return false;
  }

  // Accept colors with some saturation (typical of sports jerseys)
  // Lower threshold to include more jersey colors
  return s > 0.15 || (v < 0.3 || v > 0.7); // Also accept very dark or very light if saturated
}

export function clusterColorsByKMeans(
  colorSamples: ColorSample[],
  k: number = 2
): Array<{
  centroid: { r: number; g: number; b: number };
  samples: ColorSample[];
  teamId?: string;
}> {
  console.log(`🎨 Starting K-means clustering with ${colorSamples.length} color samples, k=${k}`);
  
  if (colorSamples.length < k) {
    // Not enough samples to form clusters, return a single cluster if possible
    console.warn(`⚠️ Not enough samples (${colorSamples.length}) for ${k} clusters`);
    if (colorSamples.length > 0) {
      const avgColor = colorSamples.reduce(
        (acc, sample) => {
          acc.r += sample.r;
          acc.g += sample.g;
          acc.b += sample.b;
          return acc;
        },
        { r: 0, g: 0, b: 0 }
      );
      return [
        {
          centroid: {
            r: avgColor.r / colorSamples.length,
            g: avgColor.g / colorSamples.length,
            b: avgColor.b / colorSamples.length,
          },
          samples: colorSamples,
          teamId: "teamA",
        },
      ];
    }
    return [];
  }

  // K-means clustering implementation
  let centroids = initializeCentroids(colorSamples, k);
  let clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: ColorSample[];
    teamId?: string;
  }> = [];

  for (let iteration = 0; iteration < 20; iteration++) {
    // Create clusters
    clusters = centroids.map((c) => ({
      centroid: c,
      samples: [],
    }));

    // Assign samples to the nearest centroid
    for (const sample of colorSamples) {
      let nearestCentroidIndex = 0;
      let minDistance = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const distance = colorDistance(sample, centroids[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCentroidIndex = i;
        }
      }
      clusters[nearestCentroidIndex].samples.push(sample);
    }

    // Recalculate centroids
    let hasChanged = false;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].samples.length > 0) {
        const newCentroid = calculateCentroid(clusters[i].samples);
        if (colorDistance(newCentroid, centroids[i]) > 1) {
          hasChanged = true;
        }
        centroids[i] = newCentroid;
      }
    }

    if (!hasChanged) break; // Converged
  }

  // Filter out empty clusters
  const validClusters = clusters.filter((c) => c.samples.length > 0);
  
  console.log(`✅ K-means converged: found ${validClusters.length} valid cluster(s)`);
  validClusters.forEach((cluster, i) => {
    const { r, g, b } = cluster.centroid;
    console.log(
      `  Cluster ${i}: RGB(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}) - ${cluster.samples.length} samples`
    );
  });

  // If only one cluster is found, return it as teamA
  if (validClusters.length === 1) {
    console.log("⚠️ Only 1 cluster found, assigning to teamA");
    validClusters[0].teamId = "teamA";
    return validClusters;
  }

  // If two clusters, check if they are distinct enough
  if (validClusters.length === 2) {
    const distance = colorDistance(
      validClusters[0].centroid,
      validClusters[1].centroid
    );
    
    console.log(
      `📏 Team color distance: ${distance.toFixed(1)} (threshold: 30 for merging)`
    );
    
    // Only merge if colors are REALLY similar (distance < 30)
    // Most basketball teams have distinct enough colors (distance > 30)
    if (distance < 30) {
      console.log(
        `⚠️ Team colors are VERY similar (distance: ${distance.toFixed(
          1
        )}). Merging into a single team.`
      );
      // Merge samples into the larger cluster
      const largerCluster =
        validClusters[0].samples.length > validClusters[1].samples.length
          ? validClusters[0]
          : validClusters[1];
      const smallerCluster =
        largerCluster === validClusters[0]
          ? validClusters[1]
          : validClusters[0];
      largerCluster.samples.push(...smallerCluster.samples);
      largerCluster.centroid = calculateCentroid(largerCluster.samples);
      largerCluster.teamId = "teamA";
      return [largerCluster];
    } else {
      console.log(
        `✅ Team colors are distinct enough (distance: ${distance.toFixed(1)}). Keeping 2 teams.`
      );
    }
  }

  // Assign team IDs
  assignTeamIds(validClusters);

  return validClusters;
}

function initializeCentroids(
  samples: ColorSample[],
  k: number
): Array<{ r: number; g: number; b: number }> {
  const centroids: Array<{ r: number; g: number; b: number }> = [];
  const initialSample = samples[Math.floor(Math.random() * samples.length)];
  centroids.push({
    r: initialSample.r,
    g: initialSample.g,
    b: initialSample.b,
  });

  while (centroids.length < k) {
    let maxDistance = -1;
    let farthestSample: ColorSample | null = null;

    for (const sample of samples) {
      let minDistanceToCentroid = Infinity;
      for (const centroid of centroids) {
        const distance = colorDistance(sample, centroid);
        if (distance < minDistanceToCentroid) {
          minDistanceToCentroid = distance;
        }
      }
      if (minDistanceToCentroid > maxDistance) {
        maxDistance = minDistanceToCentroid;
        farthestSample = sample;
      }
    }

    if (farthestSample) {
      centroids.push({
        r: farthestSample.r,
        g: farthestSample.g,
        b: farthestSample.b,
      });
    }
  }
  return centroids;
}

function calculateCentroid(
  samples: ColorSample[]
): { r: number; g: number; b: number } {
  const total = samples.reduce(
    (acc, sample) => {
      acc.r += sample.r;
      acc.g += sample.g;
      acc.b += sample.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 }
  );
  return {
    r: total.r / samples.length,
    g: total.g / samples.length,
    b: total.b / samples.length,
  };
}

function colorDistance(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
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
      )}) HSV(${h.toFixed(1)}, ${s.toFixed(2)}, ${v.toFixed(2)}) - ${cluster.samples.length
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
  frame: ImageData,
  clusters: Array<{
    centroid: { r: number; g: number; b: number };
    samples: ColorSample[];
    teamId?: string;
  }>
): string | undefined {
  if (clusters.length === 0) return undefined;

  // Extract the average color from the detection's bounding box
  const detectionColors = extractColorsFromBbox(frame, detection.bbox);
  if (detectionColors.length === 0) return undefined;

  const avgDetectionColor = detectionColors.reduce(
    (acc, color) => {
      acc.r += color.r;
      acc.g += color.g;
      acc.b += color.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 }
  );

  avgDetectionColor.r /= detectionColors.length;
  avgDetectionColor.g /= detectionColors.length;
  avgDetectionColor.b /= detectionColors.length;

  // Find the nearest cluster centroid
  let nearestClusterId: string | undefined = undefined;
  let minDistance = Infinity;

  for (const cluster of clusters) {
    if (!cluster.teamId) continue;

    const distance = Math.sqrt(
      Math.pow(avgDetectionColor.r - cluster.centroid.r, 2) +
      Math.pow(avgDetectionColor.g - cluster.centroid.g, 2) +
      Math.pow(avgDetectionColor.b - cluster.centroid.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestClusterId = cluster.teamId;
    }
  }

  return nearestClusterId;
}
