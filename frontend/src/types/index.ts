export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  slackConnected: boolean;
}

export interface EmailJob {
  id: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: 'scheduled' | 'queued' | 'sending' | 'sent' | 'failed' | 'rate_limited';
  error_message: string | null;
  batch_id: string | null;
  created_at: string;
}

export interface Sender {
  id: string;
  email: string;
  name: string;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  sender_email: string;
  scheduled_at: string;
  delay_between_ms: number;
  max_per_hour: number;
}
