import { promisesLimiter } from '../index';

describe('Limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute requests with success callback', async () => {
    const mockRequest = jest.fn();
    const limiter = promisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ]);

    mockRequest
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    limiter.success((result) => {
      expect(result).toBeGreaterThan(0);
    });

    const result = await limiter.run();
    
    expect(result.success).toEqual([1, 2, 3]);
    expect(result.failed).toEqual([]);
  });

  it('should handle errors correctly', async () => {
    const error = new Error('Request failed');
    const mockRequest = jest.fn();
    const limiter = promisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ]);

    mockRequest
      .mockRejectedValue(error)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);

    limiter.error((error) => {
      expect(error.message).toBe('Request failed');
    });

    const result = await limiter.run();

    expect(result.success).toEqual([2, 3]);
    expect(result.failed).toEqual([error]);
  });

  it('should apply delay between batches', async () => {
    const mockRequest = jest.fn();

    const limiter = promisesLimiter([mockRequest, mockRequest, mockRequest])
      .max(1)
      .delay(100);

    const start = Date.now();
    await limiter.run();
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(200);
  });

  it('should apply initial and progressive delays between batches', async () => {
    const mockRequest = jest.fn();

    const limiter = promisesLimiter([
      mockRequest, mockRequest, mockRequest,
      mockRequest, mockRequest, mockRequest,
    ])
      .max(1)
      .delay(100)
      .progressiveDelay(100, 200);

    const start = Date.now();
    await limiter.run();
    const end = Date.now();

    expect(end - start).toBeGreaterThanOrEqual(900);
  });

  it('should call onProgress callback', async () => {
    const mockRequest = jest.fn();
    const limiter = promisesLimiter<number, Error>([
      mockRequest,
    ]);

    const progressCallback = jest.fn();
    limiter.progress(progressCallback);
    
    mockRequest.mockResolvedValue(1);
    await limiter.run();

    expect(progressCallback).toHaveBeenCalled();
    expect(progressCallback).toHaveBeenCalledWith({
      completed: 1,
      failed: 0,
      remaining: 0,
    });
  });

  it('should call onComplete callback', async () => {
    const mockRequest = jest.fn();
    const limiter = promisesLimiter<number, Error>([
      mockRequest, mockRequest,
    ]);

    mockRequest
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const completeCallback = jest.fn();
    limiter.complete(completeCallback);
    await limiter.run();

    expect(completeCallback).toHaveBeenCalledWith({ success: [1, 2], failed: [] });
  });

  it('should cancel requests', async () => {
    const mockRequest = jest.fn();
    const limiter = promisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ]);

    mockRequest
      .mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => {
          resolve('Done');
        }, 100);
      }));

    limiter.max(1);

    setTimeout(() => {
      limiter.cancel();
    }, 0);

    const result = await limiter.run();

    expect(result.success).toEqual(['Done']);
    expect(result.failed).toEqual([]);
  });

  it('should handle max concurrent requests', async () => {
    const mockRequest = jest.fn();
    const limiter = promisesLimiter<number, Error>([
      mockRequest, mockRequest, mockRequest,
    ]);

    mockRequest.mockResolvedValue(1);
    limiter.max(2);
    const result = await limiter.run();

    expect(result.success).toHaveLength(3);
  });

  it('should receive signal in callback', async () => {
    const mockRequest = jest.fn();

    const limiter = promisesLimiter<number, Error>([
      mockRequest,
    ]);

    await limiter.run();

    const controller = new AbortController();
    const { signal } = controller;

    expect(mockRequest).toHaveBeenCalledWith(signal);
  });
});