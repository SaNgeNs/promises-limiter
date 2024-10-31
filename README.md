# Promises Limiter

`promisesLimiter` is a utility that allows you to limit the number of concurrent asynchronous requests, control delays between batches of requests, and handle successful and failed requests.

### Example

```typescript
const requests: AsyncFunction[] = [
  async (signal) => { /* your asynchronous code */ },
  async (signal) => { /* your asynchronous code */ },
  // add more requests
];

const limiter = promisesLimiter(requests)
  .max(5) // maximum number of concurrent requests
  .delay(100) // delay between batches in milliseconds
  .progressiveDelay(50, 500) // progressive delay: step 50ms, max 500ms
  .success((result) => {
    console.log('Request succeeded:', result);
  })
  .error((error) => {
    console.error('Request failed:', error);
  })
  .progress(({ completed, remaining, failed }) => {
    console.log(`Completed: ${completed}, Remaining: ${remaining}, Failed: ${failed}`);
  })
  .complete(({ success, failed }) => {
    console.log('All requests completed.');
    console.log('Successful:', success);
    console.log('Failed:', failed);
  });

const { success, failed } = await limiter.run();
```

## Interfaces

### AsyncFunction

Type for asynchronous functions that accept a cancellation signal:

```typescript
type AsyncFunction<T = any> = (signal: AbortSignal) => Promise<T>;
```

### LimitConfig

Interface for limiter configuration:

```typescript
interface LimitConfig {
  maxConcurrent: number; // maximum number of concurrent requests
  delayBetweenBatches: number; // delay between batches of requests
  progressiveDelayStep: number; // step for progressive delay
  maxProgressiveDelay: number; // maximum progressive delay
  onSuccess?: (result: any) => void; // callback for handling successful requests
  onError?: (error: any) => void; // callback for handling failed requests
  onProgress?: (progress: { completed: number; remaining: number; failed: number }) => void; // callback for tracking progress
  onComplete?: (results: { success: any[]; failed: any[] }) => void; // callback for handling completion of all requests
}
```

## Methods

- `max(concurrent: number)`: Sets the maximum number of concurrent requests.
- `delay(milliseconds: number)`: Sets the delay between batches of requests.
- `progressiveDelay(step: number, maxDelay: number)`: Sets a progressive delay with a step and maximum value.
- `success(callback: (result: any) => void)`: Sets a callback for handling successful requests.
- `error(callback: (error: any) => void)`: Sets a callback for handling failed requests.
- `progress(callback: (progress: { completed: number; remaining: number; failed: number }) => void)`: Sets a callback for tracking progress.
- `complete(callback: (results: { success: any[]; failed: any[] }) => void)`: Sets a callback for handling completion of all requests.
- `cancel()`: Cancels all active requests.
- `run()`: Starts executing the requests according to the configuration.
