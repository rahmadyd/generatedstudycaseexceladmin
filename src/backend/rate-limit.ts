import {
  GENERATION_GUARD_STATE_RETENTION_MS,
  GENERATION_RATE_LIMIT_WINDOW_MS,
} from '../shared/generation-config';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitRecord>();
const lastRequestMap = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  ipMap.forEach((record, ip) => {
    if (now > record.resetAt) {
      ipMap.delete(ip);
    }
  });
  lastRequestMap.forEach((lastRequestAt, clientKey) => {
    if (now - lastRequestAt > GENERATION_GUARD_STATE_RETENTION_MS) {
      lastRequestMap.delete(clientKey);
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

/**
 * In-memory cooldown. Vercel serverless instances do not share this state.
 */
export function checkMinimumInterval(
  clientKey: string,
  intervalMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const lastRequestAt = lastRequestMap.get(clientKey);
  if (lastRequestAt !== undefined && now - lastRequestAt < intervalMs) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((intervalMs - (now - lastRequestAt)) / 1000),
    };
  }

  lastRequestMap.set(clientKey, now);
  return { allowed: true };
}
