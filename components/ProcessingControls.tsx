"use client";

import { useState } from "react";
import { Play, Settings, Zap } from "lucide-react";

interface ProcessingControlsProps {
  onStartAnalysis: (options: {
    samplingRate: number;
    enableBallDetection: boolean;
    enablePoseEstimation: boolean;
    enable3ptEstimation: boolean;
  }) => void;
  disabled?: boolean;
}

export function ProcessingControls({
  onStartAnalysis,
  disabled = false,
}: ProcessingControlsProps) {
  const [samplingRate, setSamplingRate] = useState(1);
  const [enableBallDetection, setEnableBallDetection] = useState(false);
  const [enablePoseEstimation, setEnablePoseEstimation] = useState(false);
  const [enable3ptEstimation, setEnable3ptEstimation] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleStartAnalysis = () => {
    onStartAnalysis({
      samplingRate,
      enableBallDetection,
      enablePoseEstimation,
      enable3ptEstimation,
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
          Configure the analysis parameters for your video
        </p>
      </div>

      <div className="bg-card border rounded-lg p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Sampling Rate */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Sampling Rate: {samplingRate} FPS
          </label>
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
              enable3ptEstimation
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
                <div>
                  <div className="font-medium">Ball Detection</div>
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
                <div>
                  <div className="font-medium">Pose Estimation</div>
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
                <div>
                  <div className="font-medium">3-Point Estimation</div>
                  <div className="text-xs text-muted-foreground">
                    Detect 3-point shot attempts (experimental)
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
