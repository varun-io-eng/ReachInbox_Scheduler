import db from '../config/database.js';
import config from '../config/index.js';
import type { EmailJob, EmailJobStatus } from '../types/index.js';

const TABLE = 'email_jobs';

/**
 * Create a new email job record.
 */
export async function create(data: {
  id: string;
  user_id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status?: EmailJobStatus;
  bullmq_job_id?: string | null;
  batch_id?: string | null;
  idempotency_key: string;
}): Promise<EmailJob> {
  const row = {
    ...data,
    scheduled_at: data.scheduled_at instanceof Date ? data.scheduled_at.toISOString() : data.scheduled_at,
    status: data.status ?? 'scheduled',
    attempts: 0,
  };

  if (config.USE_SQLITE) {
    await db.table(TABLE).insert(row);
    return db.table(TABLE).first({ id: data.id }) as Promise<EmailJob>;
  }
  const [job] = await db<EmailJob>(TABLE).insert(row).returning('*');
  return job;
}

/**
 * Find an email job by primary key.
 */
export async function findById(id: string): Promise<EmailJob | undefined> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).first({ id }) as Promise<EmailJob | undefined>;
  }
  return db<EmailJob>(TABLE).where({ id }).first();
}

/**
 * Find all email jobs for a user with pagination.
 */
export async function findByUserId(
  userId: string,
  options: { page?: number; limit?: number; status?: EmailJobStatus } = {}
): Promise<{ jobs: EmailJob[]; total: number }> {
  const { page = 1, limit = 20, status } = options;
  const offset = (page - 1) * limit;

  if (config.USE_SQLITE) {
    const conditions: Record<string, any> = { user_id: userId };
    if (status) conditions.status = status;
    const result = await db.table(TABLE).query({
      conditions,
      orderBy: 'scheduled_at',
      order: 'desc',
      limit,
      offset,
    });
    return { jobs: result.rows as EmailJob[], total: result.total };
  }

  const query = db<EmailJob>(TABLE).where({ user_id: userId });
  if (status) query.andWhere({ status });

  const countQuery = query.clone().count('id as count').first();
  const dataQuery = query.clone().orderBy('scheduled_at', 'desc').limit(limit).offset(offset);

  const [countResult, jobs] = await Promise.all([countQuery, dataQuery]);
  const total = parseInt(String((countResult as { count: string })?.count ?? '0'), 10);

  return { jobs, total };
}

/**
 * Find all scheduled (not yet queued/sent) jobs for a user.
 */
export async function findScheduled(userId: string): Promise<EmailJob[]> {
  if (config.USE_SQLITE) {
    const result = await db.table(TABLE).query({
      conditions: { user_id: userId, status: 'scheduled' },
      orderBy: 'scheduled_at',
      order: 'asc',
    });
    return result.rows as EmailJob[];
  }
  return db<EmailJob>(TABLE)
    .where({ user_id: userId, status: 'scheduled' })
    .orderBy('scheduled_at', 'asc');
}

/**
 * Find all email jobs for a user with pagination, filtered by multiple statuses.
 */
export async function findByUserIdMultiStatus(
  userId: string,
  options: { page?: number; limit?: number; statuses: EmailJobStatus[] }
): Promise<{ jobs: EmailJob[]; total: number }> {
  const { page = 1, limit = 20, statuses } = options;
  const offset = (page - 1) * limit;

  if (config.USE_SQLITE) {
    const result = await db.table(TABLE).query({
      conditions: { user_id: userId },
      statuses,
      orderBy: 'scheduled_at',
      order: 'desc',
      limit,
      offset,
    });
    return { jobs: result.rows as EmailJob[], total: result.total };
  }

  const query = db<EmailJob>(TABLE).where({ user_id: userId }).whereIn('status', statuses);

  const countQuery = query.clone().count('id as count').first();
  const dataQuery = query.clone().orderBy('scheduled_at', 'desc').limit(limit).offset(offset);

  const [countResult, jobs] = await Promise.all([countQuery, dataQuery]);
  const total = parseInt(String((countResult as { count: string })?.count ?? '0'), 10);

  return { jobs, total };
}

/**
 * Find sent emails for a user with pagination.
 */
export async function findSent(
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<{ jobs: EmailJob[]; total: number }> {
  return findByUserId(userId, { ...options, status: 'sent' });
}

/**
 * Update the status of an email job.
 */
export async function updateStatus(
  id: string,
  status: EmailJobStatus,
  extra: Partial<Pick<EmailJob, 'bullmq_job_id' | 'error_message' | 'attempts'>> = {}
): Promise<EmailJob | undefined> {
  if (config.USE_SQLITE) {
    await db.table(TABLE).update({ id }, { status, ...extra });
    return db.table(TABLE).first({ id }) as Promise<EmailJob | undefined>;
  }
  const [job] = await db<EmailJob>(TABLE)
    .where({ id })
    .update({ status, ...extra, updated_at: db.fn.now() })
    .returning('*');
  return job;
}

/**
 * Mark an email job as sent.
 */
export async function markAsSent(id: string): Promise<EmailJob | undefined> {
  const now = new Date().toISOString();
  if (config.USE_SQLITE) {
    await db.table(TABLE).update({ id }, { status: 'sent', sent_at: now });
    return db.table(TABLE).first({ id }) as Promise<EmailJob | undefined>;
  }
  const [job] = await db<EmailJob>(TABLE)
    .where({ id })
    .update({
      status: 'sent',
      sent_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  return job;
}

/**
 * Find a job by its idempotency key (for deduplication).
 */
export async function findByIdempotencyKey(key: string): Promise<EmailJob | undefined> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).first({ idempotency_key: key }) as Promise<EmailJob | undefined>;
  }
  return db<EmailJob>(TABLE).where({ idempotency_key: key }).first();
}

/**
 * Count emails with status = 'sent' for a given sender in the last `windowMs` milliseconds.
 */
export async function countSentInWindow(
  senderEmail: string,
  windowMs: number = 3_600_000
): Promise<number> {
  const since = new Date(Date.now() - windowMs);

  if (config.USE_SQLITE) {
    return db.table(TABLE).countWhere(
      { sender_email: senderEmail, status: 'sent' },
      (row: Record<string, any>) => new Date(row.sent_at) >= since
    );
  }

  const result = await db<EmailJob>(TABLE)
    .where({ sender_email: senderEmail, status: 'sent' })
    .andWhere('sent_at', '>=', since)
    .count('id as count')
    .first();
  return parseInt(String((result as { count: string })?.count ?? '0'), 10);
}

/**
 * Find all jobs that are in 'scheduled' or 'queued' state (for rehydration after restart).
 */
export async function findPendingJobs(): Promise<EmailJob[]> {
  if (config.USE_SQLITE) {
    const result = await db.table(TABLE).query({
      statuses: ['scheduled', 'queued', 'rate_limited'],
      orderBy: 'scheduled_at',
      order: 'asc',
    });
    return result.rows as EmailJob[];
  }
  return db<EmailJob>(TABLE)
    .whereIn('status', ['scheduled', 'queued', 'rate_limited'])
    .orderBy('scheduled_at', 'asc');
}

/**
 * Find jobs that are due to be sent (scheduled_at <= now and status = 'scheduled').
 */
export async function findDueJobs(now: Date): Promise<EmailJob[]> {
  const nowIso = now.toISOString();

  if (config.USE_SQLITE) {
    const result = await db.table(TABLE).query({
      conditions: { status: 'scheduled' },
      customFilter: (row: Record<string, any>) => new Date(row.scheduled_at) <= now,
      orderBy: 'scheduled_at',
      order: 'asc',
    });
    return result.rows as EmailJob[];
  }

  return db<EmailJob>(TABLE)
    .where({ status: 'scheduled' })
    .andWhere('scheduled_at', '<=', nowIso)
    .orderBy('scheduled_at', 'asc');
}

export default {
  create,
  findById,
  findByUserId,
  findByUserIdMultiStatus,
  findScheduled,
  findSent,
  updateStatus,
  markAsSent,
  findByIdempotencyKey,
  countSentInWindow,
  findPendingJobs,
  findDueJobs,
};
