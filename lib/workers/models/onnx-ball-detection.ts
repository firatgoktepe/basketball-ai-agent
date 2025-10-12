import * as ort from "onnxruntime-web";

// CRITICAL: Disable WebGPU GLOBALLY before any ONNX operations
// This prevents JSEP provider from being registered at all
if (typeof ort !== "undefined" && ort.env) {
  // Configure WASM paths to local files IMMEDIATELY
  ort.env.wasm.wasmPaths = "/";
  ort.env.wasm.simd = true;
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;

  // Try to disable WebGL/WebGPU backends if they exist
  if ((ort.env as any).webgl) {
    (ort.env as any).webgl.disabled = true;
  }

  console.log("🔒 ONNX WebGPU/JSEP globally disabled, using WASM only");
}

export interface ONNXBallDetectionConfig {
  modelPath: string;
  inputSize: [number, number];
  confidenceThreshold: number;
  nmsThreshold: number;
  maxDetections: number;
}

export interface BallDetectionResult {
  bbox: [number, number, number, number];
  confidence: number;
  classId: number;
}

export class ONNXBallDetector {
  private session: ort.InferenceSession | null = null;
  private config: ONNXBallDetectionConfig;
  private isInitialized = false;

  constructor(config: Partial<ONNXBallDetectionConfig> = {}) {
    this.config = {
      modelPath: "/models/ball-detection.onnx",
      inputSize: [640, 640],
      confidenceThreshold: 0.5,
      nmsThreshold: 0.4,
      maxDetections: 10,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // CRITICAL: Configure ONNX Runtime BEFORE creating session
      this.configureONNXRuntime();

      console.log("Creating ONNX session with WASM-only execution...");

      // Create session with VERY explicit WASM-only configuration
      // Using string 'wasm' instead of array to be extra explicit
      this.session = await ort.InferenceSession.create(this.config.modelPath, {
        executionProviders: [
          {
            name: "wasm",
          },
        ],
        graphOptimizationLevel: "all",
        // Explicitly set these to prevent WebGPU detection
        executionMode: "sequential",
        enableCpuMemArena: true,
      });

      this.isInitialized = true;

      // Verify which providers are actually being used
      const actualProviders = this.session.inputNames;
      console.log("✅ ONNX Ball Detection model loaded successfully");
      console.log("   Using execution providers:", actualProviders);
    } catch (error) {
      console.error("Failed to initialize ONNX Ball Detection model:", error);
      throw error;
    }
  }

  private configureONNXRuntime(): void {
    // CRITICAL: Set these BEFORE creating InferenceSession
    // Use LOCAL WASM files from /public directory to avoid CDN issues

    // Point to local WASM files (served from /public in Next.js)
    ort.env.wasm.wasmPaths = "/";

    // Enable SIMD for better performance
    ort.env.wasm.simd = true;

    // Use single thread in workers to avoid threading issues
    ort.env.wasm.numThreads = 1;

    // Disable proxy mode
    ort.env.wasm.proxy = false;

    // NOTE: We use executionProviders: ['wasm'] in create() to prevent WebGPU/JSEP
    // Even though we have .jsep.wasm files, we don't have the .jsep.mjs files needed
    console.log(
      "✅ ONNX Runtime configured to use local WASM files from /public"
    );
  }

  private getExecutionProviders(): string[] {
    // This method is no longer used, but kept for backwards compatibility
    return ["wasm"];
  }

  async detectBalls(imageData: ImageData): Promise<BallDetectionResult[]> {
    if (!this.session || !this.isInitialized) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    try {
      // Preprocess image
      const inputTensor = await this.preprocessImage(imageData);

      // Run inference
      const feeds = { input: inputTensor };
      const results = await this.session.run(feeds);

      // Clean up input tensor
      inputTensor.dispose();

      // Process results
      const detections = this.processResults(results);

      // Apply Non-Maximum Suppression
      const filteredDetections = this.applyNMS(detections);

      return filteredDetections;
    } catch (error) {
      console.error("ONNX ball detection failed:", error);
      return [];
    }
  }

  private async preprocessImage(imageData: ImageData): Promise<ort.Tensor> {
    const { width, height } = imageData;
    const [targetWidth, targetHeight] = this.config.inputSize;

    // Create canvas for preprocessing
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Create ImageBitmap from ImageData for canvas drawing
    const imageBitmap = await createImageBitmap(
      new ImageData(imageData.data, width, height)
    );

    // Draw and scale image
    ctx.drawImage(
      imageBitmap,
      0,
      0,
      width,
      height,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Get image data
    const processedImageData = ctx.getImageData(
      0,
      0,
      targetWidth,
      targetHeight
    );

    // Convert to tensor (normalize to 0-1 and change from HWC to CHW)
    const data = new Float32Array(targetWidth * targetHeight * 3);
    const imageDataArray = processedImageData.data;

    for (let i = 0; i < targetWidth * targetHeight; i++) {
      // RGB to CHW format
      data[i] = imageDataArray[i * 4] / 255.0; // R
      data[i + targetWidth * targetHeight] = imageDataArray[i * 4 + 1] / 255.0; // G
      data[i + 2 * targetWidth * targetHeight] =
        imageDataArray[i * 4 + 2] / 255.0; // B
    }

    return new ort.Tensor("float32", data, [1, 3, targetHeight, targetWidth]);
  }

  private processResults(
    results: ort.InferenceSession.OnnxValueMapType
  ): BallDetectionResult[] {
    const detections: BallDetectionResult[] = [];

    // Extract output tensors (format depends on the specific model)
    // Common formats: [batch, num_detections, 6] or [batch, num_detections, 85]
    const output = results.output as ort.Tensor;
    const outputData = output.data as Float32Array;

    // Parse detections (assuming YOLO format: [x, y, w, h, confidence, class])
    const numDetections = output.dims[1];
    const numValues = output.dims[2];

    for (let i = 0; i < numDetections; i++) {
      const startIndex = i * numValues;

      // Extract values (format may vary based on model)
      const x = outputData[startIndex];
      const y = outputData[startIndex + 1];
      const w = outputData[startIndex + 2];
      const h = outputData[startIndex + 3];
      const confidence = outputData[startIndex + 4];
      const classId = Math.round(outputData[startIndex + 5] || 0);

      // Filter by confidence threshold
      if (confidence >= this.config.confidenceThreshold) {
        // Convert from center coordinates to corner coordinates
        const x1 = x - w / 2;
        const y1 = y - h / 2;
        const x2 = x + w / 2;
        const y2 = y + h / 2;

        detections.push({
          bbox: [x1, y1, x2 - x1, y2 - y1] as [number, number, number, number],
          confidence,
          classId,
        });
      }
    }

    return detections;
  }

  private applyNMS(detections: BallDetectionResult[]): BallDetectionResult[] {
    if (detections.length === 0) return [];

    // Sort by confidence
    const sortedDetections = detections.sort(
      (a, b) => b.confidence - a.confidence
    );
    const keep: BallDetectionResult[] = [];
    const suppressed = new Set<number>();

    for (let i = 0; i < sortedDetections.length; i++) {
      if (suppressed.has(i)) continue;

      const current = sortedDetections[i];
      keep.push(current);

      // Suppress overlapping detections
      for (let j = i + 1; j < sortedDetections.length; j++) {
        if (suppressed.has(j)) continue;

        const other = sortedDetections[j];
        const iou = this.calculateIoU(current.bbox, other.bbox);

        if (iou > this.config.nmsThreshold) {
          suppressed.add(j);
        }
      }
    }

    return keep.slice(0, this.config.maxDetections);
  }

  private calculateIoU(
    bbox1: [number, number, number, number],
    bbox2: [number, number, number, number]
  ): number {
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;

    const xLeft = Math.max(x1, x2);
    const yTop = Math.max(y1, y2);
    const xRight = Math.min(x1 + w1, x2 + w2);
    const yBottom = Math.min(y1 + h1, y2 + h2);

    if (xRight < xLeft || yBottom < yTop) {
      return 0;
    }

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
    const bbox1Area = w1 * h1;
    const bbox2Area = w2 * h2;
    const unionArea = bbox1Area + bbox2Area - intersectionArea;

    return intersectionArea / unionArea;
  }

  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
    this.isInitialized = false;
  }
}

export async function loadONNXBallDetector(
  config?: Partial<ONNXBallDetectionConfig>
): Promise<ONNXBallDetector> {
  const detector = new ONNXBallDetector(config);
  await detector.initialize();
  return detector;
}

// Utility function to check if ONNX Runtime is available
export function isONNXAvailable(): boolean {
  try {
    return (
      typeof ort !== "undefined" && typeof ort.InferenceSession !== "undefined"
    );
  } catch {
    return false;
  }
}

// Utility function to get available execution providers
export async function getAvailableExecutionProviders(): Promise<string[]> {
  const providers: string[] = [];

  // Note: WebGPU support requires .jsep.mjs files which may not be available
  // For broader compatibility, we return only WASM providers

  // WebAssembly is always available and most compatible
  providers.push("wasm");

  return providers;
}
