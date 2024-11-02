import PromisesLimiter from "../index";

describe('PromisesLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute requests with success callback', async () => {
    const mockRequest = jest.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ], {
      onSuccess(result) {
        expect(result).toBeGreaterThan(0);
      },
    });

    const result = await limiter.run();
    
    expect(result.success).toEqual([1, 2, 3]);
    expect(result.failed).toEqual([]);
  });

  it('should handle errors correctly', async () => {
    const error = new Error('Request failed');
    const mockRequest = jest.fn()
      .mockRejectedValue(error)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ], {
      onError(error) {
        expect(error.message).toBe('Request failed');
      },
    });

    const result = await limiter.run();

    expect(result.success).toEqual([2, 3]);
    expect(result.failed).toEqual([error]);
  });

  it('should apply delay between batches', async () => {
    const mockRequest = jest.fn();

    const limiter = new PromisesLimiter([mockRequest, mockRequest, mockRequest], {
      maxConcurrent: 1,
      delayBetweenBatches: 100,
    });

    const start = Date.now();
    await limiter.run();
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(200);
  });

  it('should apply initial and progressive delays between batches', async () => {
    const mockRequest = jest.fn();

    const limiter = new PromisesLimiter([
      mockRequest, mockRequest, mockRequest,
      mockRequest, mockRequest, mockRequest,
    ], {
      maxConcurrent: 1,
      delayBetweenBatches: 100,
      progressiveDelayStep: 100,
      maxProgressiveDelay: 200,
    });

    const start = Date.now();
    await limiter.run();
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(900);
  });

  it('should call onProgress callback', async () => {
    const mockRequest = jest.fn().mockResolvedValue(1);
    const progressCallback = jest.fn();

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest, mockRequest,
      mockRequest, mockRequest, mockRequest, mockRequest,
    ], {
      onProgress(progress) {
        progressCallback(progress);
      },
      maxConcurrent: 4,
    });
    
    await limiter.run();

    expect(progressCallback).toHaveBeenCalled();

    Array(8).fill(8).forEach((max, idx) => {
      expect(progressCallback).toHaveBeenCalledWith({
        completed: idx + 1,
        remaining: max - (idx + 1),
        failed: 0,
      });
    });
  });

  it('should call onComplete callback', async () => {
    const completeCallback = jest.fn();
    const mockRequest = jest.fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest, mockRequest,
    ], {
      onComplete(results) {
        completeCallback(results);
      },
    });

    await limiter.run();

    expect(completeCallback).toHaveBeenCalledWith({ success: [1, 2], failed: [] });
  });

  it('should cancel requests', async () => {
    const mockRequest = jest.fn().mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => {
        resolve('Done');
      }, 100);
    }));

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ], {
      maxConcurrent: 1,
    });

    setTimeout(() => {
      limiter.cancel();
    }, 0);

    const result = await limiter.run();

    expect(result.success).toEqual(['Done']);
    expect(result.failed).toEqual([]);
  });

  it('should handle max concurrent requests', async () => {
    const mockRequest = jest.fn().mockResolvedValue(1);

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ], {
      maxConcurrent: 2,
    });

    const result = await limiter.run();

    expect(result.success).toHaveLength(3);
  });

  it('should receive signal in callback', async () => {
    const mockRequest = jest.fn();

    const limiter = new PromisesLimiter<number, Error>([
      mockRequest,
    ]);

    await limiter.run();

    const controller = new AbortController();
    const { signal } = controller;

    expect(mockRequest).toHaveBeenCalledWith(signal);
  });
});
