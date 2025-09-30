import * as tf from '@tensorflow/tfjs'

export async function loadMoveNet() {
  try {
    // Load MoveNet model for pose estimation
    const model = await tf.loadLayersModel('/models/movenet/model.json')
    return model
  } catch (error) {
    console.error('Failed to load MoveNet model:', error)
    // Fallback to a simpler pose detection method
    return null
  }
}
