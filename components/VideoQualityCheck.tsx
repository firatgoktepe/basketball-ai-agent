"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { HelpText } from "@/components/ui/HelpText";

interface QualityCheckResult {
  resolution: "good" | "moderate" | "poor";
  fileSize: "good" | "moderate" | "poor";
  format: "good" | "poor";
  overall: "excellent" | "good" | "moderate" | "poor";
  warnings: string[];
  recommendations: string[];
}

interface VideoQualityCheckProps {
  videoElement: HTMLVideoElement | null;
  fileSize: number;
  fileName: string;
}

export function VideoQualityCheck({
  videoElement,
  fileSize,
  fileName,
}: VideoQualityCheckProps) {
  const [qualityCheck, setQualityCheck] = useState<QualityCheckResult | null>(
    null
  );

  useEffect(() => {
    if (!videoElement) return;

    const checkQuality = () => {
      const warnings: string[] = [];
      const recommendations: string[] = [];

      // Check resolution
      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;
      let resolutionQuality: "good" | "moderate" | "poor" = "good";

      if (height < 480) {
        resolutionQuality = "poor";
        warnings.push("Resolution is below 480p");
        recommendations.push(
          "Use at least 720p resolution for better detection accuracy"
        );
      } else if (height < 720) {
        resolutionQuality = "moderate";
        warnings.push("Resolution is below 720p");
      }

      // Check file size (estimate bitrate)
      const duration = videoElement.duration;
      const bitrate = (fileSize * 8) / duration / 1000000; // Mbps
      let fileSizeQuality: "good" | "moderate" | "poor" = "good";

      if (bitrate < 2) {
        fileSizeQuality = "poor";
        warnings.push("Video bitrate is low (< 2 Mbps)");
        recommendations.push("Use higher quality video encoding");
      } else if (bitrate < 5) {
        fileSizeQuality = "moderate";
      }

      // Check format
      const formatQuality = fileName.toLowerCase().endsWith(".mp4")
        ? "good"
        : "poor";
      if (formatQuality === "poor") {
        warnings.push("Video format is not MP4");
        recommendations.push(
          "Convert video to MP4 format for best compatibility"
        );
      }

      // Overall quality
      let overall: "excellent" | "good" | "moderate" | "poor" = "excellent";
      if (
        resolutionQuality === "poor" ||
        fileSizeQuality === "poor" ||
        formatQuality === "poor"
      ) {
        overall = "poor";
      } else if (
        resolutionQuality === "moderate" ||
        fileSizeQuality === "moderate"
      ) {
        overall = "moderate";
      } else if (warnings.length === 0) {
        overall = "excellent";
      } else {
        overall = "good";
      }

      // Add general recommendations
      if (overall !== "excellent") {
        recommendations.push(
          "Consider using broadcast-quality footage or steady amateur recordings"
        );
      }

      setQualityCheck({
        resolution: resolutionQuality,
        fileSize: fileSizeQuality,
        format: formatQuality,
        overall,
        warnings,
        recommendations,
      });
    };

    if (videoElement.readyState >= 2) {
      checkQuality();
    } else {
      videoElement.addEventListener("loadedmetadata", checkQuality);
      return () =>
        videoElement.removeEventListener("loadedmetadata", checkQuality);
    }
  }, [videoElement, fileSize, fileName]);

  if (!qualityCheck) return null;

  const getOverallIcon = () => {
    switch (qualityCheck.overall) {
      case "excellent":
      case "good":
        return <CheckCircle className="w-5 h-5" />;
      case "moderate":
        return <AlertTriangle className="w-5 h-5" />;
      case "poor":
        return <XCircle className="w-5 h-5" />;
    }
  };

  const getVariant = (): "success" | "warning" | "error" => {
    switch (qualityCheck.overall) {
      case "excellent":
      case "good":
        return "success";
      case "moderate":
        return "warning";
      case "poor":
        return "error";
    }
  };

  return (
    <div className="space-y-3">
      <HelpText variant={getVariant()}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium">
            {getOverallIcon()}
            <span>
              Video Quality:{" "}
              {qualityCheck.overall.charAt(0).toUpperCase() +
                qualityCheck.overall.slice(1)}
            </span>
          </div>

          {qualityCheck.warnings.length > 0 && (
            <div className="pl-7">
              <p className="font-medium mb-1">Issues detected:</p>
              <ul className="space-y-1">
                {qualityCheck.warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {qualityCheck.recommendations.length > 0 && (
            <div className="pl-7">
              <p className="font-medium mb-1">Recommendations:</p>
              <ul className="space-y-1">
                {qualityCheck.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-xs">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </HelpText>

      {qualityCheck.overall === "poor" && (
        <HelpText variant="warning">
          <strong>Proceed with caution:</strong> The video quality is below
          recommended standards. Detection accuracy may be significantly
          reduced. Consider using higher quality footage for better results.
        </HelpText>
      )}
    </div>
  );
}
