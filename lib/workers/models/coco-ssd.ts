import * as tf from '@tensorflow/tfjs'

export async function loadCocoSSD() {
    try {
        // Load COCO-SSD model from CDN
        const model = await tf.loadLayersModel('https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1')
        return model
    } catch (error) {
        console.error('Failed to load COCO-SSD model from CDN:', error)

        try {
            // Fallback to local model
            const model = await tf.loadLayersModel('/models/coco-ssd/model.json')
            return model
        } catch (localError) {
            console.error('Failed to load local COCO-SSD model:', localError)
            return null
        }
    }
}
