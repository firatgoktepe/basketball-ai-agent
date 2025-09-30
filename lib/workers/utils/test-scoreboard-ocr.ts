// Test file for scoreboard OCR functionality
import { ScoreboardOCRProcessor } from "./scoreboard-ocr";

// Mock test data
const mockFrame = new ImageData(100, 50); // Small test frame
const mockCropRegion = { x: 10, y: 10, width: 80, height: 30 };

// Test the OCR processor
async function testScoreboardOCR() {
  console.log("Testing Scoreboard OCR Processor...");

  const processor = new ScoreboardOCRProcessor({
    cropRegion: mockCropRegion,
    samplingRate: 1,
    onScoreChange: (event) => {
      console.log("Score change detected:", event);
    },
  });

  try {
    await processor.initialize();
    console.log("OCR processor initialized successfully");

    // Test frame processing
    const result = await processor.processFrame(mockFrame, 0, 0);
    console.log("OCR result:", result);

    await processor.cleanup();
    console.log("OCR processor cleaned up successfully");

    return true;
  } catch (error) {
    console.error("OCR test failed:", error);
    return false;
  }
}

// Export for use in other test files
export { testScoreboardOCR };
