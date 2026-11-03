// ─── Status enum ────────────────────────────────────────────────────────────

export type EmailJobStatus = 'scheduled' | 'queued' | 'sending' | 'sent' | 'failed' | 'rate_limited';

// ─── Domain models ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar: string | null;
  slack_access_token: string | null;
  slack_webhook_url: string | null;
  slack_channel_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailJob {
  id: string;
  user_id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  sent_at: Date | null;
  status: EmailJobStatus;
  bullmq_job_id: string | null;
  batch_id: string | null;
  error_message: string | null;
  idempotency_key: string;
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

export interface Sender {
  id: string;
  user_id: string;
  email: string;
  name: string;
  ethereal_user: string;
  ethereal_pass: string;
  created_at: Date;
}

// ─── Request DTOs ───────────────────────────────────────────────────────────

export interface CreateEmailJobRequest {
  subject: string;
  body: string;
  recipients: string[];
  sender_email: string;
  scheduled_at: string; // ISO 8601 date string
  delay_between_ms?: number;
  max_per_hour?: number;
}

export interface BatchScheduleRequest {
  subject: string;
  body: string;
  sender_email: string;
  scheduled_at: string;
  delay_between_ms?: number;
  max_per_hour?: number;
  /** CSV-parsed recipient list — populated by the upload controller */
  recipients: string[];
}

// ─── API response wrapper ───────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// ─── Search ─────────────────────────────────────────────────────────────────

export interface SearchQuery {
  q: string;
  page?: number;
  limit?: number;
}

// ─── Rate limit result ──────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ─── Queue stats ────────────────────────────────────────────────────────────

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ─── Express augmentation ───────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      google_id: string;
      email: string;
      name: string;
      avatar: string | null;
      slack_access_token: string | null;
      slack_webhook_url: string | null;
      slack_channel_id: string | null;
      created_at: Date;
      updated_at: Date;
    }
  }
}
