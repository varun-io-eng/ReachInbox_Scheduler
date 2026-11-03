import { redis } from '../config/redis.js';
import config from '../config/index.js';
import type { RateLimitResult } from '../types/index.js';

const KEY_PREFIX = 'ratelimit';
const WINDOW_DURATION_MS = 3_600_000; // 1 hour
const KEY_TTL_SECONDS = 7200; // 2 hours — ensures cleanup after the window expires

/**
 * Returns the current hour-window identifier.
 */
function currentWindow(): number {
  return Math.floor(Date.now() / WINDOW_DURATION_MS);
}

/**
 * Build the Redis key for a given sender and hour window.
 */
function buildKey(senderId: string, window?: number): string {
  return `${KEY_PREFIX}:${senderId}:${window ?? currentWindow()}`;
}

/**
 * Check whether a sender is allowed to send right now.
 */
export async function checkRateLimit(senderId: string): Promise<RateLimitResult> {
  const window = currentWindow();
  const key = buildKey(senderId, window);
  const count = parseInt((await redis.get(key)) ?? '0', 10);
  const limit = config.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const allowed = count < limit;
  const remaining = Math.max(0, limit - count);

  // resetAt = start of the next window
  const resetAt = new Date((window + 1) * WINDOW_DURATION_MS);

  return { allowed, remaining, resetAt };
}

/**
 * Increment the send counter for the current hour window.
 */
export async function incrementCounter(senderId: string): Promise<number> {
  const key = buildKey(senderId);
  const newCount = await redis.incr(key);

  // Set TTL only on first increment to avoid resetting it
  if (newCount === 1) {
    await redis.expire(key, KEY_TTL_SECONDS);
  }

  return newCount;
}

/**
 * Get the current usage count for a sender in this hour window.
 */
export async function getUsage(senderId: string): Promise<number> {
  const key = buildKey(senderId);
  const count = await redis.get(key);
  return parseInt(count ?? '0', 10);
}

export default {
  checkRateLimit,
  incrementCounter,
  getUsage,
};
