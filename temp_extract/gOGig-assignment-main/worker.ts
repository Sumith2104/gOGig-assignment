import { Worker } from 'bullmq';
import { redisConnection } from './src/lib/redis';
import { QUEUE_NAME } from './src/lib/queue';
import { processImageJob } from './src/workers/process-image';
import { logger } from './src/lib/logger';

logger.info('Initializing BullMQ Worker process...');

const worker = new Worker(QUEUE_NAME, processImageJob, {
  connection: redisConnection,
  concurrency: 2,
  stalledInterval: 30000,
  maxStalledCount: 2,
  lockDuration: 120000,
});

worker.on('ready', () => {
  logger.info({ queue: QUEUE_NAME }, 'Worker ready and listening for jobs');
});

worker.on('completed', (job) => {
  logger.info({ jobId: job.id, imageId: job.data.imageId }, 'BullMQ job completed event');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, imageId: job?.data?.imageId, error: err.message }, 'BullMQ job failed event');
});

worker.on('error', (err) => {
  logger.error({ error: err.message }, 'BullMQ worker internal error');
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Worker received shutdown signal. Closing connections gracefully...');
  try {
    await worker.close();
    logger.info('BullMQ worker closed cleanly.');
    process.exit(0);
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : err }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
