type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;

interface LimitConfig {
  maxConcurrent: number;
  delayBetweenBatches: number;
  progressiveDelayStep: number;
  maxProgressiveDelay: number;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
  onProgress?: (progress: { completed: number; remaining: number; failed: number }) => void;
  onComplete?: (results: { success: any[]; failed: any[] }) => void;
}

class Limiter {
  private requests: AsyncFunction[];

  private config: LimitConfig;

  private successCount: number = 0;

  private failCount: number = 0;

  private isCancelled: boolean = false;

  private abortControllers: AbortController[] = [];

  private async executeRequest(req: AsyncFunction): Promise<any> {
    const controller = new AbortController();
    this.abortControllers.push(controller);
    const { signal } = controller;

    try {
      return await req(signal);
    } catch (error) {
      this.failCount++;

      if (this.config.onError) this.config.onError(error);

      return error;
    } finally {
      this.abortControllers = this.abortControllers.filter((ctrl) => ctrl !== controller);
    }
  }

  constructor(requests: AsyncFunction[]) {
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

  success(callback: (result: any) => void) {
    this.config.onSuccess = callback;
    return this;
  }

  error(callback: (error: any) => void) {
    this.config.onError = callback;
    return this;
  }

  progress(callback: (progress: { completed: number; remaining: number; failed: number }) => void) {
    this.config.onProgress = callback;
    return this;
  }

  complete(callback: (results: { success: any[]; failed: any[] }) => void) {
    this.config.onComplete = callback;
    return this;
  }

  cancel() {
    this.isCancelled = true;
    this.abortControllers.forEach((controller) => controller.abort());
  }

  async run(): Promise<{ success: any[]; failed: any[] }> {
    const successResults: any[] = [];
    const failedResults: any[] = [];
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

            if (this.config.onSuccess) this.config.onSuccess(result);

            successResults.push(result);
          } else {
            failedResults.push(result);
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

export function PromisesLimiter(requests: AsyncFunction[]) {
  return new Limiter(requests);
}
