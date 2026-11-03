# ReachInbox Email Scheduler

A production-grade email scheduler service with a React dashboard, built for the ReachInbox hiring assignment.

![ReachInbox](https://img.shields.io/badge/ReachInbox-Email%20Scheduler-3B82F6?style=for-the-badge)

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐ │
│  │  Login   │  │  Dashboard   │  │  Compose  │  │  Tables   │ │
│  │  (OAuth) │  │  (Stats/Tabs)│  │  (Modal)  │  │ Sched/Sent│ │
│  └──────────┘  └──────────────┘  └───────────┘  └───────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────────┐
│                    Backend (Express + TypeScript)                │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  Auth        │  │  Email API   │  │  Slack Integration    ││
│  │  (Passport)  │  │  (CRUD)      │  │  (OAuth + Webhooks)   ││
│  └──────────────┘  └──────┬───────┘  └────────────────────────┘│
│                           │                                     │
│  ┌────────────────────────▼────────────────────────────────────┐│
│  │              Queue Service (BullMQ)                         ││
│  │  • Delayed jobs based on scheduled_at                       ││
│  │  • Configurable concurrency (default: 5 workers)            ││
│  │  • Built-in rate limiter                                    ││
│  │  • Job rehydration on restart                               ││
│  └─────────────┬──────────────────────┬────────────────────────┘│
│                │                      │                         │
│  ┌─────────────▼──────┐  ┌───────────▼─────────────┐          │
│  │   Email Worker      │  │   Rate Limiter Service  │          │
│  │   • Fetch from DB   │  │   • Redis sliding window│          │
│  │   • Check idempot.  │  │   • Per-sender counters │          │
│  │   • Check rate limit│  │   • Auto-expire (2h TTL)│          │
│  │   • Send via SMTP   │  │   • Slack notifications │          │
│  │   • Update status   │  └─────────────────────────┘          │
│  │   • Index in ES     │                                       │
│  └─────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
         │              │              │              │
    ┌────▼────┐   ┌─────▼────┐  ┌─────▼─────┐ ┌─────▼──────┐
    │ Redis   │   │ Postgres │  │ Ethereal  │ │Elasticsearch│
    │ (Queue) │   │  (Data)  │  │  (SMTP)   │ │  (Search)   │
    └─────────┘   └──────────┘  └───────────┘ └─────────────┘
```

## 🚀 Features Implemented

### Backend
| Feature | Status | Details |
|---------|--------|---------|
| Email scheduling via API | ✅ | POST /api/emails/schedule |
| BullMQ delayed jobs | ✅ | No cron jobs used |
| PostgreSQL persistence | ✅ | Knex query builder with migrations |
| Ethereal Email (SMTP) | ✅ | Auto-creates test accounts per sender |
| Elasticsearch search | ✅ | Full-text search on subject, body, emails |
| BullMQ Dashboard | ✅ | Available at /admin/queues |
| Server restart persistence | ✅ | Job rehydration from DB on startup |
| Idempotency | ✅ | Unique keys prevent duplicate sends |
| Worker concurrency | ✅ | Configurable via WORKER_CONCURRENCY |
| Per-sender rate limiting | ✅ | Redis sliding window counters |
| Delay between sends | ✅ | Configurable MIN_DELAY_BETWEEN_SENDS_MS |
| Slack OAuth integration | ✅ | Real OAuth flow + webhook notifications |
| Google OAuth login | ✅ | Passport.js with sessions |
| CSV upload & parsing | ✅ | Multer + csv-parse |
| Multiple senders | ✅ | Each with own Ethereal credentials |

### Frontend
| Feature | Status | Details |
|---------|--------|---------|
| Google OAuth login | ✅ | Real OAuth redirect flow |
| User profile display | ✅ | Name, email, avatar in header |
| Scheduled emails table | ✅ | Paginated with search |
| Sent emails table | ✅ | Paginated with search |
| Compose email modal | ✅ | Subject, body, CSV upload, scheduling |
| Queue statistics | ✅ | Real-time stats bar |
| Loading states | ✅ | Skeleton loaders |
| Empty states | ✅ | Helpful messages |
| Error handling | ✅ | Toast notifications |
| Slack connect/disconnect | ✅ | OAuth popup flow |
| Dark theme UI | ✅ | Tailwind CSS |
| Responsive design | ✅ | Desktop + tablet |

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm
- Docker & Docker Compose (for Redis, PostgreSQL, Elasticsearch)
- Google OAuth credentials (from Google Cloud Console)
- Slack App credentials (optional, for Slack notifications)

## 🛠 Setup Instructions

### 1. Start Infrastructure (Docker)

```bash
# From the project root
docker-compose up -d
```

This starts:
- **Redis** on port 6379
- **PostgreSQL** on port 5432 (user: reachinbox, pass: reachinbox_pass, db: reachinbox_db)
- **Elasticsearch** on port 9200

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

#### Configure .env:

```env
# Required: Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Optional: Slack OAuth (get from Slack API dashboard)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret

# Adjust rate limiting as needed
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000
```

#### Google OAuth Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API" or "Google People API"
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Set Authorized redirect URI to: `http://localhost:4000/api/auth/google/callback`
6. Copy Client ID and Secret to .env

#### Slack App Setup (Optional):
1. Go to [Slack API](https://api.slack.com/apps)
2. Create a new app
3. Add OAuth scopes: `incoming-webhook`, `chat:write`
4. Set Redirect URL to: `http://localhost:4000/api/slack/callback`
5. Copy Client ID and Secret to .env

```bash
# Start the backend (runs server + worker)
npm run dev
```

The backend runs on http://localhost:4000.
BullMQ Dashboard is available at http://localhost:4000/admin/queues.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend runs on http://localhost:5173.

## 🔧 How It Works

### Scheduling Flow

1. **User composes email** → Frontend sends POST /api/emails/schedule
2. **Backend creates DB records** → One row per recipient with unique idempotency_key
3. **BullMQ delayed jobs created** → Delay = scheduled_at - now (in milliseconds)
4. **Worker picks up jobs** when delay expires:
   - Fetches fresh data from DB (not from job payload)
   - Checks idempotency (skip if already sent)
   - Checks per-sender rate limit via Redis
   - If rate limited: reschedules to next hour window, notifies Slack
   - If allowed: sends via Ethereal SMTP, updates DB, indexes in Elasticsearch

### Persistence on Restart

When the server starts, it calls `rehydrateJobs()`:

1. Queries DB for all emails with status `scheduled` or `queued`
2. For each, checks if a corresponding BullMQ job exists
3. If missing (because Redis lost it or server crashed), re-adds the job with correct delay
4. Jobs that should have already been sent (scheduled_at < now) are queued immediately
5. This ensures **zero job loss** across restarts

**Key design choice**: Job payloads only contain the DB record ID. The worker always fetches the latest state from PostgreSQL. This means:
- If a job runs twice (unlikely but possible), the idempotency check prevents duplicate sends
- The DB is the source of truth, not Redis

### Rate Limiting & Concurrency

#### Worker Concurrency
- BullMQ worker runs with configurable concurrency (default: 5)
- Multiple jobs process in parallel safely because:
  - Each job operates on a different DB row
  - Rate limit checks use Redis atomic operations (INCR)
  - No shared in-memory state

#### Delay Between Sends
- Minimum 2 seconds between individual email sends (configurable via `MIN_DELAY_BETWEEN_SENDS_MS`)
- Implemented as an artificial delay in the worker before sending
- Mimics real email provider throttling requirements

#### Per-Sender Rate Limiting
- **Mechanism**: Redis sliding window counters
- **Key format**: `ratelimit:{senderId}:{hourWindow}` where hourWindow = `Math.floor(Date.now() / 3600000)`
- **Per-sender limit**: Configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: 50)
- **Global limit**: Configurable via `MAX_EMAILS_PER_HOUR` (default: 200)
- **When limit hit**:
  - Job is NOT dropped or failed
  - Status set to `rate_limited`
  - Job is rescheduled to the start of the next hour window
  - Order is preserved (jobs rescheduled with incremental delays)
  - Slack notification sent if user has connected Slack
- **TTL**: Counter keys expire after 2 hours (auto-cleanup)
- **Safety**: Uses Redis INCR (atomic), safe across multiple workers/instances

#### Behavior Under 1000+ Emails
When 1000+ emails are scheduled for roughly the same time:
1. BullMQ processes them with configured concurrency (5 at a time)
2. Each send has a minimum 2-second delay
3. Per-sender rate limit kicks in after 50 emails/hour (configurable)
4. Excess jobs are rescheduled to subsequent hour windows
5. With 50/hr limit: 1000 emails from one sender would take ~20 hours, spread evenly
6. Multiple senders can send in parallel, each with their own limit

### Slack Notifications
- User clicks "Connect Slack" → OAuth popup → authorizes → webhook stored
- When a sender's hourly limit is reached, a Slack message is sent:
  > "⚠️ Rate limit reached for sender@example.com: 50/50 emails sent this hour. Remaining jobs rescheduled to next window."
- If Slack is not connected, rate-limit hits silently continue (no crash)
- User can disconnect and reconnect without redeployment

## 📁 Project Structure

```
reachinbox-scheduler/
├── docker-compose.yml          # Redis, PostgreSQL, Elasticsearch
├── README.md
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts            # Express app entry point
│       ├── config/
│       │   ├── index.ts        # Environment configuration
│       │   ├── database.ts     # Knex + PostgreSQL setup
│       │   ├── redis.ts        # IORedis connections
│       │   └── elasticsearch.ts # ES client + index management
│       ├── types/
│       │   └── index.ts        # TypeScript interfaces
│       ├── models/
│       │   ├── userModel.ts    # User CRUD operations
│       │   ├── emailJobModel.ts # Email job CRUD + queries
│       │   └── senderModel.ts  # Sender management
│       ├── services/
│       │   ├── etherealService.ts  # SMTP via Ethereal
│       │   ├── queueService.ts     # BullMQ queue management
│       │   ├── rateLimiterService.ts # Redis rate limiting
│       │   └── slackService.ts     # Slack OAuth + webhooks
│       ├── workers/
│       │   └── emailWorker.ts  # BullMQ worker processor
│       ├── middleware/
│       │   └── auth.ts         # Passport + session auth
│       ├── controllers/
│       │   ├── authController.ts    # Google OAuth endpoints
│       │   ├── emailController.ts   # Email CRUD + scheduling
│       │   ├── slackController.ts   # Slack OAuth endpoints
│       │   ├── senderController.ts  # Sender management
│       │   └── uploadController.ts  # CSV file upload
│       └── routes/
│           └── index.ts        # Route aggregator
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── types/
        │   └── index.ts
        ├── services/
        │   └── api.ts           # Axios API client
        ├── context/
        │   └── AuthContext.tsx   # Auth state management
        ├── pages/
        │   ├── LoginPage.tsx
        │   └── DashboardPage.tsx
        └── components/
            ├── ui/
            │   ├── Button.tsx
            │   ├── Input.tsx
            │   ├── Modal.tsx
            │   ├── Table.tsx
            │   ├── Badge.tsx
            │   ├── Spinner.tsx
            │   ├── EmptyState.tsx
            │   └── Tabs.tsx
            ├── layout/
            │   ├── Header.tsx
            │   └── ProtectedRoute.tsx
            └── email/
                ├── ComposeModal.tsx
                ├── ScheduledEmailsTable.tsx
                ├── SentEmailsTable.tsx
                └── QueueStats.tsx
```

## 🔑 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/auth/google | Initiate Google OAuth |
| GET | /api/auth/google/callback | OAuth callback |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |

### Emails
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/emails/schedule | Schedule email(s) |
| GET | /api/emails/scheduled | Get scheduled emails (paginated) |
| GET | /api/emails/sent | Get sent emails (paginated) |
| GET | /api/emails/search?q=term | Search emails via Elasticsearch |
| GET | /api/emails/:id | Get single email details |
| GET | /api/emails/stats | Get queue statistics |

### Senders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/senders | Create sender |
| GET | /api/senders | List senders |
| DELETE | /api/senders/:id | Delete sender |

### Slack
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/slack/connect | Initiate Slack OAuth |
| GET | /api/slack/callback | Slack OAuth callback |
| POST | /api/slack/disconnect | Disconnect Slack |
| GET | /api/slack/status | Check Slack connection |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload/csv | Upload CSV for email parsing |

### Admin
| Path | Description |
|------|-------------|
| /admin/queues | BullMQ Dashboard (Bull Board) |

## 🧪 Testing the System

### Quick Test Flow
1. Start infrastructure: `docker-compose up -d`
2. Start backend: `cd backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev`
4. Open http://localhost:5173
5. Sign in with Google
6. Create a sender (or one is auto-created)
7. Click "Compose New Email"
8. Fill in subject, body, upload a CSV with email addresses
9. Set schedule time and click "Schedule"
10. Watch emails move from Scheduled → Sent tabs
11. Check Ethereal preview URLs in the backend logs

### Restart Persistence Test
1. Schedule some emails for 5-10 minutes in the future
2. Stop the backend (Ctrl+C)
3. Start the backend again: `npm run dev`
4. Observe logs: "Rehydrated X jobs from database"
5. Emails still send at the correct scheduled time

### Rate Limiting Test
1. Set `MAX_EMAILS_PER_HOUR_PER_SENDER=5` in .env
2. Schedule 10+ emails for immediate send
3. First 5 send normally
4. Remaining are rescheduled with "rate_limited" status
5. If Slack is connected, you'll receive a notification

## ⚠️ Assumptions & Trade-offs

1. **Single-server deployment**: The worker runs in the same process as the Express server for simplicity. In production, workers would be separate processes/containers.

2. **Ethereal Email**: All emails go to Ethereal's fake SMTP. Preview URLs are logged. In production, this would be replaced with a real SMTP provider (SendGrid, SES, etc.).

3. **Session-based auth**: Using express-session with in-memory store. In production, use Redis session store (`connect-redis`).

4. **Elasticsearch optional**: If Elasticsearch is not available, the app still works — search falls back to DB queries.

5. **Rate limit precision**: The sliding window uses hour-aligned windows (not true sliding). A burst at the boundary of two windows could theoretically send up to 2x the limit. This is acceptable for this use case and simpler to implement.

6. **CSV parsing**: Uses regex to extract email-like patterns. Does not validate email deliverability.

7. **No email templates**: Body is plain text. In production, you'd support HTML templates.

8. **BullMQ limiter**: We use BOTH BullMQ's built-in limiter (as a safety net) AND custom Redis counters (for per-sender granularity and Slack notifications).

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Backend server port |
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5432 | PostgreSQL port |
| DB_USER | reachinbox | PostgreSQL user |
| DB_PASSWORD | reachinbox_pass | PostgreSQL password |
| DB_NAME | reachinbox_db | PostgreSQL database |
| REDIS_HOST | localhost | Redis host |
| REDIS_PORT | 6379 | Redis port |
| ELASTICSEARCH_URL | http://localhost:9200 | Elasticsearch URL |
| SESSION_SECRET | (required) | Express session secret |
| GOOGLE_CLIENT_ID | (required) | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | (required) | Google OAuth client secret |
| SLACK_CLIENT_ID | (optional) | Slack app client ID |
| SLACK_CLIENT_SECRET | (optional) | Slack app client secret |
| MAX_EMAILS_PER_HOUR | 200 | Global hourly email limit |
| MAX_EMAILS_PER_HOUR_PER_SENDER | 50 | Per-sender hourly limit |
| WORKER_CONCURRENCY | 5 | BullMQ worker concurrency |
| MIN_DELAY_BETWEEN_SENDS_MS | 2000 | Min delay between sends |

## 📜 License

This project was built as a hiring assignment for ReachInbox.ai (Outbox Labs).

