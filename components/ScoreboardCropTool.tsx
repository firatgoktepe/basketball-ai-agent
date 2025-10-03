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
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!overlayRef.current || !videoElement) return { x: 0, y: 0 };

      const rect = overlayRef.current.getBoundingClientRect();
      const videoRect = videoElement.getBoundingClientRect();

      // Get coordinates from either mouse or touch event
      let clientX: number, clientY: number;

      if ("touches" in e && e.touches.length > 0) {
        // Touch event
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        // Mouse event
        const mouseEvent = e as React.MouseEvent;
        clientX = mouseEvent.clientX;
        clientY = mouseEvent.clientY;
      }

      // Calculate position relative to video element
      const x = clientX - videoRect.left;
      const y = clientY - videoRect.top;

      // Ensure coordinates are within video bounds
      const clampedX = Math.max(0, Math.min(x, videoRect.width));
      const clampedY = Math.max(0, Math.min(y, videoRect.height));

      return { x: clampedX, y: clampedY };
    },
    [videoElement]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isActive || !videoElement) return;

      e.preventDefault();
      const pos = getRelativePosition(e);
      setStartPoint(pos);
      setCurrentPoint(pos);
      setIsDrawing(true);
    },
    [isActive, videoElement, getRelativePosition]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !startPoint) return;

      e.preventDefault();
      const pos = getRelativePosition(e);
      setCurrentPoint(pos);
    },
    [isDrawing, startPoint, getRelativePosition]
  );

  const handleEnd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !startPoint || !currentPoint) return;

      e.preventDefault();
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
    },
    [isDrawing, startPoint, currentPoint, onCropRegionChange]
  );

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
          absolute top-4 right-4 z-20 p-3 rounded-lg transition-all duration-200 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center
          ${
            isActive
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-white/90 text-gray-700 hover:bg-white active:bg-white shadow-md"
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
          className="absolute inset-0 z-10 cursor-crosshair touch-none select-none"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={() => setIsDrawing(false)}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onTouchCancel={() => setIsDrawing(false)}
        >
          {/* Instructions */}
          <div className="absolute top-4 left-4 bg-black/80 text-white p-3 rounded-lg text-sm max-w-xs">
            <p className="font-medium mb-1">Scoreboard Crop Tool</p>
            <p className="text-gray-300">
              {isDrawing
                ? "Drag to select the scoreboard region"
                : "Touch and drag to select the scoreboard region"}
            </p>
          </div>

          {/* Current crop rectangle */}
          {currentRect && (
            <div
              className={`absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none transition-all duration-150 ${
                isDrawing ? "border-blue-400 bg-blue-400/30" : ""
              }`}
              style={{
                left: currentRect.x,
                top: currentRect.y,
                width: currentRect.width,
                height: currentRect.height,
              }}
            >
              {/* Corner handles - larger for mobile */}
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
              <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
            </div>
          )}

          {/* Action buttons */}
          {cropRegion && (
            <div className="absolute bottom-4 left-4 flex gap-3">
              <button
                onClick={handleClear}
                className="hidden md:flex bg-red-600 hover:bg-red-700 active:bg-red-800 text-white p-3 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] items-center justify-center"
                title="Clear selection"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={handleConfirm}
                className="hidden md:flex bg-green-600 hover:bg-green-700 active:bg-green-800 text-white p-3 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] items-center justify-center"
                title="Confirm selection"
              >
                <Check className="w-5 h-5" />
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
