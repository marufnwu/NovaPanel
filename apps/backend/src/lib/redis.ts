import IORedis from 'ioredis';
import { config } from '../config.js';

export const redis = new IORedis.default(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});
