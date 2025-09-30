import * as tf from '@tensorflow/tfjs'

export async function loadCocoSSD() {
    try {
        // Load COCO-SSD model for person detection
        const model = await tf.loadLayersModel('/models/coco-ssd/model.json')
        return model
    } catch (error) {
        console.error('Failed to load COCO-SSD model:', error)
        // Fallback to a simpler detection method
        return null
    }
}
