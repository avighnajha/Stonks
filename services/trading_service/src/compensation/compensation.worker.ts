import * as Bull from 'bull';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import axios from 'axios';

const logger = new Logger('CompensationWorker');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const compensationQueue = new (Bull as any)('compensation', redisUrl);
export const failedQueue = new (Bull as any)('compensation:failed', redisUrl);

// Process jobs: job.data = { type: 'wallet_unfreeze'|'portfolio_unfreeze', payload }
compensationQueue.process(async (job: any) => {
  const { type, payload } = job.data;
  try {
    if (type === 'wallet_unfreeze') {
      const url = process.env.WALLET_SERVICE_URL || 'http://wallet_service:3002';
      await axios.post(url + '/wallet/unfreeze', payload, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });
    } else if (type === 'portfolio_unfreeze') {
      const url = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio_service:3005';
      await axios.post(url + '/portfolio/unfreeze', payload, { headers: { 'x-internal-api-key': process.env.INTERNAL_API_KEY } });
    } else {
      throw new Error('unknown compensation type ' + type);
    }
    logger.log(`Compensation job ${job.id} succeeded for type=${type}`);
    return Promise.resolve();
  } catch (err) {
    logger.warn(`Compensation job ${job.id} failed for type=${type}: ${err?.message || err}`);
    throw err;
  }
});

// On failed after attempts, move to dead-letter failedQueue and log
compensationQueue.on('failed', async (job: any, err: any) => {
  try {
    logger.error(`Job ${job.id} permanently failed after ${job.attemptsMade} attempts: ${err?.message || err}`);
    await failedQueue.add(job.data, { removeOnComplete: false });
  } catch (e) {
    logger.error('Failed to move job to failed queue: ' + (e?.message || e));
  }
});

// Export helper to add jobs
export async function enqueueCompensation(type: string, payload: any) {
  // attempts and backoff configured per-job
  const opts = {
    attempts: Number(process.env.COMPENSATION_ATTEMPTS || 10),
    backoff: { type: 'exponential', delay: Number(process.env.COMPENSATION_BACKOFF_MS || 500) },
    removeOnComplete: { age: 3600 },
    removeOnFail: false,
  } as any;

  const job = await compensationQueue.add({ type, payload }, opts);
  logger.warn(`Enqueued compensation job ${job.id} type=${type}`);
  return job.id;
}
