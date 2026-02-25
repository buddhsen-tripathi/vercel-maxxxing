const stores = new Map<string, Map<string, number[]>>();

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  resetMs: number;
}

function createRateLimiter(name: string, config: RateLimiterConfig) {
  const store = new Map<string, number[]>();
  stores.set(name, store);

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const timestamps = (store.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= config.maxRequests) {
      const oldest = timestamps[0];
      return { allowed: false, resetMs: oldest + config.windowMs - now };
    }

    timestamps.push(now);
    store.set(key, timestamps);
    return { allowed: true, resetMs: 0 };
  };
}

export const reviewLimiter = createRateLimiter("review", {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,
});

export const chatLimiter = createRateLimiter("chat", {
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
});

export function getRateLimitKey(
  req: Request,
  userId?: string | null
): string {
  if (userId) return `user:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0].trim() ?? "unknown";
  return `ip:${ip}`;
}

export function rateLimitResponse(resetMs: number): Response {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) },
    }
  );
}
