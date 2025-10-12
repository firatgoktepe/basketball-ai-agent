"use client";

import { useState } from "react";
import { Play, Settings, Zap } from "lucide-react";
import { Tooltip, LabelWithTooltip } from "@/components/ui/Tooltip";
import { HelpText } from "@/components/ui/HelpText";

interface ProcessingControlsProps {
  onStartAnalysis: (options: {
    samplingRate: number;
    enableBallDetection: boolean;
    enablePoseEstimation: boolean;
    enable3ptEstimation: boolean;
    enableJerseyNumberDetection?: boolean;
    forceMockPoseModel?: boolean;
  }) => void;
  disabled?: boolean;
}

export function ProcessingControls({
  onStartAnalysis,
  disabled = false,
}: ProcessingControlsProps) {
  const [samplingRate, setSamplingRate] = useState(1);
  const [enableBallDetection, setEnableBallDetection] = useState(true); // Default true for amateur videos
  const [enablePoseEstimation, setEnablePoseEstimation] = useState(true); // Default true for amateur videos
  const [enable3ptEstimation, setEnable3ptEstimation] = useState(false);
  const [enableJerseyNumberDetection, setEnableJerseyNumberDetection] =
    useState(true); // Default true for player tracking
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [forceMockPoseModel, setForceMockPoseModel] = useState(false);

  const handleStartAnalysis = () => {
    onStartAnalysis({
      samplingRate,
      enableBallDetection,
      enablePoseEstimation,
      enable3ptEstimation,
      enableJerseyNumberDetection,
      forceMockPoseModel,
    });
  };

  const getEstimatedTime = () => {
    // Rough estimation: 1fps = 1 minute per minute of video
    // Higher sampling rates and advanced features increase processing time
    const baseTime = samplingRate;
    const advancedMultiplier =
      enableBallDetection || enablePoseEstimation ? 2 : 1;
    return Math.round(baseTime * advancedMultiplier);
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="text-center">
        <h3 className="text-lg sm:text-xl font-semibold mb-2">
          Analysis Settings
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground px-4">
          Configure detection and tracking options for amateur basketball video
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Sampling Rate */}
        <div>
          <LabelWithTooltip
            label={`Sampling Rate: ${samplingRate} FPS`}
            tooltip="Higher frame rates (FPS) provide more accurate detection but increase processing time. 1 FPS is recommended for most videos."
            className="mb-3"
          />
          <div className="space-y-2">
            <input
              type="range"
              min="1"
              max="3"
              value={samplingRate}
              onChange={(e) => setSamplingRate(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="hidden sm:inline">1 FPS (Faster)</span>
              <span className="sm:hidden">1 FPS</span>
              <span className="hidden sm:inline">2 FPS (Balanced)</span>
              <span className="sm:hidden">2 FPS</span>
              <span className="hidden sm:inline">3 FPS (More Accurate)</span>
              <span className="sm:hidden">3 FPS</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Higher sampling rates provide more accurate results but take longer
            to process
          </p>
        </div>

        {/* Advanced Features Toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Advanced Features
            <span className="text-xs text-muted-foreground">
              (
              {enableBallDetection ||
              enablePoseEstimation ||
              enable3ptEstimation ||
              enableJerseyNumberDetection
                ? "Enabled"
                : "Disabled"}
              )
            </span>
          </button>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableBallDetection}
                  onChange={(e) => setEnableBallDetection(e.target.checked)}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Ball Detection</span>
                    <Tooltip
                      content="Uses computer vision to track the ball position and movement. Requires WebGPU support for optimal performance. Increases processing time by ~2x."
                      icon="help"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Track ball movement for more accurate shot and rebound
                    detection
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePoseEstimation}
                  onChange={(e) => setEnablePoseEstimation(e.target.checked)}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Pose Estimation</span>
                    <Tooltip
                      content="Analyzes player body poses to detect shooting motions. Improves shot attempt detection accuracy but adds processing overhead."
                      icon="help"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Analyze player movements for shot attempt detection
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enable3ptEstimation}
                  onChange={(e) => setEnable3ptEstimation(e.target.checked)}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">3-Point Line Detection</span>
                    <Tooltip
                      content="Uses camera calibration to detect the 3-point line and distinguish 2-point from 3-point shots. Requires clear court view and stable camera angle."
                      icon="help"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Detect 3-point line for accurate shot classification
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableJerseyNumberDetection}
                  onChange={(e) =>
                    setEnableJerseyNumberDetection(e.target.checked)
                  }
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Jersey Number Detection</span>
                    <Tooltip
                      content="Identifies player jersey numbers for per-player statistics and tracking. Uses OCR on jersey regions with motion-based re-identification when OCR fails."
                      icon="help"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Track individual players by jersey number
                  </div>
                </div>
              </label>

              {/* Debug option for mock pose model */}
              <label className="flex items-center gap-3 cursor-pointer opacity-60">
                <input
                  type="checkbox"
                  checked={forceMockPoseModel}
                  onChange={(e) => setForceMockPoseModel(e.target.checked)}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      Debug: Force Mock Pose Model
                    </span>
                    <Tooltip
                      content="Force using mock pose detection for testing. This will generate fake poses instead of using the real MoveNet model. Only use for debugging."
                      icon="help"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Use mock pose detection for testing (debug only)
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Performance Warning */}
        {(enableBallDetection || enablePoseEstimation) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Performance Notice</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Advanced features will significantly increase processing time.
              Estimated time: ~{getEstimatedTime()}x video duration.
            </p>
          </div>
        )}

        {/* Start Analysis Button */}
        <div className="pt-2 sm:pt-4">
          <button
            onClick={handleStartAnalysis}
            disabled={disabled}
            className="w-full py-3 sm:py-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
          >
            <Play className="w-4 h-4 sm:w-5 sm:h-5" />
            Start Analysis
          </button>

          <p className="text-xs text-muted-foreground text-center mt-2 px-2">
            Estimated processing time: ~{getEstimatedTime()}x video duration
          </p>
        </div>
      </div>
    </div>
  );
}
