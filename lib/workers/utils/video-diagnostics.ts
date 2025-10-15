/**
 * Video Diagnostics Tool
 * 
 * This utility helps diagnose why ball detection or pose estimation might be failing
 * by analyzing the video content and providing detailed feedback.
 */

export interface VideoDiagnosticReport {
  frameAnalysis: {
    totalFrames: number;
    validFrames: number;
    averageWidth: number;
    averageHeight: number;
  };
  colorAnalysis: {
    dominantColors: Array<{ r: number; g: number; b: number; percentage: number }>;
    hasOrangeContent: boolean;
    orangePercentage: number;
    colorDistribution: {
      reds: number;
      greens: number;
      blues: number;
      oranges: number;
      browns: number;
    };
  };
  recommendations: string[];
  warnings: string[];
}

export function analyzeVideoFrames(frames: ImageData[]): VideoDiagnosticReport {
  console.log(`[Video Diagnostics] Analyzing ${frames.length} frames...`);

  // Frame analysis
  const validFrames = frames.filter(f => f && f.width > 0 && f.height > 0 && f.data.length > 0);
  const avgWidth = validFrames.reduce((sum, f) => sum + f.width, 0) / validFrames.length;
  const avgHeight = validFrames.reduce((sum, f) => sum + f.height, 0) / validFrames.length;

  // Color analysis - sample middle frames for better representation
  const sampleFrames = [
    validFrames[Math.floor(validFrames.length * 0.25)],
    validFrames[Math.floor(validFrames.length * 0.5)],
    validFrames[Math.floor(validFrames.length * 0.75)],
  ].filter(f => f);

  let colorDistribution = {
    reds: 0,
    greens: 0,
    blues: 0,
    oranges: 0,
    browns: 0,
  };

  let totalSamples = 0;
  const colorBuckets = new Map<string, number>();

  for (const frame of sampleFrames) {
    // Sample every 50th pixel for performance
    const step = 50;
    for (let i = 0; i < frame.data.length; i += step * 4) {
      if (i + 2 >= frame.data.length) continue;

      const r = frame.data[i];
      const g = frame.data[i + 1];
      const b = frame.data[i + 2];

      totalSamples++;

      // Classify colors
      if (r > 150 && g < 100 && b < 100) {
        colorDistribution.reds++;
      } else if (r < 100 && g > 150 && b < 100) {
        colorDistribution.greens++;
      } else if (r < 100 && g < 100 && b > 150) {
        colorDistribution.blues++;
      } else if (r > 150 && g > 80 && g < 150 && b < 100) {
        colorDistribution.oranges++;
      } else if (r > 100 && r < 180 && g > 60 && g < 120 && b < 80) {
        colorDistribution.browns++;
      }

      // Bucket dominant colors
      const colorKey = `${Math.floor(r / 50)}-${Math.floor(g / 50)}-${Math.floor(b / 50)}`;
      colorBuckets.set(colorKey, (colorBuckets.get(colorKey) || 0) + 1);
    }
  }

  // Find dominant colors
  const sortedColors = Array.from(colorBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const dominantColors = sortedColors.map(([key, count]) => {
    const [rBucket, gBucket, bBucket] = key.split('-').map(Number);
    return {
      r: rBucket * 50 + 25,
      g: gBucket * 50 + 25,
      b: bBucket * 50 + 25,
      percentage: (count / totalSamples) * 100,
    };
  });

  const orangePercentage = ((colorDistribution.oranges + colorDistribution.browns) / totalSamples) * 100;
  const hasOrangeContent = orangePercentage > 0.1; // At least 0.1% orange/brown

  // Generate recommendations
  const recommendations: string[] = [];
  const warnings: string[] = [];

  if (!hasOrangeContent) {
    warnings.push("⚠️ No orange/brown colors detected - ball detection will likely fail");
    recommendations.push("Ensure your video contains an orange basketball");
    recommendations.push("Check lighting - the ball might be too dark or washed out");
    recommendations.push("Try adjusting video brightness/contrast before uploading");
  } else if (orangePercentage < 0.5) {
    warnings.push(`⚠️ Low orange content (${orangePercentage.toFixed(2)}%) - ball detection may struggle`);
    recommendations.push("Ensure the ball is visible in most frames");
    recommendations.push("Consider using a clip where the ball is more prominent");
  } else {
    recommendations.push("✅ Good orange content detected - ball detection should work");
  }

  if (avgWidth < 640 || avgHeight < 480) {
    warnings.push(`⚠️ Low resolution (${Math.round(avgWidth)}x${Math.round(avgHeight)}) - detection accuracy may be reduced`);
    recommendations.push("Use higher resolution video (720p or 1080p recommended)");
  } else {
    recommendations.push(`✅ Good resolution (${Math.round(avgWidth)}x${Math.round(avgHeight)})`);
  }

  if (validFrames.length < frames.length * 0.9) {
    warnings.push(`⚠️ ${frames.length - validFrames.length} invalid frames detected`);
    recommendations.push("Check video file integrity");
  }

  console.log(`[Video Diagnostics] Analysis complete:`);
  console.log(`  - Valid frames: ${validFrames.length}/${frames.length}`);
  console.log(`  - Resolution: ${Math.round(avgWidth)}x${Math.round(avgHeight)}`);
  console.log(`  - Orange content: ${orangePercentage.toFixed(2)}%`);
  console.log(`  - Warnings: ${warnings.length}`);
  console.log(`  - Recommendations: ${recommendations.length}`);

  return {
    frameAnalysis: {
      totalFrames: frames.length,
      validFrames: validFrames.length,
      averageWidth: Math.round(avgWidth),
      averageHeight: Math.round(avgHeight),
    },
    colorAnalysis: {
      dominantColors,
      hasOrangeContent,
      orangePercentage,
      colorDistribution,
    },
    recommendations,
    warnings,
  };
}

/**
 * Quick diagnostic check to determine if ball detection is likely to work
 */
export function quickBallDetectionCheck(frames: ImageData[]): {
  likelyToWork: boolean;
  reason: string;
} {
  if (frames.length === 0) {
    return { likelyToWork: false, reason: "No frames to analyze" };
  }

  // Sample a few frames
  const sampleFrame = frames[Math.floor(frames.length / 2)];
  if (!sampleFrame || !sampleFrame.data) {
    return { likelyToWork: false, reason: "Invalid frame data" };
  }

  // Quick orange pixel count
  let orangePixels = 0;
  const step = 100; // Very sparse sampling for quick check
  
  for (let i = 0; i < sampleFrame.data.length; i += step * 4) {
    if (i + 2 >= sampleFrame.data.length) continue;
    
    const r = sampleFrame.data[i];
    const g = sampleFrame.data[i + 1];
    const b = sampleFrame.data[i + 2];
    
    // Quick HSV check
    const isOrange = r > 150 && g > 80 && g < 150 && b < 100;
    const isBrown = r > 100 && r < 180 && g > 60 && g < 120 && b < 80;
    
    if (isOrange || isBrown) {
      orangePixels++;
    }
  }

  const totalSamples = Math.floor(sampleFrame.data.length / (step * 4));
  const orangePercentage = (orangePixels / totalSamples) * 100;

  if (orangePercentage > 0.5) {
    return { 
      likelyToWork: true, 
      reason: `Good orange content detected (${orangePercentage.toFixed(2)}%)` 
    };
  } else if (orangePercentage > 0.1) {
    return { 
      likelyToWork: true, 
      reason: `Marginal orange content (${orangePercentage.toFixed(2)}%) - may work with relaxed thresholds` 
    };
  } else {
    return { 
      likelyToWork: false, 
      reason: `No orange content detected (${orangePercentage.toFixed(2)}%) - ball detection will likely fail` 
    };
  }
}

