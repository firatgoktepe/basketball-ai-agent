"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Crop, X, Check } from "lucide-react";
import type { CropRegion } from "@/types";

interface ScoreboardCropToolProps {
  videoElement: HTMLVideoElement | null;
  onCropRegionChange: (region: CropRegion | null) => void;
  isActive: boolean;
  onToggle: () => void;
}

export function ScoreboardCropTool({
  videoElement,
  onCropRegionChange,
  isActive,
  onToggle,
}: ScoreboardCropToolProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentPoint, setCurrentPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const getRelativePosition = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current || !videoElement) return { x: 0, y: 0 };

      const rect = overlayRef.current.getBoundingClientRect();
      const videoRect = videoElement.getBoundingClientRect();

      // Calculate position relative to video element
      const x = e.clientX - videoRect.left;
      const y = e.clientY - videoRect.top;

      // Ensure coordinates are within video bounds
      const clampedX = Math.max(0, Math.min(x, videoRect.width));
      const clampedY = Math.max(0, Math.min(y, videoRect.height));

      return { x: clampedX, y: clampedY };
    },
    [videoElement]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !videoElement) return;

      e.preventDefault();
      const pos = getRelativePosition(e);
      setStartPoint(pos);
      setCurrentPoint(pos);
      setIsDrawing(true);
    },
    [isActive, videoElement, getRelativePosition]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !startPoint) return;

      const pos = getRelativePosition(e);
      setCurrentPoint(pos);
    },
    [isDrawing, startPoint, getRelativePosition]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !startPoint || !currentPoint) return;

    setIsDrawing(false);

    // Calculate crop region
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    // Only create crop region if it's large enough
    if (width > 10 && height > 10) {
      const newCropRegion: CropRegion = { x, y, width, height };
      setCropRegion(newCropRegion);
      onCropRegionChange(newCropRegion);
    }

    setStartPoint(null);
    setCurrentPoint(null);
  }, [isDrawing, startPoint, currentPoint, onCropRegionChange]);

  const handleClear = useCallback(() => {
    setCropRegion(null);
    setStartPoint(null);
    setCurrentPoint(null);
    setIsDrawing(false);
    onCropRegionChange(null);
  }, [onCropRegionChange]);

  const handleConfirm = useCallback(() => {
    if (cropRegion) {
      onToggle(); // Close the crop tool
    }
  }, [cropRegion, onToggle]);

  // Calculate current crop rectangle
  const getCropRect = () => {
    if (isDrawing && startPoint && currentPoint) {
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(currentPoint.x - startPoint.x);
      const height = Math.abs(currentPoint.y - startPoint.y);
      return { x, y, width, height };
    }
    return cropRegion;
  };

  const currentRect = getCropRect();

  return (
    <>
      {/* Crop Tool Button */}
      <button
        onClick={onToggle}
        className={`
          absolute top-4 right-4 z-20 p-2 rounded-lg transition-all duration-200
          ${
            isActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-white/90 text-gray-700 hover:bg-white shadow-md"
          }
        `}
        title={isActive ? "Exit crop mode" : "Crop scoreboard region"}
      >
        <Crop className="w-5 h-5" />
      </button>

      {/* Crop Overlay */}
      {isActive && videoElement && (
        <div
          ref={overlayRef}
          className="absolute inset-0 z-10 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDrawing(false)}
        >
          {/* Instructions */}
          <div className="absolute top-4 left-4 bg-black/80 text-white p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Scoreboard Crop Tool</p>
            <p className="text-gray-300">
              {isDrawing
                ? "Drag to select the scoreboard region"
                : "Click and drag to select the scoreboard region"}
            </p>
          </div>

          {/* Current crop rectangle */}
          {currentRect && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
              style={{
                left: currentRect.x,
                top: currentRect.y,
                width: currentRect.width,
                height: currentRect.height,
              }}
            >
              {/* Corner handles */}
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
            </div>
          )}

          {/* Action buttons */}
          {cropRegion && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              <button
                onClick={handleClear}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleConfirm}
                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
                title="Confirm selection"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Crop region info */}
          {cropRegion && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white p-2 rounded-lg text-sm">
              <p>
                Scoreboard Region: {Math.round(cropRegion.width)}×
                {Math.round(cropRegion.height)}
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
