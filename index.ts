export type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;

interface LimitConfig<T, E> {
  maxConcurrent: number;
  delayBetweenBatches: number;
  progressiveDelayStep: number;
  maxProgressiveDelay: number;
  onSuccess?: (result: T) => void;
  onError?: (error: E) => void;
  onProgress?: (progress: { completed: number; remaining: number; failed: number }) => void;
  onComplete?: (results: { success: T[]; failed: E[] }) => void;
}

class Limiter<T = any, E = any> {
  private requests: AsyncFunction<T>[];

  private config: LimitConfig<T, E>;

  private successCount: number = 0;

  private failCount: number = 0;

  private isCancelled: boolean = false;

  private abortControllers: AbortController[] = [];

  private async executeRequest(req: AsyncFunction<T>): Promise<T | E> {
    const controller = new AbortController();
    this.abortControllers.push(controller);
    const { signal } = controller;

    try {
      return await req(signal);
    } catch (error) {
      this.failCount++;

      if (this.config.onError) this.config.onError(error as E);

      return error as E;
    } finally {
      this.abortControllers = this.abortControllers.filter((ctrl) => ctrl !== controller);
    }
  }

  constructor(requests: AsyncFunction<T>[]) {
    this.requests = requests;
    this.config = {
      maxConcurrent: 10,
      delayBetweenBatches: 0,
      progressiveDelayStep: 0,
      maxProgressiveDelay: 0,
    };
  }

  max(concurrent: number) {
    this.config.maxConcurrent = concurrent;
    return this;
  }

  delay(milliseconds: number) {
    this.config.delayBetweenBatches = milliseconds;
    return this;
  }

  progressiveDelay(step: number, maxDelay: number) {
    this.config.progressiveDelayStep = step;
    this.config.maxProgressiveDelay = maxDelay;
    return this;
  }

  success(callback: (result: T) => void) {
    this.config.onSuccess = callback;
    return this;
  }

  error(callback: (error: E) => void) {
    this.config.onError = callback;
    return this;
  }

  progress(callback: (progress: { completed: number; remaining: number; failed: number }) => void) {
    this.config.onProgress = callback;
    return this;
  }

  complete(callback: (results: { success: T[]; failed: E[] }) => void) {
    this.config.onComplete = callback;
    return this;
  }

  cancel() {
    this.isCancelled = true;
    this.abortControllers.forEach((controller) => controller.abort());
  }

  async run(): Promise<{ success: T[]; failed: E[] }> {
    const successResults: T[] = [];
    const failedResults: E[] = [];
    let delay = this.config.delayBetweenBatches;
    let currentBatchIndex = 0;

    const totalRequests = this.requests.length;

    while (currentBatchIndex < totalRequests) {
      if (this.isCancelled) {
        break;
      }

      const batch = this.requests.slice(
        currentBatchIndex,
        currentBatchIndex + this.config.maxConcurrent,
      );
      currentBatchIndex += this.config.maxConcurrent;

      await Promise.all(
        batch.map(async (req) => {
          const result = await this.executeRequest(req);

          if (result && !(result instanceof Error)) {
            this.successCount++;

            if (this.config.onSuccess) this.config.onSuccess(result as T);

            successResults.push(result as T);
          } else {
            failedResults.push(result as E);
          }
        }),
      );

      if (this.config.onProgress) {
        this.config.onProgress({
          completed: this.successCount,
          remaining: totalRequests - currentBatchIndex,
          failed: this.failCount,
        });
      }

      if (currentBatchIndex < totalRequests) {
        await new Promise((resolve) => { setTimeout(resolve, delay); });
        delay = Math.min(delay + this.config.progressiveDelayStep, this.config.maxProgressiveDelay);
      }
    }

    if (this.config.onComplete && !this.isCancelled) {
      this.config.onComplete({ success: successResults, failed: failedResults });
    }

    return { success: successResults, failed: failedResults };
  }
}

export function PromisesLimiter<T = any, E = any>(requests: AsyncFunction<T>[]) {
  return new Limiter<T, E>(requests);
}
