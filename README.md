
# Promises Limiter

`PromisesLimiter` is a class for limiting concurrent asynchronous requests, allowing them to be executed in batches with control over progress, handling of successful and failed requests.

## Description

This class allows you to execute asynchronous functions with a limit on the number of concurrent executions. You can configure delays between batches, success and error handlers, and receive progress updates during execution.

## Installation

```bash
npm install promises-limiter
```

## Usage

### Import

```typescript
import PromisesLimiter from 'promises-limiter';
```

### Constructor

```typescript
new PromisesLimiter<T, E>(
  requests: AsyncFunction<T>[],
  config?: Partial<LimitConfig<T, E>>
);
```

- `requests`: An array of asynchronous functions to be executed.
- `config`: A configuration object with the following parameters:
  - `maxConcurrent`: Maximum number of concurrent requests (default is `10`).
  - `delayBetweenBatches`: Delay between batch executions in milliseconds (default is `0`).
  - `progressiveDelayStep`: Delay step added after each batch (default is `0`).
  - `maxProgressiveDelay`: Maximum delay for batches (default is `0`).
  - `onSuccess`: Function to handle successful results.
  - `onError`: Function to handle errors.
  - `onProgress`: Function called to track progress.
  - `onComplete`: Function called when all requests are completed.

### Methods

- `cancel()`: Cancels all requests that have not yet completed.

- `run(): Promise<{ success: T[]; failed: E[] }>`: Starts executing requests and returns an object containing arrays of successful and failed results.

### Example

```typescript
const requests: AsyncFunction<number>[] = [
  async (signal) => { /* ... */ },
  async (signal) => { /* ... */ },
  // Other requests
];

const limiter = new PromisesLimiter<number, Error>(requests, {
  maxConcurrent: 5,
  delayBetweenBatches: 1000,
  onSuccess: (result) => console.log('Success:', result),
  onError: (error) => console.error('Error:', error),
  onProgress: (progress) => console.log('Progress:', progress),
  onComplete: (results) => console.log('Completed:', results),
});

limiter.run().then(({ success, failed }) => {
  console.log('Completed successfully:', success);
  console.log('Failed requests:', failed);
});
```