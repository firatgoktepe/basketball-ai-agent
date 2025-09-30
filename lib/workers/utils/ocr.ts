import Tesseract from 'tesseract.js'
import type { OCRResult } from '@/types'

export async function runOCR(frames: ImageData[], cropRegion: { x: number; y: number; width: number; height: number }): Promise<OCRResult[]> {
  const results: OCRResult[] = []
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const timestamp = i * (1 / 30) // Assuming 30fps, adjust based on actual sampling rate
    
    // Crop the scoreboard region from the frame
    const croppedImageData = cropImageData(frame, cropRegion)
    
    // Convert ImageData to canvas for OCR
    const canvas = new OffscreenCanvas(cropRegion.width, cropRegion.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    
    ctx.putImageData(croppedImageData, 0, 0)
    
    // Convert canvas to image for OCR
    const imageBlob = await canvas.convertToBlob()
    
    try {
      // Run OCR on the cropped region
      const { data: { text } } = await Tesseract.recognize(imageBlob, 'eng', {
        logger: m => console.log(m)
      })
      
      // Parse score from OCR text
      const scores = parseScoreFromText(text)
      
      results.push({
        frameIndex: i,
        timestamp,
        scores,
        confidence: 0.8 // Placeholder confidence
      })
    } catch (error) {
      console.error('OCR failed for frame', i, error)
      // Add fallback result
      results.push({
        frameIndex: i,
        timestamp,
        scores: { teamA: 0, teamB: 0 },
        confidence: 0.0
      })
    }
  }
  
  return results
}

function cropImageData(imageData: ImageData, cropRegion: { x: number; y: number; width: number; height: number }): ImageData {
  const { x, y, width, height } = cropRegion
  const croppedData = new ImageData(width, height)
  
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const sourceIndex = ((y + row) * imageData.width + (x + col)) * 4
      const targetIndex = (row * width + col) * 4
      
      croppedData.data[targetIndex] = imageData.data[sourceIndex]     // R
      croppedData.data[targetIndex + 1] = imageData.data[sourceIndex + 1] // G
      croppedData.data[targetIndex + 2] = imageData.data[sourceIndex + 2] // B
      croppedData.data[targetIndex + 3] = imageData.data[sourceIndex + 3] // A
    }
  }
  
  return croppedData
}

function parseScoreFromText(text: string): { teamA: number; teamB: number } {
  // Simple score parsing - look for numbers in the text
  const numbers = text.match(/\d+/g)
  
  if (numbers && numbers.length >= 2) {
    return {
      teamA: parseInt(numbers[0]) || 0,
      teamB: parseInt(numbers[1]) || 0
    }
  }
  
  // Fallback: return previous scores or 0
  return { teamA: 0, teamB: 0 }
}
