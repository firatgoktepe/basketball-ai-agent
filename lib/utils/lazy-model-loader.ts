/**
 * Lazy Model Loader
 *
 * Loads AI/ML models on demand to reduce initial bundle size and startup time
 * Implements caching to avoid reloading models
 */

export type ModelType = "coco-ssd" | "movenet" | "ball-detection" | "tesseract";

export interface ModelLoadResult<T = any> {
  model: T;
  loadTime: number;
  source: "cache" | "network";
}

export class LazyModelLoader {
  private static instance: LazyModelLoader;
  private modelCache: Map<ModelType, any> = new Map();
  private loadingPromises: Map<ModelType, Promise<any>> = new Map();

  private constructor() {}

  static getInstance(): LazyModelLoader {
    if (!LazyModelLoader.instance) {
      LazyModelLoader.instance = new LazyModelLoader();
    }
    return LazyModelLoader.instance;
  }

  /**
   * Load a model lazily with caching
   */
  async loadModel<T = any>(
    modelType: ModelType,
    loader: () => Promise<T>
  ): Promise<ModelLoadResult<T>> {
    const startTime = performance.now();

    // Return from cache if already loaded
    if (this.modelCache.has(modelType)) {
      return {
        model: this.modelCache.get(modelType),
        loadTime: performance.now() - startTime,
        source: "cache",
      };
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(modelType)) {
      const model = await this.loadingPromises.get(modelType);
      return {
        model,
        loadTime: performance.now() - startTime,
        source: "cache",
      };
    }

    // Load the model
    const loadPromise = loader();
    this.loadingPromises.set(modelType, loadPromise);

    try {
      const model = await loadPromise;
      this.modelCache.set(modelType, model);
      this.loadingPromises.delete(modelType);

      return {
        model,
        loadTime: performance.now() - startTime,
        source: "network",
      };
    } catch (error) {
      this.loadingPromises.delete(modelType);
      throw new Error(
        `Failed to load model ${modelType}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Preload models in the background
   */
  async preloadModels(
    models: Array<{
      type: ModelType;
      loader: () => Promise<any>;
    }>
  ): Promise<void> {
    const promises = models.map(({ type, loader }) =>
      this.loadModel(type, loader).catch((error) => {
        console.warn(`Failed to preload model ${type}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Check if a model is loaded
   */
  isModelLoaded(modelType: ModelType): boolean {
    return this.modelCache.has(modelType);
  }

  /**
   * Clear model cache to free memory
   */
  clearCache(modelType?: ModelType): void {
    if (modelType) {
      this.modelCache.delete(modelType);
    } else {
      this.modelCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    loadedModels: ModelType[];
    cacheSize: number;
  } {
    return {
      loadedModels: Array.from(this.modelCache.keys()),
      cacheSize: this.modelCache.size,
    };
  }
}

/**
 * Singleton instance
 */
export const lazyModelLoader = LazyModelLoader.getInstance();

/**
 * Hook for using lazy model loading in React components
 */
export function useLazyModel<T = any>(
  modelType: ModelType,
  loader: () => Promise<T>,
  autoLoad: boolean = false
) {
  const [model, setModel] = React.useState<T | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [loadTime, setLoadTime] = React.useState<number>(0);

  const loadModel = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await lazyModelLoader.loadModel(modelType, loader);
      setModel(result.model);
      setLoadTime(result.loadTime);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load model"));
    } finally {
      setIsLoading(false);
    }
  }, [modelType, loader]);

  React.useEffect(() => {
    if (autoLoad && !model && !isLoading) {
      loadModel();
    }
  }, [autoLoad, model, isLoading, loadModel]);

  return {
    model,
    isLoading,
    error,
    loadTime,
    loadModel,
  };
}

// Import React for the hook
import * as React from "react";
