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
  #isCancelled: boolean = false;
  #abortControllers: AbortController[] = [];
  #successResults: T[] = [];
  #failedResults: E[] = [];
  #currentDelay: number = 0;
  #currentBatchIndex: number = 0;

  async #executeRequest(req: AsyncFunction<T>): Promise<T | E> {
    const controller = new AbortController();
    this.#abortControllers.push(controller);
    const { signal } = controller;

    try {
      return await req(signal);
    } catch (error) {
      if (this.#config.onError) {
        this.#config.onError(error as E);
      }

      return error as E;
    } finally {
      this.#abortControllers = this.#abortControllers.filter((ctrl) => ctrl !== controller);
    }
  }

  async #tick() {
    const totalRequests = this.#requests.length;

    if (!this.#isCancelled && this.#currentBatchIndex < totalRequests) {
      const batch = this.#requests.slice(
        this.#currentBatchIndex,
        this.#currentBatchIndex + this.#config.maxConcurrent,
      );
      this.#currentBatchIndex += this.#config.maxConcurrent;

      await Promise.all(
        batch.map(async (req) => {
          const result = await this.#executeRequest(req);

          if (result && !(result instanceof Error)) {
            if (this.#config.onSuccess) {
              this.#config.onSuccess(result as T);
            }

            this.#successResults.push(result as T);
          } else {
            this.#failedResults.push(result as E);
          }

          if (this.#config.onProgress) {
            this.#config.onProgress({
              completed: this.#successResults.length,
              remaining: Math.max(totalRequests - (this.#successResults.length + this.#failedResults.length), 0),
              failed: this.#failedResults.length,
            });
          }
        }),
      );

      if (this.#currentBatchIndex < totalRequests) {
        await new Promise((resolve) => { setTimeout(resolve, this.#currentDelay); });

        this.#currentDelay = Math.min(
          this.#currentDelay + this.#config.progressiveDelayStep,
          this.#config.maxProgressiveDelay || this.#currentDelay,
        );

        await this.#tick();
      }
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
    this.#successResults = [];
    this.#failedResults = [];
    this.#currentDelay = this.#config.delayBetweenBatches;
    this.#currentBatchIndex = 0;

    await this.#tick();

    if (this.#config.onComplete && !this.#isCancelled) {
      this.#config.onComplete({ success: this.#successResults, failed: this.#failedResults });
    }

    return { success: this.#successResults, failed: this.#failedResults };
  }
}

export default PromisesLimiter;
