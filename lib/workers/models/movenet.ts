import * as tf from "@tensorflow/tfjs";

export interface MoveNetConfig {
  modelType:
    | "SinglePose.Lightning"
    | "SinglePose.Thunder"
    | "MultiPose.Lightning";
  enableSmoothing?: boolean;
  minPoseConfidence?: number;
  enableTracking?: boolean;
}

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  name?: string;
}

export interface Pose {
  keypoints: PoseKeypoint[];
  score: number;
  bbox: [number, number, number, number];
}

export class MoveNetPoseEstimator {
  private model: tf.LayersModel | null = null;
  private config: MoveNetConfig;
  private previousPoses: Pose[] = [];

  constructor(config: MoveNetConfig = { modelType: "SinglePose.Lightning" }) {
    this.config = {
      enableSmoothing: true,
      minPoseConfidence: 0.3,
      enableTracking: true,
      ...config,
    };
  }

  async loadModel(): Promise<void> {
    try {
      // Try to load MoveNet from TensorFlow Hub
      const modelUrl = this.getModelUrl();
      this.model = await tf.loadLayersModel(modelUrl);
      console.log("MoveNet model loaded successfully");
    } catch (error) {
      console.error("Failed to load MoveNet model:", error);
      // Fallback to a mock model for development
      this.model = this.createMockModel();
    }
  }

  private getModelUrl(): string {
    switch (this.config.modelType) {
      case "SinglePose.Lightning":
        return "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4";
      case "SinglePose.Thunder":
        return "https://tfhub.dev/google/tfjs-model/movenet/singlepose/thunder/4";
      case "MultiPose.Lightning":
        return "https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1";
      default:
        return "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4";
    }
  }

  private createMockModel(): tf.LayersModel {
    // Create a mock model for development/testing
    const input = tf.input({ shape: [192, 192, 3], name: "input" });
    const output = tf.layers.dense({ units: 51, name: "output" }).apply(input);
    return tf.model({ inputs: input, outputs: output as tf.SymbolicTensor });
  }

  async estimatePoses(imageData: ImageData): Promise<Pose[]> {
    if (!this.model) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    try {
      // Preprocess image
      const tensor = this.preprocessImage(imageData);

      // Run inference
      const predictions = this.model.predict(tensor) as tf.Tensor;
      const predictionsArray = await predictions.array();

      // Clean up tensors
      tensor.dispose();
      predictions.dispose();

      // Process predictions
      const poses = this.processPredictions(predictionsArray as number[][]);

      // Apply smoothing if enabled
      if (this.config.enableSmoothing) {
        return this.applySmoothing(poses);
      }

      return poses;
    } catch (error) {
      console.error("Pose estimation failed:", error);
      return [];
    }
  }

  private preprocessImage(imageData: ImageData): tf.Tensor {
    // Convert ImageData to tensor and resize to 192x192 (MoveNet input size)
    const tensor = tf.browser.fromPixels(imageData);
    const resized = tf.image.resizeBilinear(tensor, [192, 192]);
    const normalized = resized.div(255.0);
    const batched = normalized.expandDims(0);

    tensor.dispose();
    resized.dispose();
    normalized.dispose();

    return batched;
  }

  private processPredictions(predictions: number[][]): Pose[] {
    const poses: Pose[] = [];

    for (const prediction of predictions) {
      if (this.config.modelType === "MultiPose.Lightning") {
        // MultiPose model returns multiple poses
        const numPoses = prediction[0];
        for (let i = 0; i < numPoses; i++) {
          const pose = this.extractPoseFromMultiPose(prediction, i);
          if (pose && pose.score >= (this.config.minPoseConfidence || 0.3)) {
            poses.push(pose);
          }
        }
      } else {
        // SinglePose model returns one pose
        const pose = this.extractPoseFromSinglePose(prediction);
        if (pose && pose.score >= (this.config.minPoseConfidence || 0.3)) {
          poses.push(pose);
        }
      }
    }

    return poses;
  }

  private extractPoseFromSinglePose(prediction: number[]): Pose | null {
    const keypoints: PoseKeypoint[] = [];
    const keypointNames = [
      "nose",
      "left_eye",
      "right_eye",
      "left_ear",
      "right_ear",
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
      "left_knee",
      "right_knee",
      "left_ankle",
      "right_ankle",
    ];

    for (let i = 0; i < 17; i++) {
      const y = prediction[i * 3];
      const x = prediction[i * 3 + 1];
      const confidence = prediction[i * 3 + 2];

      keypoints.push({
        x: x * 192, // Scale back to image coordinates
        y: y * 192,
        confidence,
        name: keypointNames[i],
      });
    }

    const score = Math.min(...keypoints.map((kp) => kp.confidence));
    const bbox = this.calculateBoundingBox(keypoints);

    return { keypoints, score, bbox };
  }

  private extractPoseFromMultiPose(
    prediction: number[],
    poseIndex: number
  ): Pose | null {
    // MultiPose model structure: [num_poses, pose1_data, pose2_data, ...]
    const startIndex = 1 + poseIndex * 56; // 56 values per pose
    const keypoints: PoseKeypoint[] = [];
    const keypointNames = [
      "nose",
      "left_eye",
      "right_eye",
      "left_ear",
      "right_ear",
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
      "left_knee",
      "right_knee",
      "left_ankle",
      "right_ankle",
    ];

    for (let i = 0; i < 17; i++) {
      const y = prediction[startIndex + i * 3];
      const x = prediction[startIndex + i * 3 + 1];
      const confidence = prediction[startIndex + i * 3 + 2];

      keypoints.push({
        x: x * 192,
        y: y * 192,
        confidence,
        name: keypointNames[i],
      });
    }

    const score = Math.min(...keypoints.map((kp) => kp.confidence));
    const bbox = this.calculateBoundingBox(keypoints);

    return { keypoints, score, bbox };
  }

  private calculateBoundingBox(
    keypoints: PoseKeypoint[]
  ): [number, number, number, number] {
    const validKeypoints = keypoints.filter((kp) => kp.confidence > 0.1);
    if (validKeypoints.length === 0) {
      return [0, 0, 0, 0];
    }

    const xs = validKeypoints.map((kp) => kp.x);
    const ys = validKeypoints.map((kp) => kp.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return [minX, minY, maxX - minX, maxY - minY];
  }

  private applySmoothing(poses: Pose[]): Pose[] {
    if (!this.config.enableTracking || this.previousPoses.length === 0) {
      this.previousPoses = poses;
      return poses;
    }

    const smoothedPoses: Pose[] = [];
    const smoothingFactor = 0.3; // How much to weight previous poses

    for (const currentPose of poses) {
      // Find closest previous pose
      const closestPrevious = this.findClosestPose(
        currentPose,
        this.previousPoses
      );

      if (closestPrevious) {
        // Apply smoothing
        const smoothedPose = this.smoothPose(
          currentPose,
          closestPrevious,
          smoothingFactor
        );
        smoothedPoses.push(smoothedPose);
      } else {
        smoothedPoses.push(currentPose);
      }
    }

    this.previousPoses = smoothedPoses;
    return smoothedPoses;
  }

  private findClosestPose(
    currentPose: Pose,
    previousPoses: Pose[]
  ): Pose | null {
    let closest: Pose | null = null;
    let minDistance = Infinity;

    for (const previousPose of previousPoses) {
      const distance = this.calculatePoseDistance(currentPose, previousPose);
      if (distance < minDistance) {
        minDistance = distance;
        closest = previousPose;
      }
    }

    return minDistance < 100 ? closest : null; // Threshold for pose matching
  }

  private calculatePoseDistance(pose1: Pose, pose2: Pose): number {
    let totalDistance = 0;
    let validKeypoints = 0;

    for (
      let i = 0;
      i < Math.min(pose1.keypoints.length, pose2.keypoints.length);
      i++
    ) {
      const kp1 = pose1.keypoints[i];
      const kp2 = pose2.keypoints[i];

      if (kp1.confidence > 0.1 && kp2.confidence > 0.1) {
        const distance = Math.sqrt((kp1.x - kp2.x) ** 2 + (kp1.y - kp2.y) ** 2);
        totalDistance += distance;
        validKeypoints++;
      }
    }

    return validKeypoints > 0 ? totalDistance / validKeypoints : Infinity;
  }

  private smoothPose(
    currentPose: Pose,
    previousPose: Pose,
    factor: number
  ): Pose {
    const smoothedKeypoints: PoseKeypoint[] = [];

    for (let i = 0; i < currentPose.keypoints.length; i++) {
      const currentKp = currentPose.keypoints[i];
      const previousKp = previousPose.keypoints[i];

      if (currentKp.confidence > 0.1 && previousKp.confidence > 0.1) {
        smoothedKeypoints.push({
          x: currentKp.x * (1 - factor) + previousKp.x * factor,
          y: currentKp.y * (1 - factor) + previousKp.y * factor,
          confidence: Math.max(currentKp.confidence, previousKp.confidence),
          name: currentKp.name,
        });
      } else {
        smoothedKeypoints.push(currentKp);
      }
    }

    const smoothedScore =
      currentPose.score * (1 - factor) + previousPose.score * factor;
    const smoothedBbox = this.calculateBoundingBox(smoothedKeypoints);

    return {
      keypoints: smoothedKeypoints,
      score: smoothedScore,
      bbox: smoothedBbox,
    };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}

export async function loadMoveNet(
  config?: MoveNetConfig
): Promise<MoveNetPoseEstimator> {
  const estimator = new MoveNetPoseEstimator(config);
  await estimator.loadModel();
  return estimator;
}
