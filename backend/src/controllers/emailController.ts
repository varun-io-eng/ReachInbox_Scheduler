import { Request, Response } from 'express';
import emailJobModel from '../models/emailJobModel.js';
import etherealService from '../services/etherealService.js';
import queueService from '../services/queueService.js';
import { searchEmails, indexEmailDocument } from '../config/elasticsearch.js';
import type { ApiResponse, CreateEmailJobRequest } from '../types/index.js';

/**
 * POST /api/emails/schedule
 * Schedules one or more emails for future delivery.
 */
export async function scheduleEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const {
      subject,
      body,
      recipients,
      sender_email,
      scheduled_at,
      delay_between_ms = 0,
    } = req.body as CreateEmailJobRequest;

    // Validate required fields
    if (!subject || !body || !recipients?.length || !sender_email || !scheduled_at) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: subject, body, recipients, sender_email, scheduled_at',
      } satisfies ApiResponse);
      return;
    }

    // Ensure sender exists (creates Ethereal account if needed)
    await etherealService.getOrCreateSender(userId, sender_email, sender_email.split('@')[0]);

    const batchId = crypto.randomUUID();
    const scheduledDate = new Date(scheduled_at);
    const createdJobs: string[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i].trim().toLowerCase();

      if (!recipientEmail) continue;

      // Stagger scheduling if delay_between_ms is set
      const staggeredDate = new Date(scheduledDate.getTime() + i * delay_between_ms);

      // Build idempotency key
      const idempotencyKey = `${batchId}:${recipientEmail}:${staggeredDate.getTime()}`;

      // Check for duplicate
      const existing = await emailJobModel.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        console.log(`[API] Skipping duplicate: ${idempotencyKey}`);
        createdJobs.push(existing.id);
        continue;
      }

      // Create DB record
      const jobId = crypto.randomUUID();
      const emailJob = await emailJobModel.create({
        id: jobId,
        user_id: userId,
        recipient_email: recipientEmail,
        sender_email,
        subject,
        body,
        scheduled_at: staggeredDate,
        batch_id: batchId,
        idempotency_key: idempotencyKey,
      });

      // Enqueue in BullMQ
      await queueService.scheduleEmail(emailJob);

      // Index in Elasticsearch (scheduled state)
      await indexEmailDocument({
        id: emailJob.id,
        user_id: emailJob.user_id,
        subject: emailJob.subject,
        body: emailJob.body,
        recipient_email: emailJob.recipient_email,
        sender_email: emailJob.sender_email,
        status: emailJob.status,
        batch_id: emailJob.batch_id,
        scheduled_at: emailJob.scheduled_at,
        created_at: emailJob.created_at,
      });

      createdJobs.push(emailJob.id);
    }

    console.log(
      `[API] Scheduled ${createdJobs.length} emails for batch ${batchId} by user ${userId}`
    );

    res.status(201).json({
      success: true,
      data: {
        batch_id: batchId,
        job_ids: createdJobs,
        count: createdJobs.length,
      },
      message: `${createdJobs.length} email(s) scheduled successfully.`,
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[API] Schedule emails error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule emails',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/emails/scheduled
 * Returns paginated list of scheduled emails for the current user.
 */
export async function getScheduledEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const { jobs, total } = await emailJobModel.findByUserIdMultiStatus(userId, {
      page,
      limit,
      statuses: ['scheduled', 'queued', 'sending', 'rate_limited'],
    });

    res.json({
      success: true,
      data: jobs,
      meta: { page, limit, total },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[API] Get scheduled emails error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled emails',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/emails/sent
 * Returns paginated list of sent emails for the current user.
 */
export async function getSentEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const { jobs, total } = await emailJobModel.findByUserIdMultiStatus(userId, {
      page,
      limit,
      statuses: ['sent', 'failed'],
    });

    res.json({
      success: true,
      data: jobs,
      meta: { page, limit, total },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[API] Get sent emails error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sent emails',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/emails/search?q=...
 * Full-text search across emails via Elasticsearch.
 */
export async function searchEmailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const q = (req.query.q as string) ?? '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!q.trim()) {
      res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      } satisfies ApiResponse);
      return;
    }

    const from = (page - 1) * limit;
    const { hits, total } = await searchEmails(q, userId, { from, size: limit });

    res.json({
      success: true,
      data: hits,
      meta: { page, limit, total },
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[API] Search emails error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/emails/:id
 * Returns a single email job by ID.
 */
export async function getEmailById(req: Request, res: Response): Promise<void> {
  try {
    const job = await emailJobModel.findById(req.params.id);

    if (!job || job.user_id !== req.user!.id) {
      res.status(404).json({
        success: false,
        error: 'Email job not found',
      } satisfies ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: job,
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[API] Get email by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email job',
    } satisfies ApiResponse);
  }
}

/**
 * GET /api/emails/stats
 * Returns current queue statistics.
 */
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await queueService.getQueueStats();

    res.json({
      success: true,
      data: stats,
    } satisfies ApiResponse);
  } catch (error) {
    console.error('[API] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue statistics',
    } satisfies ApiResponse);
  }
}

export default {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  searchEmailsHandler,
  getEmailById,
  getStats,
};
