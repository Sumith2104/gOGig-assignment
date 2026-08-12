import Redis from 'ioredis';
import { config } from './config';

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const redisConnection = new Redis(config.redisUrl, redisOptions);

redisConnection.on('error', (_err) => {
  // Catch background error events to prevent unhandled process rejection
});
