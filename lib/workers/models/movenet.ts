import * as tf from "@tensorflow/tfjs";

export interface MoveNetConfig {
  modelType:
    | "SinglePose.Lightning"
    | "SinglePose.Thunder"
    | "MultiPose.Lightning";
  enableSmoothing?: boolean;
  minPoseConfidence?: number;
  enableTracking?: boolean;
  forceMock?: boolean; // Force using mock model for testing
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
  teamId?: string;
}

export class MoveNetPoseEstimator {
  private model: tf.LayersModel | null = null;
  private config: MoveNetConfig;
  private previousPoses: Pose[] = [];
  private isMockModel: boolean = false;

  constructor(config: MoveNetConfig = { modelType: "SinglePose.Lightning" }) {
    this.config = {
      enableSmoothing: true,
      minPoseConfidence: 0.3,
      enableTracking: true,
      ...config,
    };
  }

  isUsingMockModel(): boolean {
    return this.isMockModel;
  }

  async loadModel(): Promise<void> {
    // Check if we should force using mock model
    if (this.config.forceMock) {
      console.log("🔧 Force mock enabled - using mock model for testing");
      this.model = this.createRealisticMockModel();
      this.isMockModel = true;

      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: "🔧 Force mock enabled - using mock model for testing",
          },
        });
      }
      return;
    }

    try {
      // Try to load MoveNet from TensorFlow Hub
      const modelUrl = this.getModelUrl();
      console.log("🔄 Loading MoveNet model from:", modelUrl);

      // Send debug message to main thread
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `🔄 Loading MoveNet model from: ${modelUrl}`,
          },
        });
      }

      // Add more detailed error handling for model loading
      try {
        this.model = await tf.loadLayersModel(modelUrl, {
          fromTFHub: true,
          requestInit: {
            mode: "cors",
          },
        });

        console.log("✅ MoveNet model loaded successfully from TensorFlow Hub");
        console.log("Model input shape:", this.model.inputs[0]?.shape);
        console.log("Model output shape:", this.model.outputs[0]?.shape);

        // Send debug message to main thread
        if (typeof self !== "undefined" && self.postMessage) {
          self.postMessage({
            type: "debug",
            data: {
              message:
                "✅ MoveNet model loaded successfully from TensorFlow Hub",
            },
          });
        }

        return; // Success, exit early
      } catch (hubError) {
        console.warn(
          "TensorFlow Hub loading failed, trying alternative URLs:",
          hubError
        );

        // Send detailed error info to main thread
        if (typeof self !== "undefined" && self.postMessage) {
          self.postMessage({
            type: "debug",
            data: {
              message: `⚠️ TensorFlow Hub failed: ${
                hubError instanceof Error ? hubError.message : String(hubError)
              }. Trying alternatives...`,
            },
          });
        }

        // Try alternative URLs
        const alternativeUrls = this.getAlternativeModelUrls();
        for (let i = 0; i < alternativeUrls.length; i++) {
          const altUrl = alternativeUrls[i];
          try {
            console.log(
              `🔄 Trying alternative URL ${i + 1}/${
                alternativeUrls.length
              }: ${altUrl}`
            );

            if (typeof self !== "undefined" && self.postMessage) {
              self.postMessage({
                type: "debug",
                data: {
                  message: `🔄 Trying alternative URL ${i + 1}/${
                    alternativeUrls.length
                  }...`,
                },
              });
            }

            this.model = await tf.loadLayersModel(altUrl);
            console.log(
              `✅ MoveNet model loaded successfully from alternative URL: ${altUrl}`
            );

            if (typeof self !== "undefined" && self.postMessage) {
              self.postMessage({
                type: "debug",
                data: {
                  message: `✅ MoveNet model loaded successfully from alternative URL ${
                    i + 1
                  }`,
                },
              });
            }

            return; // Success, exit early
          } catch (altError) {
            console.warn(
              `Alternative URL ${i + 1} failed: ${altUrl}`,
              altError
            );

            if (typeof self !== "undefined" && self.postMessage) {
              self.postMessage({
                type: "debug",
                data: {
                  message: `❌ Alternative URL ${i + 1} failed: ${
                    altError instanceof Error
                      ? altError.message
                      : String(altError)
                  }`,
                },
              });
            }
            continue; // Try next URL
          }
        }

        // If all alternative URLs fail, try direct URL without fromTFHub flag
        try {
          this.model = await tf.loadLayersModel(modelUrl);
          console.log("✅ MoveNet model loaded successfully from direct URL");

          if (typeof self !== "undefined" && self.postMessage) {
            self.postMessage({
              type: "debug",
              data: {
                message: "✅ MoveNet model loaded successfully from direct URL",
              },
            });
          }

          return; // Success, exit early
        } catch (directError) {
          console.error("Direct URL loading also failed:", directError);
          throw directError; // Re-throw to trigger fallback
        }
      }
    } catch (error) {
      console.error("❌ All MoveNet loading attempts failed:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // Send debug message to main thread
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `❌ Failed to load MoveNet model: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        });
      }

      // Fallback to a mock model for development
      console.error("❌ All MoveNet model loading attempts failed!");
      console.error("This means pose detection will not work properly.");
      console.error("Possible causes:");
      console.error("1. Network connectivity issues");
      console.error("2. CORS policy blocking model downloads");
      console.error("3. TensorFlow Hub service issues");
      console.error("4. Browser compatibility issues");

      this.model = this.createRealisticMockModel();
      this.isMockModel = true;
      console.log("🔧 Using realistic mock MoveNet model for development");

      // Send detailed error message to main thread
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message:
              "❌ All MoveNet model loading failed! Pose detection will not work properly. Check network connectivity and browser console for details.",
          },
        });
      }
    }
  }

  private getModelUrl(): string {
    switch (this.config.modelType) {
      case "SinglePose.Lightning":
        // Try multiple URLs for better compatibility
        return "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4";
      case "SinglePose.Thunder":
        return "https://tfhub.dev/google/tfjs-model/movenet/singlepose/thunder/4";
      case "MultiPose.Lightning":
        return "https://tfhub.dev/google/tfjs-model/movenet/multipose/lightning/1";
      default:
        return "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4";
    }
  }

  private getAlternativeModelUrls(): string[] {
    // Alternative URLs to try if the main one fails
    return [
      // Try different TensorFlow Hub versions
      "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/3",
      "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/2",

      // Try Google Storage direct URLs
      "https://storage.googleapis.com/tfjs-models/tfjs/movenet/singlepose/lightning/4/model.json",
      "https://storage.googleapis.com/tfjs-models/tfjs/movenet/singlepose/lightning/3/model.json",

      // Try unpkg CDN as fallback
      "https://unpkg.com/@tensorflow-models/pose-detection@2.0.0/dist/movenet/singlepose/lightning/4/model.json",
    ];
  }

  private createMockModel(): tf.LayersModel {
    // Create a mock model for development/testing
    const input = tf.input({ shape: [192, 192, 3], name: "input" });
    const output = tf.layers.dense({ units: 51, name: "output" }).apply(input);

    // Send debug message to main thread
    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message:
            "🔧 Created mock MoveNet model - this will not detect real poses",
        },
      });
    }

    return tf.model({ inputs: input, outputs: output as tf.SymbolicTensor });
  }

  /**
   * Creates a more realistic mock that can detect some basic poses
   * This is used when the real MoveNet model fails to load
   */
  private createRealisticMockModel(): tf.LayersModel {
    // Create a mock model that returns some basic pose data
    const input = tf.input({ shape: [192, 192, 3], name: "input" });

    // Mock output that returns some basic pose keypoints
    // This simulates a pose with basic keypoints in reasonable positions
    const mockOutput = tf.layers
      .dense({
        units: 51, // 17 keypoints * 3 (x, y, confidence)
        name: "output",
        activation: "sigmoid", // Ensure values are between 0 and 1
      })
      .apply(input);

    // Send debug message to main thread
    if (typeof self !== "undefined" && self.postMessage) {
      self.postMessage({
        type: "debug",
        data: {
          message:
            "🔧 Created realistic mock MoveNet model - will detect basic poses for testing",
        },
      });
    }

    return tf.model({
      inputs: input,
      outputs: mockOutput as tf.SymbolicTensor,
    });
  }

  /**
   * Generates mock poses for testing when the real model is not available
   */
  private generateMockPoses(imageData: ImageData): Pose[] {
    const poses: Pose[] = [];

    // Generate 1-2 mock poses randomly (30% chance of 2 poses)
    const numPoses = Math.random() > 0.7 ? 2 : 1;

    for (let i = 0; i < numPoses; i++) {
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

      // Determine if this pose should be a shooting pose (30% chance)
      const isShootingPose = Math.random() > 0.7;
      const shootingArm = Math.random() > 0.5 ? "right" : "left";

      // Generate keypoints in reasonable positions
      for (let j = 0; j < 17; j++) {
        let x, y, confidence;

        // Position keypoints in reasonable locations based on typical human pose
        switch (j) {
          case 0: // nose
            x = 96 + (Math.random() - 0.5) * 20;
            y = 60 + (Math.random() - 0.5) * 10;
            confidence = 0.8 + Math.random() * 0.2;
            break;
          case 5: // left_shoulder
            x = 80 + (Math.random() - 0.5) * 15;
            y = 80 + (Math.random() - 0.5) * 10;
            confidence = 0.7 + Math.random() * 0.3;
            break;
          case 6: // right_shoulder
            x = 112 + (Math.random() - 0.5) * 15;
            y = 80 + (Math.random() - 0.5) * 10;
            confidence = 0.7 + Math.random() * 0.3;
            break;
          case 7: // left_elbow
            if (isShootingPose && shootingArm === "left") {
              // Shooting pose: elbow higher and more forward
              x = 70 + (Math.random() - 0.5) * 15;
              y = 70 + (Math.random() - 0.5) * 10; // Higher than shoulder
              confidence = 0.8 + Math.random() * 0.2;
            } else {
              // Normal pose: elbow below shoulder
              x = 70 + (Math.random() - 0.5) * 20;
              y = 110 + (Math.random() - 0.5) * 15;
              confidence = 0.6 + Math.random() * 0.3;
            }
            break;
          case 8: // right_elbow
            if (isShootingPose && shootingArm === "right") {
              // Shooting pose: elbow higher and more forward
              x = 122 + (Math.random() - 0.5) * 15;
              y = 70 + (Math.random() - 0.5) * 10; // Higher than shoulder
              confidence = 0.8 + Math.random() * 0.2;
            } else {
              // Normal pose: elbow below shoulder
              x = 122 + (Math.random() - 0.5) * 20;
              y = 110 + (Math.random() - 0.5) * 15;
              confidence = 0.6 + Math.random() * 0.3;
            }
            break;
          case 9: // left_wrist
            if (isShootingPose && shootingArm === "left") {
              // Shooting pose: wrist high and forward (above head level)
              x = 75 + (Math.random() - 0.5) * 20;
              y = 40 + (Math.random() - 0.5) * 15; // Much higher than shoulder
              confidence = 0.8 + Math.random() * 0.2;
            } else {
              // Normal pose: wrist below elbow
              x = 60 + (Math.random() - 0.5) * 25;
              y = 140 + (Math.random() - 0.5) * 20;
              confidence = 0.5 + Math.random() * 0.4;
            }
            break;
          case 10: // right_wrist
            if (isShootingPose && shootingArm === "right") {
              // Shooting pose: wrist high and forward (above head level)
              x = 117 + (Math.random() - 0.5) * 20;
              y = 40 + (Math.random() - 0.5) * 15; // Much higher than shoulder
              confidence = 0.8 + Math.random() * 0.2;
            } else {
              // Normal pose: wrist below elbow
              x = 132 + (Math.random() - 0.5) * 25;
              y = 140 + (Math.random() - 0.5) * 20;
              confidence = 0.5 + Math.random() * 0.4;
            }
            break;
          case 11: // left_hip
            x = 85 + (Math.random() - 0.5) * 15;
            y = 130 + (Math.random() - 0.5) * 10;
            confidence = 0.8 + Math.random() * 0.2;
            break;
          case 12: // right_hip
            x = 107 + (Math.random() - 0.5) * 15;
            y = 130 + (Math.random() - 0.5) * 10;
            confidence = 0.8 + Math.random() * 0.2;
            break;
          default:
            // Other keypoints with lower confidence
            x = 96 + (Math.random() - 0.5) * 40;
            y = 80 + (Math.random() - 0.5) * 60;
            confidence = 0.3 + Math.random() * 0.4;
        }

        keypoints.push({
          x: Math.max(0, Math.min(192, x)),
          y: Math.max(0, Math.min(192, y)),
          confidence,
          name: keypointNames[j],
        });
      }

      const score = Math.min(...keypoints.map((kp) => kp.confidence));
      const bbox = this.calculateBoundingBox(keypoints);

      poses.push({
        keypoints,
        score,
        bbox,
        teamId: i === 0 ? "teamA" : "teamB", // Assign teams for testing
      });
    }

    return poses;
  }

  async estimatePoses(imageData: ImageData): Promise<Pose[]> {
    if (!this.model) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    // If using mock model, generate some realistic poses for testing
    if (this.isMockModel) {
      const mockPoses = this.generateMockPoses(imageData);
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `🔧 Mock model active - generated ${mockPoses.length} test poses`,
          },
        });
      }
      return mockPoses;
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

      // Debug: Log pose estimation results
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `🔍 MoveNet estimated ${poses.length} poses from image`,
          },
        });
      }

      // Apply smoothing if enabled
      if (this.config.enableSmoothing) {
        return this.applySmoothing(poses);
      }

      return poses;
    } catch (error) {
      console.error("Pose estimation failed:", error);

      // Send debug message to main thread
      if (typeof self !== "undefined" && self.postMessage) {
        self.postMessage({
          type: "debug",
          data: {
            message: `❌ Pose estimation failed: ${error}`,
          },
        });
      }

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
