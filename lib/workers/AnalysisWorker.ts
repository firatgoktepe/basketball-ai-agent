import type { AnalysisOptions, GameData, AnalysisProgress, DetectionResult, OCRResult, PoseResult } from '@/types'

export class AnalysisWorker {
    private worker: Worker | null = null
    private isInitialized = false

    async initialize() {
        if (this.isInitialized) return

        // Create a Web Worker for heavy processing
        this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url))
        this.isInitialized = true
    }

    async analyzeVideo(options: AnalysisOptions): Promise<GameData> {
        await this.initialize()

        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not initialized'))
                return
            }

            const handleMessage = (event: MessageEvent) => {
                const { type, data } = event.data

                switch (type) {
                    case 'progress':
                        options.onProgress(data)
                        break
                    case 'result':
                        this.worker?.removeEventListener('message', handleMessage)
                        resolve(data)
                        break
                    case 'error':
                        this.worker?.removeEventListener('message', handleMessage)
                        reject(new Error(data))
                        break
                }
            }

            this.worker.addEventListener('message', handleMessage)
            this.worker.postMessage({ type: 'analyze', data: options })
        })
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate()
            this.worker = null
            this.isInitialized = false
        }
    }
}
