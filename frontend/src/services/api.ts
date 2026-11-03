import axios from 'axios';
import type {
  User,
  EmailJob,
  Sender,
  QueueStats,
  PaginatedResponse,
  ScheduleEmailRequest,
} from '@/types';

// ── API response wrapper types ─────────────────────────────
interface ApiResponse<T = unknown> {
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

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Auth ────────────────────────────────────────────────────
export const authApi = {
  getMe: () =>
    api
      .get<ApiResponse<{ id: string; email: string; name: string; avatar: string | null; slackConnected: boolean }>>('/auth/me')
      .then((r) => r.data.data as User),

  logout: () => api.post('/auth/logout').then((r) => r.data),
};

// ── Emails ──────────────────────────────────────────────────
export const emailApi = {
  scheduleEmails: (data: ScheduleEmailRequest) =>
    api.post<ApiResponse>('/emails/schedule', data).then((r) => r.data),

  getScheduledEmails: (page = 1, limit = 20): Promise<PaginatedResponse<EmailJob>> =>
    api
      .get<ApiResponse<EmailJob[]>>('/emails/scheduled', {
        params: { page, limit },
      })
      .then((r) => ({
        data: r.data.data || [],
        total: r.data.meta?.total || 0,
        page: r.data.meta?.page || page,
        limit: r.data.meta?.limit || limit,
        totalPages: Math.ceil((r.data.meta?.total || 0) / (r.data.meta?.limit || limit)),
      })),

  getSentEmails: (page = 1, limit = 20): Promise<PaginatedResponse<EmailJob>> =>
    api
      .get<ApiResponse<EmailJob[]>>('/emails/sent', {
        params: { page, limit },
      })
      .then((r) => ({
        data: r.data.data || [],
        total: r.data.meta?.total || 0,
        page: r.data.meta?.page || page,
        limit: r.data.meta?.limit || limit,
        totalPages: Math.ceil((r.data.meta?.total || 0) / (r.data.meta?.limit || limit)),
      })),

  searchEmails: (query: string): Promise<EmailJob[]> =>
    api
      .get<ApiResponse<EmailJob[]>>('/emails/search', { params: { q: query } })
      .then((r) => r.data.data || []),

  getEmailStats: (): Promise<QueueStats> =>
    api
      .get<ApiResponse<QueueStats>>('/emails/stats')
      .then((r) => r.data.data as QueueStats),
};

// ── Senders ─────────────────────────────────────────────────
export const senderApi = {
  getSenders: (): Promise<Sender[]> =>
    api
      .get<ApiResponse<Array<{ id: string; email: string; name: string }>>>('/senders')
      .then((r) => (r.data.data || []) as Sender[]),

  createSender: (email: string, name: string): Promise<Sender> =>
    api
      .post<ApiResponse<Sender>>('/senders', { email, name })
      .then((r) => r.data.data as Sender),

  deleteSender: (id: string) =>
    api.delete(`/senders/${id}`).then((r) => r.data),
};

// ── Slack ───────────────────────────────────────────────────
export const slackApi = {
  getStatus: (): Promise<{ connected: boolean }> =>
    api
      .get<ApiResponse<{ connected: boolean; channel_id: string | null }>>('/slack/status')
      .then((r) => r.data.data as { connected: boolean }),

  disconnect: () => api.post('/slack/disconnect').then((r) => r.data),
};

// ── Upload ──────────────────────────────────────────────────
export const uploadApi = {
  uploadCSV: (file: File): Promise<{ emails: string[]; count: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post<ApiResponse<{ emails: string[]; count: number; filename: string }>>('/upload/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data as { emails: string[]; count: number });
  },
};

export default api;
