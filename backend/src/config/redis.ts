import config from './index.js';

let redis: any;
let bullRedis: any;

if (config.USE_MOCK_REDIS) {
  // Use ioredis-mock for development without Docker
  const { default: RedisMock } = await import('ioredis-mock');

  redis = new RedisMock();
  bullRedis = new RedisMock();

  console.log('[Redis] Using in-memory mock (ioredis-mock)');
} else {
  const { default: Redis } = await import('ioredis');

  /**
   * General-purpose Redis connection.
   */
  redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  redis.on('connect', () => console.log('[Redis] General connection established'));
  redis.on('error', (err: Error) => console.error('[Redis] General connection error:', err.message));

  /**
   * Dedicated Redis connection for BullMQ.
   */
  bullRedis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      console.log(`[Redis] BullMQ reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  bullRedis.on('connect', () => console.log('[Redis] BullMQ connection established'));
  bullRedis.on('error', (err: Error) => console.error('[Redis] BullMQ connection error:', err.message));
}

export { redis, bullRedis };
export default redis;
