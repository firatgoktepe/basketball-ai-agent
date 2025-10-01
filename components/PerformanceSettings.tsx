"use client";

import { useEffect, useState } from "react";
import { Zap, Monitor, Cpu } from "lucide-react";
import {
  performanceMonitor,
  type PerformanceMetrics,
} from "@/lib/utils/performance-monitor";
import { HelpText } from "@/components/ui/HelpText";

interface PerformanceSettingsProps {
  onRecommendedSettingsDetected?: (settings: {
    samplingRate: 1 | 2 | 3;
    enableAdvancedFeatures: boolean;
  }) => void;
}

export function PerformanceSettings({
  onRecommendedSettingsDetected,
}: PerformanceSettingsProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const detectCapabilities = async () => {
      try {
        const detectedMetrics = await performanceMonitor.detectCapabilities();
        setMetrics(detectedMetrics);

        // Notify parent of recommended settings
        onRecommendedSettingsDetected?.({
          samplingRate: detectedMetrics.recommendedSamplingRate,
          enableAdvancedFeatures: detectedMetrics.shouldEnableAdvancedFeatures,
        });
      } catch (error) {
        console.error("Failed to detect capabilities:", error);
      } finally {
        setIsLoading(false);
      }
    };

    detectCapabilities();
  }, [onRecommendedSettingsDetected]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Cpu className="w-4 h-4 animate-spin" />
        <span>Detecting device capabilities...</span>
      </div>
    );
  }

  if (!metrics) return null;

  const getCapabilityColor = () => {
    switch (metrics.estimatedDeviceCapability) {
      case "high":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-red-600";
    }
  };

  const getCapabilityLabel = () => {
    switch (metrics.estimatedDeviceCapability) {
      case "high":
        return "High Performance";
      case "medium":
        return "Moderate Performance";
      case "low":
        return "Limited Performance";
    }
  };

  return (
    <div className="space-y-3">
      <HelpText variant="info">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            <span className="font-medium">Device Capabilities Detected</span>
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span>Performance Level:</span>
              <span className={`font-medium ${getCapabilityColor()}`}>
                {getCapabilityLabel()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>WebGPU Support:</span>
              <span className="font-medium">
                {metrics.isWebGPUAvailable ? "✓ Available" : "✗ Not Available"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Recommended Sampling Rate:</span>
              <span className="font-medium">
                {metrics.recommendedSamplingRate} FPS
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Advanced Features:</span>
              <span className="font-medium">
                {metrics.shouldEnableAdvancedFeatures
                  ? "✓ Recommended"
                  : "Not Recommended"}
              </span>
            </div>
          </div>
        </div>
      </HelpText>

      {metrics.estimatedDeviceCapability === "low" && (
        <HelpText variant="warning">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong>Limited Device Performance:</strong> Your device may
              struggle with advanced features. We recommend using 1 FPS sampling
              rate and disabling optional features for smoother processing.
            </div>
          </div>
        </HelpText>
      )}

      {!metrics.isWebGPUAvailable &&
        metrics.estimatedDeviceCapability !== "low" && (
          <HelpText variant="info">
            <div className="text-xs">
              <strong>WebGPU not available:</strong> Advanced ball detection
              will use WebAssembly fallback, which is slower but still
              functional. Consider using a Chromium-based browser for better
              performance.
            </div>
          </HelpText>
        )}
    </div>
  );
}
