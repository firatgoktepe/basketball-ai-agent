import Tesseract from "tesseract.js";
import type { OCRResult } from "@/types";

export async function runOCR(
  frames: ImageData[],
  cropRegion: { x: number; y: number; width: number; height: number }
): Promise<OCRResult[]> {
  const results: OCRResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const timestamp = i * (1 / 30); // Assuming 30fps, adjust based on actual sampling rate

    // Crop the scoreboard region from the frame
    const croppedImageData = cropImageData(frame, cropRegion);

    // Convert ImageData to canvas for OCR
    const canvas = new OffscreenCanvas(cropRegion.width, cropRegion.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.putImageData(croppedImageData, 0, 0);

    // Convert canvas to image for OCR
    const imageBlob = await canvas.convertToBlob();

    try {
      // Run OCR on the cropped region
      const {
        data: { text },
      } = await Tesseract.recognize(imageBlob, "eng", {
        logger: (m) => console.log(m),
      });

      // Parse score from OCR text
      const scores = parseScoreFromText(text);

      results.push({
        frameIndex: i,
        timestamp,
        scores,
        confidence: 0.8, // Placeholder confidence
      });
    } catch (error) {
      console.error("OCR failed for frame", i, error);
      // Add fallback result
      results.push({
        frameIndex: i,
        timestamp,
        scores: { teamA: 0, teamB: 0 },
        confidence: 0.0,
      });
    }
  }

  return results;
}

function cropImageData(
  imageData: ImageData,
  cropRegion: { x: number; y: number; width: number; height: number }
): ImageData {
  const { x, y, width, height } = cropRegion;

  // Validate dimensions
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
    console.warn(
      "Invalid crop region dimensions in ocr.ts, returning 1x1 placeholder"
    );
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

function parseScoreFromText(text: string): { teamA: number; teamB: number } {
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
