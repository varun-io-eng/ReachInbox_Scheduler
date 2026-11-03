import { Queue } from 'bullmq';
import { bullRedis } from '../config/redis.js';
import config from '../config/index.js';
import emailJobModel from '../models/emailJobModel.js';
import type { EmailJob, QueueStats } from '../types/index.js';

const QUEUE_NAME = 'email-sending';

/**
 * BullMQ queue for scheduling email sends.
 */
export const emailQueue = new Queue(QUEUE_NAME, {
  connection: bullRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs for dashboard
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs for debugging
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('[Queue] Error:', err.message);
});

/**
 * Schedule an email job in BullMQ.
 *
 * The job payload only carries the DB record ID — the worker fetches
 * fresh data at processing time for consistency and idempotency.
 */
export async function scheduleEmail(emailJob: EmailJob): Promise<string> {
  const now = Date.now();
  const scheduledTime = new Date(emailJob.scheduled_at).getTime();
  const delay = Math.max(0, scheduledTime - now);

  // Workaround: If using mock Redis, don't use delayed jobs (not supported)
  // Instead, mark as 'scheduled' and let the polling scheduler pick it up
  if (config.USE_MOCK_REDIS) {
    console.log(`[Queue] Job ${emailJob.id} marked as scheduled (polling mode)`);
    return emailJob.id;
  }

  const bullJob = await emailQueue.add(
    'send-email',
    {
      emailJobId: emailJob.id,
    },
    {
      delay,
      jobId: `email-${emailJob.id}`, // Deterministic job ID for deduplication
    }
  );

  // Update the DB record with the BullMQ job ID
  await emailJobModel.updateStatus(emailJob.id, 'queued', {
    bullmq_job_id: bullJob.id ?? null,
  });

  console.log(
    `[Queue] Scheduled job ${emailJob.id} with delay ${delay}ms (BullMQ ID: ${bullJob.id})`
  );

  return bullJob.id ?? '';
}

/**
 * Reschedule a rate-limited job at a new time.
 */
export async function rescheduleJob(emailJobId: string, newScheduledAt: Date): Promise<string> {
  const now = Date.now();
  const delay = Math.max(0, newScheduledAt.getTime() - now);

  // Remove the old job if it exists
  const existingJob = await emailQueue.getJob(`email-${emailJobId}`);
  if (existingJob) {
    try {
      await existingJob.remove();
    } catch {
      // Job might already be processing/completed — that's fine
    }
  }

  const bullJob = await emailQueue.add(
    'send-email',
    { emailJobId },
    {
      delay,
      jobId: `email-${emailJobId}-retry-${Date.now()}`,
    }
  );

  await emailJobModel.updateStatus(emailJobId, 'queued', {
    bullmq_job_id: bullJob.id ?? null,
  });

  console.log(`[Queue] Rescheduled job ${emailJobId} with delay ${delay}ms`);
  return bullJob.id ?? '';
}

/**
 * Returns current queue statistics.
 */
export async function getQueueStats(): Promise<QueueStats> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Rehydrate jobs after a restart.
 *
 * Queries the DB for all emails that are still pending (scheduled/queued/rate_limited),
 * checks whether they already have a live BullMQ job, and re-enqueues any missing ones.
 */
export async function rehydrateJobs(): Promise<number> {
  console.log('[Queue] Rehydrating pending jobs from database...');

  const pendingJobs = await emailJobModel.findPendingJobs();

  if (pendingJobs.length === 0) {
    console.log('[Queue] No pending jobs to rehydrate.');
    return 0;
  }

  let rehydrated = 0;

  for (const job of pendingJobs) {
    try {
      // Check if BullMQ already knows about this job
      const existingBullJob = await emailQueue.getJob(`email-${job.id}`);

      if (existingBullJob) {
        const state = await existingBullJob.getState();
        if (state !== 'completed' && state !== 'failed') {
          // Job is still alive in BullMQ — skip
          continue;
        }
      }

      // Re-add the job
      await scheduleEmail(job);
      rehydrated++;
    } catch (error) {
      console.error(`[Queue] Failed to rehydrate job ${job.id}:`, error);
    }
  }

  console.log(
    `[Queue] Rehydrated ${rehydrated} of ${pendingJobs.length} pending jobs.`
  );
  return rehydrated;
}

export default {
  emailQueue,
  scheduleEmail,
  rescheduleJob,
  getQueueStats,
  rehydrateJobs,
};
