"use client";

import { useCallback, useState } from "react";
import { Upload, FileVideo, AlertCircle } from "lucide-react";
import type { VideoFile } from "@/types";

interface VideoUploaderProps {
  onVideoSelect: (file: File) => void;
}

export function VideoUploader({ onVideoSelect }: VideoUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!file.type.startsWith("video/")) {
      return "Please select a video file";
    }

    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      return "File size must be less than 500MB";
    }

    // Check if it's MP4
    if (!file.type.includes("mp4")) {
      return "Please select an MP4 video file for best compatibility";
    }

    return null;
  }, []);

  const handleFileSelect = useCallback(
    (file: File) => {
      setError(null);
      const validationError = validateFile(file);

      if (validationError) {
        setError(validationError);
        return;
      }

      onVideoSelect(file);
    },
    [onVideoSelect, validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 sm:p-6 lg:p-8 text-center transition-colors
          ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
          ${error ? "border-destructive" : ""}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept="video/mp4,video/quicktime"
          onChange={handleFileInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="space-y-3 sm:space-y-4">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center">
            <FileVideo className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              Upload Basketball Video
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4 px-2">
              Drag and drop your video file here, or click to browse
            </p>
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>MP4 files up to 500MB</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-muted/50 rounded-lg">
        <h4 className="font-medium mb-2 text-sm sm:text-base">
          Recommended Video Quality:
        </h4>
        <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
          <li>• Resolution: 720p or higher</li>
          <li>• Clear, steady footage (avoid shaky camera)</li>
          <li>• Good lighting conditions</li>
          <li>• Visible scoreboard in the frame</li>
          <li>• Duration: 2-10 minutes for best results</li>
        </ul>
      </div>
    </div>
  );
}
