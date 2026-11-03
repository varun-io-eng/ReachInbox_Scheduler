import { Worker, Job } from 'bullmq';
import { bullRedis } from '../config/redis.js';
import config from '../config/index.js';
import emailJobModel from '../models/emailJobModel.js';
import senderModel from '../models/senderModel.js';
import etherealService from '../services/etherealService.js';
import rateLimiterService from '../services/rateLimiterService.js';
import { rescheduleJob } from '../services/queueService.js';
import slackService from '../services/slackService.js';
import { indexEmailDocument } from '../config/elasticsearch.js';

const QUEUE_NAME = 'email-sending';

interface EmailJobData {
  emailJobId: string;
}

/**
 * Delay helper — respects MIN_DELAY_BETWEEN_SENDS_MS to throttle outbound sends.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a single email job (extracted for use by polling scheduler).
 */
export async function processEmailJob(data: EmailJobData): Promise<void> {
  const { emailJobId } = data;
  console.log(`[Worker] Processing job ${emailJobId}`);

  // ── 1. Fetch job from DB ───────────────────────────────────────────
  const emailJob = await emailJobModel.findById(emailJobId);

  if (!emailJob) {
    console.warn(`[Worker] Email job ${emailJobId} not found in DB — skipping.`);
    return;
  }

  // ── 2. Idempotency check ───────────────────────────────────────────
  if (emailJob.status === 'sent') {
    console.log(`[Worker] Job ${emailJobId} already sent — skipping (idempotent).`);
    return;
  }

  // ── 3. Rate-limit check ────────────────────────────────────────────
  const rateLimit = await rateLimiterService.checkRateLimit(emailJob.sender_email);

  if (!rateLimit.allowed) {
    console.log(
      `[Worker] Rate limit hit for sender ${emailJob.sender_email}. ` +
      `Remaining: ${rateLimit.remaining}. Rescheduling to ${rateLimit.resetAt.toISOString()}`
    );

    // 4a. Update status
    await emailJobModel.updateStatus(emailJobId, 'rate_limited');

    // 4b. Reschedule to next window (mock: just set new scheduled_at)
    await emailJobModel.updateStatus(emailJobId, 'scheduled', {
      scheduled_at: rateLimit.resetAt.toISOString(),
    });

    // 4c. Notify via Slack
    const usage = await rateLimiterService.getUsage(emailJob.sender_email);
    await slackService.notifyRateLimitHit(
      emailJob.user_id,
      emailJob.sender_email,
      usage,
      config.MAX_EMAILS_PER_HOUR_PER_SENDER
    );

    // Return without throwing — this is expected behaviour
    return;
  }

  // ── 5. Artificial delay between sends ──────────────────────────────
  if (config.MIN_DELAY_BETWEEN_SENDS_MS > 0) {
    await delay(config.MIN_DELAY_BETWEEN_SENDS_MS);
  }

  // ── 6. Mark as sending ─────────────────────────────────────────────
  await emailJobModel.updateStatus(emailJobId, 'sending', {
    attempts: emailJob.attempts + 1,
  });

  // ── 7. Resolve sender Ethereal credentials ─────────────────────────
  const sender = await senderModel.findByEmail(emailJob.user_id, emailJob.sender_email);

  if (!sender) {
    throw new Error(`No sender registered for email ${emailJob.sender_email}`);
  }

  // ── 8. Send email ──────────────────────────────────────────────────
  const { messageId, previewUrl } = await etherealService.sendEmail(
    sender.name,
    emailJob.recipient_email,
    emailJob.subject,
    emailJob.body,
    sender.ethereal_user,
    sender.ethereal_pass
  );

  console.log(
    `[Worker] Email sent for job ${emailJobId} | ` +
    `MessageID: ${messageId} | Preview: ${previewUrl}`
  );

  // ── 9. Mark as sent ────────────────────────────────────────────────
  const updatedJob = await emailJobModel.markAsSent(emailJobId);

  // ── 10. Increment rate-limit counter ───────────────────────────────
  await rateLimiterService.incrementCounter(emailJob.sender_email);

  // ── 11. Index in Elasticsearch ─────────────────────────────────────
  if (updatedJob) {
    try {
      await indexEmailDocument({
        id: updatedJob.id,
        user_id: updatedJob.user_id,
        subject: updatedJob.subject,
        body: updatedJob.body,
        recipient_email: updatedJob.recipient_email,
        sender_email: updatedJob.sender_email,
        status: updatedJob.status,
        batch_id: updatedJob.batch_id,
        scheduled_at: updatedJob.scheduled_at,
        sent_at: updatedJob.sent_at,
        created_at: updatedJob.created_at,
      });
    } catch (esError) {
      // Non-fatal — log and continue
      console.error('[Worker] Elasticsearch indexing failed:', esError);
    }
  }
}

/**
 * Creates and starts the BullMQ email worker.
 */
export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      await processEmailJob(job.data);
    },
    {
      connection: bullRedis,
      concurrency: config.WORKER_CONCURRENCY,
      limiter: {
        max: config.MAX_EMAILS_PER_HOUR,
        duration: 3_600_000,
      },
    }
  );

  // ── Worker event handlers ────────────────────────────────────────────────
  worker.on('completed', (job) => {
    console.log(`[Worker] Job completed: ${job.id}`);
  });

  worker.on('failed', async (job, error) => {
    const emailJobId = job?.data?.emailJobId;
    console.error(`[Worker] Job failed: ${job?.id} — ${error.message}`);

    if (emailJobId) {
      try {
        await emailJobModel.updateStatus(emailJobId, 'failed', {
          error_message: error.message,
        });
      } catch (dbError) {
        console.error('[Worker] Failed to update job status on failure:', dbError);
      }
    }
  });

  worker.on('error', (error) => {
    console.error('[Worker] Worker error:', error.message);
  });

  console.log(
    `[Worker] Email worker started (concurrency: ${config.WORKER_CONCURRENCY}, ` +
    `rate limit: ${config.MAX_EMAILS_PER_HOUR}/hr)`
  );

  return worker;
}

export default { startEmailWorker, processEmailJob };
