"use client";

import { CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";

interface ConfidenceBadgeProps {
  confidence: number; // 0-1
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  showLabel = true,
  size = "md",
  className = "",
}: ConfidenceBadgeProps) {
  const getConfidenceLevel = (): "high" | "medium" | "low" => {
    if (confidence >= 0.8) return "high";
    if (confidence >= 0.5) return "medium";
    return "low";
  };

  const level = getConfidenceLevel();

  const styles = {
    high: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-red-100 text-red-800 border-red-200",
  };

  const icons = {
    high: <CheckCircle className="w-3 h-3" />,
    medium: <AlertTriangle className="w-3 h-3" />,
    low: <AlertCircle className="w-3 h-3" />,
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const labels = {
    high: "High",
    medium: "Medium",
    low: "Low",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 border rounded-full ${styles[level]} ${sizeClasses[size]} ${className}`}
      title={`Confidence: ${(confidence * 100).toFixed(0)}%`}
    >
      {icons[level]}
      {showLabel && (
        <span className="font-medium">
          {labels[level]} ({(confidence * 100).toFixed(0)}%)
        </span>
      )}
    </div>
  );
}

/**
 * Helper component for displaying confidence with explanation
 */
export function ConfidenceIndicator({
  confidence,
  source,
  notes,
}: {
  confidence: number;
  source?: string;
  notes?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <ConfidenceBadge confidence={confidence} />
      {(source || notes) && (
        <div className="text-xs text-muted-foreground">
          {source && <div>Source: {source}</div>}
          {notes && <div>{notes}</div>}
        </div>
      )}
    </div>
  );
}
