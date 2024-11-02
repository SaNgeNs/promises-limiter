type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;
interface SuccessHandler<T> {
    (result: T): void;
}
interface ErrorHandler<E> {
    (error: E): void;
}
interface ProgressHandler {
    (progress: {
        completed: number;
        remaining: number;
        failed: number;
    }): void;
}
interface CompletionHandler<T, E> {
    (results: {
        success: T[];
        failed: E[];
    }): void;
}
interface LimitConfig<T, E> {
    maxConcurrent: number;
    delayBetweenBatches: number;
    progressiveDelayStep: number;
    maxProgressiveDelay: number;
    onSuccess?: SuccessHandler<T>;
    onError?: ErrorHandler<E>;
    onProgress?: ProgressHandler;
    onComplete?: CompletionHandler<T, E>;
}
declare class PromisesLimiter<T = any, E = any> {
    #private;
    constructor(requests: AsyncFunction<T>[], config?: Partial<LimitConfig<T, E>>);
    cancel(): void;
    run(): Promise<{
        success: T[];
        failed: E[];
    }>;
}

export { type AsyncFunction, type CompletionHandler, type ErrorHandler, type LimitConfig, type ProgressHandler, type SuccessHandler, PromisesLimiter as default };
