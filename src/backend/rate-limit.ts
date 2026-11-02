import {
  GENERATION_RATE_LIMIT_WINDOW_MS,
} from '../shared/generation-config';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitRecord>();

setInterval(() => {
  const now = Date.now();
  ipMap.forEach((record, ip) => {
    if (now > record.resetAt) {
      ipMap.delete(ip);
    }
  });
}, GENERATION_RATE_LIMIT_WINDOW_MS);

export function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = ipMap.get(ip);

  if (!record || now > record.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((record.resetAt - now) / 1000) };
  }

  record.count += 1;
  return { allowed: true };
}
