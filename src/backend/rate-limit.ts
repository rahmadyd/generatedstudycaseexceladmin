// Simple in-memory rate limiter per IP for serverless environment
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  ipMap.forEach((record, ip) => {
    if (now > record.resetAt) {
      ipMap.delete(ip);
    }
  });
}, 60000);

/**
 * Checks rate limit: allows max requests per windowMs.
 */
export function checkRateLimit(ip: string, limit = 10, windowMs = 60000): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = ipMap.get(ip);

  if (!record || now > record.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= limit) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  record.count += 1;
  return { allowed: true };
}
