/**
 * Performance Monitoring Utilities
 *
 * Monitors application performance and provides recommendations
 * for optimal settings based on device capabilities
 */

export interface PerformanceMetrics {
  isWebGPUAvailable: boolean;
  isWebAssemblyAvailable: boolean;
  estimatedDeviceCapability: "high" | "medium" | "low";
  recommendedSamplingRate: 1 | 2 | 3;
  shouldEnableAdvancedFeatures: boolean;
  memoryInfo?: {
    totalJSHeapSize?: number;
    usedJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  };
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics | null = null;

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Detect device capabilities and compute recommendations
   */
  async detectCapabilities(): Promise<PerformanceMetrics> {
    if (this.metrics) return this.metrics;

    // Check WebGPU availability
    const isWebGPUAvailable = await this.checkWebGPU();

    // Check WebAssembly
    const isWebAssemblyAvailable = this.checkWebAssembly();

    // Estimate device capability
    const estimatedDeviceCapability = this.estimateDeviceCapability();

    // Compute recommendations
    let recommendedSamplingRate: 1 | 2 | 3 = 1;
    let shouldEnableAdvancedFeatures = false;

    if (estimatedDeviceCapability === "high") {
      recommendedSamplingRate = 2;
      shouldEnableAdvancedFeatures = isWebGPUAvailable;
    } else if (estimatedDeviceCapability === "medium") {
      recommendedSamplingRate = 1;
      shouldEnableAdvancedFeatures = false;
    } else {
      recommendedSamplingRate = 1;
      shouldEnableAdvancedFeatures = false;
    }

    // Get memory info if available
    const memoryInfo = this.getMemoryInfo();

    this.metrics = {
      isWebGPUAvailable,
      isWebAssemblyAvailable,
      estimatedDeviceCapability,
      recommendedSamplingRate,
      shouldEnableAdvancedFeatures,
      memoryInfo,
    };

    return this.metrics;
  }

  /**
   * Check if WebGPU is available
   */
  private async checkWebGPU(): Promise<boolean> {
    if (typeof navigator === "undefined") return false;

    try {
      // @ts-ignore - WebGPU is experimental
      if (!navigator.gpu) return false;

      // @ts-ignore
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Check if WebAssembly is available
   */
  private checkWebAssembly(): boolean {
    if (typeof WebAssembly === "undefined") return false;
    return true;
  }

  /**
   * Estimate device capability based on hardware concurrency and memory
   */
  private estimateDeviceCapability(): "high" | "medium" | "low" {
    if (typeof navigator === "undefined") return "medium";

    const cores = navigator.hardwareConcurrency || 4;
    const memoryInfo = this.getMemoryInfo();

    // High-end device: 8+ cores, 8GB+ memory
    if (cores >= 8) {
      if (
        memoryInfo &&
        memoryInfo.jsHeapSizeLimit &&
        memoryInfo.jsHeapSizeLimit > 4 * 1024 * 1024 * 1024
      ) {
        return "high";
      }
      return "medium";
    }

    // Low-end device: < 4 cores
    if (cores < 4) {
      return "low";
    }

    return "medium";
  }

  /**
   * Get memory information if available
   */
  private getMemoryInfo() {
    if (typeof performance === "undefined") return undefined;

    // @ts-ignore - memory is non-standard
    const memory = performance.memory;
    if (!memory) return undefined;

    return {
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
  }

  /**
   * Monitor frame processing time and adjust settings if needed
   */
  monitorFrameProcessing(
    frameProcessingTimes: number[],
    targetTime: number = 500
  ): {
    isWithinBudget: boolean;
    avgProcessingTime: number;
    recommendation: string | null;
  } {
    if (frameProcessingTimes.length === 0) {
      return {
        isWithinBudget: true,
        avgProcessingTime: 0,
        recommendation: null,
      };
    }

    const avgProcessingTime =
      frameProcessingTimes.reduce((sum, time) => sum + time, 0) /
      frameProcessingTimes.length;

    const isWithinBudget = avgProcessingTime <= targetTime;

    let recommendation: string | null = null;
    if (!isWithinBudget) {
      if (avgProcessingTime > targetTime * 2) {
        recommendation =
          "Processing is very slow. Consider reducing sampling rate or disabling advanced features.";
      } else {
        recommendation =
          "Processing is slower than optimal. Consider reducing advanced features.";
      }
    }

    return {
      isWithinBudget,
      avgProcessingTime,
      recommendation,
    };
  }

  /**
   * Get performance recommendations as user-friendly text
   */
  getRecommendationsText(): string[] {
    if (!this.metrics) return [];

    const recommendations: string[] = [];

    if (this.metrics.estimatedDeviceCapability === "low") {
      recommendations.push(
        "Your device has limited processing power. Use 1 FPS sampling and disable advanced features for best performance."
      );
    }

    if (this.metrics.estimatedDeviceCapability === "medium") {
      recommendations.push(
        "Your device has moderate processing power. 1-2 FPS sampling is recommended."
      );
    }

    if (
      this.metrics.estimatedDeviceCapability === "high" &&
      this.metrics.isWebGPUAvailable
    ) {
      recommendations.push(
        "Your device supports WebGPU acceleration! Advanced features will run efficiently."
      );
    }

    if (!this.metrics.isWebGPUAvailable) {
      recommendations.push(
        "WebGPU is not available. Advanced ball detection will use WASM fallback (slower)."
      );
    }

    return recommendations;
  }
}

/**
 * Singleton instance
 */
export const performanceMonitor = PerformanceMonitor.getInstance();
