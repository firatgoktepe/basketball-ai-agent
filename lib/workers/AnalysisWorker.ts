import type {
  AnalysisOptions,
  GameData,
  AnalysisProgress,
  DetectionResult,
  OCRResult,
  PoseResult,
} from "@/types";
import { extractFrames } from "./utils/frame-extractor";

export class AnalysisWorker {
  private worker: Worker | null = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    // Create a Web Worker for heavy processing
    this.worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
    this.isInitialized = true;
  }

  async analyzeVideo(
    options: Omit<AnalysisOptions, "onProgress">,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<GameData> {
    await this.initialize();

    return new Promise(async (resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Worker not initialized"));
        return;
      }

      try {
        // Extract frames in main thread (where we have access to DOM)
        console.log("[Main Thread] Extracting frames...");
        onProgress?.({
          stage: "sampling",
          progress: 10,
          message: "Extracting video frames...",
        });

        const frames = await extractFrames(
          options.videoFile,
          options.samplingRate
        );

        console.log(`[Main Thread] Extracted ${frames.length} frames`);

        if (frames.length > 0) {
          console.log(
            `[Main Thread] First frame: ${frames[0].width}x${frames[0].height}`
          );
        } else {
          console.error("[Main Thread] No frames extracted!");
        }

        const handleMessage = (event: MessageEvent) => {
          const { type, data } = event.data;

          switch (type) {
            case "progress":
              if (onProgress) {
                onProgress(data);
              }
              break;
            case "debug":
              // Log debug messages from worker to main console
              console.log(`[Worker Debug] ${data.message}`);
              break;
            case "result":
              this.worker?.removeEventListener("message", handleMessage);
              resolve(data);
              break;
            case "error":
              this.worker?.removeEventListener("message", handleMessage);
              reject(new Error(data));
              break;
          }
        };

        this.worker.addEventListener("message", handleMessage);

        // Convert ImageData to transferable format
        const transferableFrames = frames.map((frame) => ({
          data: frame.data.buffer, // Get the underlying ArrayBuffer
          width: frame.width,
          height: frame.height,
        }));

        // Collect all ArrayBuffers for transfer
        const transferList = transferableFrames.map((f) => f.data);

        // Send frames and options to worker using transferable objects
        this.worker.postMessage(
          {
            type: "analyze",
            data: {
              ...options,
              frames: transferableFrames,
            },
          },
          transferList // Transfer ownership instead of cloning
        );

        console.log(
          `[Main Thread] Transferred ${transferList.length} frame buffers to worker`
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}
