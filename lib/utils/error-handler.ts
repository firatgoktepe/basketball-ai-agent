/**
 * Centralized Error Handling Utilities
 *
 * Provides consistent error handling, logging, and user-friendly error messages
 * across the Basketball Quick Stats application.
 */

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  severity: "low" | "medium" | "high" | "critical";
  context?: Record<string, any>;
  timestamp: Date;
  stack?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log an error
   */
  handleError(
    error: Error | AppError,
    context?: Record<string, any>
  ): AppError {
    const appError = this.normalizeError(error, context);
    this.logError(appError);
    return appError;
  }

  /**
   * Convert any error to AppError format
   */
  private normalizeError(
    error: Error | AppError,
    context?: Record<string, any>
  ): AppError {
    if (this.isAppError(error)) {
      return error;
    }

    // Map common error types to user-friendly messages
    const errorMap = this.getErrorMap();
    const errorType = this.classifyError(error);
    const mapping = errorMap[errorType] || errorMap.unknown;

    return {
      code: errorType,
      message: error.message,
      userMessage: mapping.userMessage,
      severity: mapping.severity,
      context: { ...context, originalError: error.name },
      timestamp: new Date(),
      stack: error.stack,
    };
  }

  /**
   * Check if error is already an AppError
   */
  private isAppError(error: any): error is AppError {
    return (
      error &&
      typeof error === "object" &&
      "code" in error &&
      "userMessage" in error
    );
  }

  /**
   * Classify error type based on error message and properties
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Video/Media errors
    if (
      message.includes("video") ||
      message.includes("media") ||
      name.includes("media")
    ) {
      return "video_error";
    }

    // Network/API errors
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      name.includes("network")
    ) {
      return "network_error";
    }

    // Worker errors
    if (message.includes("worker") || name.includes("worker")) {
      return "worker_error";
    }

    // Model loading errors
    if (
      message.includes("model") ||
      message.includes("tensorflow") ||
      message.includes("onnx")
    ) {
      return "model_error";
    }

    // OCR errors
    if (message.includes("ocr") || message.includes("tesseract")) {
      return "ocr_error";
    }

    // Permission errors
    if (message.includes("permission") || message.includes("denied")) {
      return "permission_error";
    }

    // Memory errors
    if (message.includes("memory") || message.includes("quota")) {
      return "memory_error";
    }

    return "unknown";
  }

  /**
   * Get error mapping configuration
   */
  private getErrorMap(): Record<
    string,
    { userMessage: string; severity: AppError["severity"] }
  > {
    return {
      video_error: {
        userMessage:
          "There was a problem with the video file. Please try a different video or check the file format.",
        severity: "medium",
      },
      network_error: {
        userMessage:
          "Network connection issue. Please check your internet connection and try again.",
        severity: "medium",
      },
      worker_error: {
        userMessage:
          "Processing error occurred. Please refresh the page and try again.",
        severity: "high",
      },
      model_error: {
        userMessage:
          "AI model failed to load. Please refresh the page or try again later.",
        severity: "high",
      },
      ocr_error: {
        userMessage:
          "Scoreboard reading failed. Please ensure the scoreboard is clearly visible and try again.",
        severity: "medium",
      },
      permission_error: {
        userMessage:
          "Permission denied. Please allow the required permissions and try again.",
        severity: "medium",
      },
      memory_error: {
        userMessage:
          "Not enough memory to process this video. Please try a shorter video or close other browser tabs.",
        severity: "high",
      },
      unknown: {
        userMessage:
          "An unexpected error occurred. Please try again or contact support if the problem persists.",
        severity: "medium",
      },
    };
  }

  /**
   * Log error to console and internal log
   */
  private logError(error: AppError): void {
    // Add to internal log (keep last 100 errors)
    this.errorLog.push(error);
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    // Console logging based on severity
    const logData = {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      context: error.context,
      timestamp: error.timestamp.toISOString(),
    };

    switch (error.severity) {
      case "critical":
        console.error("🚨 CRITICAL ERROR:", logData);
        break;
      case "high":
        console.error("❌ HIGH SEVERITY ERROR:", logData);
        break;
      case "medium":
        console.warn("⚠️ MEDIUM SEVERITY ERROR:", logData);
        break;
      case "low":
        console.info("ℹ️ LOW SEVERITY ERROR:", logData);
        break;
    }

    // In production, you might want to send errors to a monitoring service
    if (
      process.env.NODE_ENV === "production" &&
      error.severity === "critical"
    ) {
      this.reportToMonitoringService(error);
    }
  }

  /**
   * Report critical errors to monitoring service (placeholder)
   */
  private reportToMonitoringService(error: AppError): void {
    // Placeholder for external error reporting
    // In a real app, you might use Sentry, Bugsnag, or similar
    console.log("Reporting to monitoring service:", error.code);
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(count: number = 10): AppError[] {
    return this.errorLog.slice(-count);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<AppError["severity"], number>;
    byCode: Record<string, number>;
  } {
    const stats = {
      total: this.errorLog.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<
        AppError["severity"],
        number
      >,
      byCode: {} as Record<string, number>,
    };

    this.errorLog.forEach((error) => {
      stats.bySeverity[error.severity]++;
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
    });

    return stats;
  }
}

/**
 * Convenience function to handle errors
 */
export function handleError(
  error: Error | AppError,
  context?: Record<string, any>
): AppError {
  return ErrorHandler.getInstance().handleError(error, context);
}

/**
 * Create a recovery action for common error scenarios
 */
export interface RecoveryAction {
  label: string;
  action: () => void | Promise<void>;
  primary?: boolean;
}

export function getRecoveryActions(errorCode: string): RecoveryAction[] {
  const actions: Record<string, RecoveryAction[]> = {
    video_error: [
      {
        label: "Try Different Video",
        action: () => window.location.reload(),
        primary: true,
      },
      {
        label: "Check File Format",
        action: () => {
          alert(
            "Supported formats: MP4, WebM, MOV. File size should be under 500MB."
          );
        },
      },
    ],
    network_error: [
      {
        label: "Retry",
        action: () => window.location.reload(),
        primary: true,
      },
      {
        label: "Check Connection",
        action: () => {
          window.open("https://www.google.com", "_blank");
        },
      },
    ],
    worker_error: [
      {
        label: "Refresh Page",
        action: () => window.location.reload(),
        primary: true,
      },
    ],
    model_error: [
      {
        label: "Refresh Page",
        action: () => window.location.reload(),
        primary: true,
      },
      {
        label: "Try Later",
        action: () => {
          alert(
            "The AI models may be temporarily unavailable. Please try again in a few minutes."
          );
        },
      },
    ],
    memory_error: [
      {
        label: "Close Other Tabs",
        action: () => {
          alert(
            "Please close other browser tabs and try again with a shorter video."
          );
        },
        primary: true,
      },
      {
        label: "Use Smaller Video",
        action: () => {
          alert(
            "Try using a video that is 2-5 minutes long for better performance."
          );
        },
      },
    ],
  };

  return (
    actions[errorCode] || [
      {
        label: "Refresh Page",
        action: () => window.location.reload(),
        primary: true,
      },
    ]
  );
}

/**
 * Hook for React components to handle errors consistently
 */
export function useErrorHandler() {
  const errorHandler = ErrorHandler.getInstance();

  return {
    handleError: (error: Error | AppError, context?: Record<string, any>) => {
      return errorHandler.handleError(error, context);
    },
    getRecentErrors: () => errorHandler.getRecentErrors(),
    getErrorStats: () => errorHandler.getErrorStats(),
    clearErrors: () => errorHandler.clearErrorLog(),
  };
}
