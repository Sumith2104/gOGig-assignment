import Redis from 'ioredis';
import { config } from './config';

// Dedicated Redis client for rate limiting (separate from BullMQ which requires maxRetriesPerRequest: null)
const rateLimitRedis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

rateLimitRedis.on('error', () => {
  // Silently catch background Redis errors to prevent unhandled rejections
});

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSizeSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetInSeconds: number;
}

// Predefined rate limit tiers
export const RATE_LIMITS = {
  /** Upload endpoint: 10 uploads per minute per IP */
  upload: { maxRequests: 10, windowSizeSeconds: 60 } as RateLimitConfig,
  /** Read endpoints (list, status, results): 60 requests per minute per IP */
  read: { maxRequests: 60, windowSizeSeconds: 60 } as RateLimitConfig,
  /** Delete endpoint: 20 deletes per minute per IP */
  delete: { maxRequests: 20, windowSizeSeconds: 60 } as RateLimitConfig,
} as const;

/**
 * Redis-backed sliding window rate limiter.
 * Uses a sorted set keyed by IP + route tier. Each request adds a timestamped entry.
 * Expired entries outside the window are pruned on every check.
 */
export async function checkRateLimit(
  clientIp: string,
  tier: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const limiterConfig = RATE_LIMITS[tier];
  const key = `ratelimit:${tier}:${clientIp}`;
  const now = Date.now();
  const windowStart = now - limiterConfig.windowSizeSeconds * 1000;

  try {
    // Ensure connection is open
    if (rateLimitRedis.status === 'wait') {
      await rateLimitRedis.connect();
    }

    // Atomic pipeline: prune expired entries, add current request, count window, set TTL
    const pipeline = rateLimitRedis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);       // Remove entries outside window
    pipeline.zadd(key, now, `${now}:${Math.random()}`);   // Add current request with unique member
    pipeline.zcard(key);                                    // Count requests in window
    pipeline.expire(key, limiterConfig.windowSizeSeconds); // Auto-cleanup key after window

    const results = await pipeline.exec();

    const requestCount = (results?.[2]?.[1] as number) || 0;
    const allowed = requestCount <= limiterConfig.maxRequests;
    const remaining = Math.max(0, limiterConfig.maxRequests - requestCount);

    // If over limit, remove the entry we just added (don't count rejected requests)
    if (!allowed) {
      await rateLimitRedis.zremrangebyscore(key, now, now + 1);
    }

    return {
      allowed,
      remaining,
      limit: limiterConfig.maxRequests,
      resetInSeconds: limiterConfig.windowSizeSeconds,
    };
  } catch {
    // If Redis is unavailable, allow the request (fail-open strategy)
    return {
      allowed: true,
      remaining: limiterConfig.maxRequests,
      limit: limiterConfig.maxRequests,
      resetInSeconds: limiterConfig.windowSizeSeconds,
    };
  }
}

/**
 * Extract client IP from Next.js request headers.
 * Checks x-forwarded-for (behind Caddy/nginx proxy), then x-real-ip, then falls back to '127.0.0.1'.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
