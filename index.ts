export type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;

export interface SuccessHandler<T> {
  (result: T): void;
}

export interface ErrorHandler<E> {
  (error: E): void;
}

export interface ProgressHandler {
  (progress: { completed: number; remaining: number; failed: number }): void;
}

export interface CompletionHandler<T, E> {
  (results: { success: T[]; failed: E[] }): void;
}

export interface LimitConfig<T, E> {
  maxConcurrent: number;
  delayBetweenBatches: number;
  progressiveDelayStep: number;
  maxProgressiveDelay: number;
  onSuccess?: SuccessHandler<T>;
  onError?: ErrorHandler<E>;
  onProgress?: ProgressHandler;
  onComplete?: CompletionHandler<T, E>;
}

class PromisesLimiter<T = any, E = any> {
  #requests: AsyncFunction<T>[];
  #config: LimitConfig<T, E>;
  #successCount: number = 0;
  #failCount: number = 0;
  #isCancelled: boolean = false;
  #abortControllers: AbortController[] = [];

  async #executeRequest(req: AsyncFunction<T>): Promise<T | E> {
    const controller = new AbortController();
    this.#abortControllers.push(controller);
    const { signal } = controller;

    try {
      return await req(signal);
    } catch (error) {
      this.#failCount++;

      if (this.#config.onError) {
        this.#config.onError(error as E);
      }

      return error as E;
    } finally {
      this.#abortControllers = this.#abortControllers.filter((ctrl) => ctrl !== controller);
    }
  }

  constructor(requests: AsyncFunction<T>[], config?: Partial<LimitConfig<T, E>>) {
    this.#requests = requests;
    this.#config = {
      maxConcurrent: 10,
      delayBetweenBatches: 0,
      progressiveDelayStep: 0,
      maxProgressiveDelay: 0,
      ...config,
    };
  }

  cancel() {
    this.#isCancelled = true;
    this.#abortControllers.forEach((controller) => controller.abort());
  }

  async run(): Promise<{ success: T[]; failed: E[] }> {
    this.#successCount = 0;
    this.#failCount = 0;

    const successResults: T[] = [];
    const failedResults: E[] = [];
    let delay = this.#config.delayBetweenBatches;
    let currentBatchIndex = 0;

    const totalRequests = this.#requests.length;

    while (currentBatchIndex < totalRequests) {
      if (this.#isCancelled) {
        break;
      }

      const batch = this.#requests.slice(
        currentBatchIndex,
        currentBatchIndex + this.#config.maxConcurrent,
      );
      currentBatchIndex += this.#config.maxConcurrent;

      await Promise.all(
        batch.map(async (req) => {
          const result = await this.#executeRequest(req);

          if (result && !(result instanceof Error)) {
            this.#successCount++;

            if (this.#config.onSuccess) {
              this.#config.onSuccess(result as T);
            }

            successResults.push(result as T);
          } else {
            failedResults.push(result as E);
          }

          if (this.#config.onProgress) {
            this.#config.onProgress({
              completed: this.#successCount,
              remaining: Math.max(totalRequests - (this.#successCount + this.#failCount), 0),
              failed: this.#failCount,
            });
          }
        }),
      );

      if (currentBatchIndex < totalRequests) {
        await new Promise((resolve) => { setTimeout(resolve, delay); });
        delay = Math.min(
          delay + this.#config.progressiveDelayStep,
          this.#config.maxProgressiveDelay || delay,
        );
      }
    }

    if (this.#config.onComplete && !this.#isCancelled) {
      this.#config.onComplete({ success: successResults, failed: failedResults });
    }

    return { success: successResults, failed: failedResults };
  }
}

export default PromisesLimiter;
