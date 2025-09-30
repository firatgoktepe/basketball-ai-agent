import { detectPersons, clusterTeams } from "./person-detection";
import { extractJerseyColors, clusterColorsByKMeans } from "./color-extraction";

// Test function for person detection
export async function testPersonDetection() {
  console.log("Testing person detection...");

  // Create mock frames
  const mockFrames: ImageData[] = [];
  for (let i = 0; i < 5; i++) {
    const canvas = new OffscreenCanvas(800, 600);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Draw a simple background
      ctx.fillStyle = "#4a5568";
      ctx.fillRect(0, 0, 800, 600);

      // Draw some mock people
      ctx.fillStyle = "#3b82f6"; // Blue
      ctx.fillRect(100, 200, 60, 120);

      ctx.fillStyle = "#dc2626"; // Red
      ctx.fillRect(300, 180, 60, 120);

      ctx.fillStyle = "#3b82f6"; // Blue
      ctx.fillRect(500, 220, 60, 120);
    }

    if (ctx) {
      const imageData = ctx.getImageData(0, 0, 800, 600);
      mockFrames.push(imageData);
    }
  }

  try {
    // Test person detection
    const detections = await detectPersons(mockFrames, null); // No model, use fallback
    console.log("Person detections:", detections);

    // Test team clustering
    const teamClusters = await clusterTeams(detections, mockFrames);
    console.log("Team clusters:", teamClusters);

    // Test color extraction
    const colorSamples = extractJerseyColors(detections, mockFrames);
    console.log("Color samples:", colorSamples.length);

    // Test color clustering
    const colorClusters = clusterColorsByKMeans(colorSamples, 2);
    console.log("Color clusters:", colorClusters);

    return {
      success: true,
      detections: detections.length,
      colorSamples: colorSamples.length,
      clusters: colorClusters.length,
    };
  } catch (error) {
    console.error("Person detection test failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
