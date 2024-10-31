type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;
declare class Limiter<T = any, E = any> {
    private requests;
    private config;
    private successCount;
    private failCount;
    private isCancelled;
    private abortControllers;
    private executeRequest;
    constructor(requests: AsyncFunction<T>[]);
    max(concurrent: number): this;
    delay(milliseconds: number): this;
    progressiveDelay(step: number, maxDelay: number): this;
    success(callback: (result: T) => void): this;
    error(callback: (error: E) => void): this;
    progress(callback: (progress: {
        completed: number;
        remaining: number;
        failed: number;
    }) => void): this;
    complete(callback: (results: {
        success: T[];
        failed: E[];
    }) => void): this;
    cancel(): void;
    run(): Promise<{
        success: T[];
        failed: E[];
    }>;
}
declare function promisesLimiter<T = any, E = any>(requests: AsyncFunction<T>[]): Limiter<T, E>;

export { type AsyncFunction, promisesLimiter };
