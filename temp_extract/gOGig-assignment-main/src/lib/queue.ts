import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const QUEUE_NAME = 'image-processing';

export const imageQueue = new Queue(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s -> 10s -> 20s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
