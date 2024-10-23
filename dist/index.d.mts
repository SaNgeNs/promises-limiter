type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;
declare class Limiter {
    private requests;
    private config;
    private successCount;
    private failCount;
    private isCancelled;
    private abortControllers;
    private executeRequest;
    constructor(requests: AsyncFunction[]);
    max(concurrent: number): this;
    delay(milliseconds: number): this;
    progressiveDelay(step: number, maxDelay: number): this;
    success(callback: (result: any) => void): this;
    error(callback: (error: any) => void): this;
    progress(callback: (progress: {
        completed: number;
        remaining: number;
        failed: number;
    }) => void): this;
    complete(callback: (results: {
        success: any[];
        failed: any[];
    }) => void): this;
    cancel(): void;
    run(): Promise<{
        success: any[];
        failed: any[];
    }>;
}
declare function PromisesLimiter(requests: AsyncFunction[]): Limiter;

export { PromisesLimiter };
