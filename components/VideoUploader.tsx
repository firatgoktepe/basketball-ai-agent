"use client";

import { useCallback, useState } from "react";
import { Upload, FileVideo, AlertCircle } from "lucide-react";
import type { VideoFile } from "@/types";
import { Tooltip } from "@/components/ui/Tooltip";
import { HelpText } from "@/components/ui/HelpText";

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

    // Check for common video formats
    const supportedTypes = ["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv"];
    const fileExtension = file.name.toLowerCase().split(".").pop();
    const isSupportedType =
      supportedTypes.includes(fileExtension || "") ||
      file.type.includes("mp4") ||
      file.type.includes("webm") ||
      file.type.includes("quicktime") ||
      file.type.includes("avi");

    if (!isSupportedType) {
      return "Please select a supported video file (MP4, WebM, MOV, AVI, etc.)";
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
          accept="video/mp4,video/quicktime,video/webm,video/avi,video/x-msvideo,video/mkv,video/x-matroska,video/x-ms-wmv,video/x-flv"
          onChange={handleFileInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="space-y-3 sm:space-y-4">
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center">
            <FileVideo className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-2">
              Upload Amateur Basketball Video
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4 px-2">
              Drag and drop your amateur game video here, or click to browse
            </p>
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Upload className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Video files up to 500MB (MP4, WebM, MOV, AVI, etc.)</span>
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

      <HelpText variant="info" className="mt-4 sm:mt-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-sm sm:text-base">
              Recommended Video Quality
            </h4>
            <Tooltip
              content="Following these guidelines ensures the best accuracy for automatic detection. Lower quality footage may still work but with reduced accuracy."
              icon="help"
            />
          </div>
          <ul className="text-xs sm:text-sm space-y-1">
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                <strong>Resolution:</strong> 1080p recommended (720p minimum)
                for jersey detection
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                <strong>Camera:</strong> Use tripod or stable mount showing full
                court
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                <strong>Hoop Visibility:</strong> Basketball hoop must be
                clearly visible for score detection
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                <strong>Lighting:</strong> Good lighting helps player and jersey
                recognition
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>
                <strong>Duration:</strong> 2-10 minutes optimal for processing
                time
              </span>
            </li>
          </ul>
        </div>
      </HelpText>
    </div>
  );
}
