import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Highly robust Sliding Window Rate Limiter using Lua script for atomicity.
 * It uses a Sorted Set in Redis to keep track of the timestamps of recent requests.
 */
const SLIDING_WINDOW_SCRIPT = `
  local key = KEYS[1]
  local window_size = tonumber(ARGV[1])
  local limit = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  
  -- Remove elements older than the window
  redis.call('ZREMRANGEBYSCORE', key, 0, now - window_size)
  
  -- Count the elements in the window
  local current_count = redis.call('ZCARD', key)
  
  if current_count < limit then
    -- Add current request timestamp
    redis.call('ZADD', key, now, now)
    -- Set TTL on the key to automatically clean up
    redis.call('EXPIRE', key, math.ceil(window_size / 1000))
    return current_count + 1
  else
    return -1
  end
`;

redis.defineCommand('slidingWindowRateLimit', {
  numberOfKeys: 1,
  lua: SLIDING_WINDOW_SCRIPT,
});

// Add type declaration for the custom command
declare module 'ioredis' {
  interface Redis {
    slidingWindowRateLimit(key: string, windowSize: number, limit: number, now: number): Promise<number>;
  }
}

export class RateLimiter {
  /**
   * Checks if a request is allowed based on a sliding window.
   * @param key The unique identifier (e.g., user ID + action)
   * @param windowMs The time window in milliseconds
   * @param limit The maximum number of requests allowed in the window
   * @returns boolean true if allowed, false if rate limited
   */
  static async check(key: string, windowMs: number, limit: number): Promise<boolean> {
    const now = Date.now();
    const result = await redis.slidingWindowRateLimit(key, windowMs, limit, now);
    return result !== -1;
  }

  /**
   * Specifically check report limits (20 per day max for a user)
   */
  static async checkDailyReportLimit(userId: string): Promise<boolean> {
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    const limit = 20;
    return this.check(`ratelimit:report:daily:${userId}`, windowMs, limit);
  }

  /**
   * Check pair limits (5 per hour on same target)
   */
  static async checkPairReportLimit(userId: string, targetId: string): Promise<boolean> {
    const windowMs = 60 * 60 * 1000; // 1 hour
    const limit = 5;
    return this.check(`ratelimit:report:pair:${userId}:${targetId}`, windowMs, limit);
  }
}

export default RateLimiter;
