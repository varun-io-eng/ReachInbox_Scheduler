import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import passport from 'passport';

import config from './config/index.js';
import { configurePassport } from './middleware/auth.js';
import db, { runMigrations } from './config/database.js';
import { createEmailIndex } from './config/elasticsearch.js';
import { emailQueue, rehydrateJobs } from './services/queueService.js';
import { startEmailWorker } from './workers/emailWorker.js';
import emailJobModel from './models/emailJobModel.js';
import routes from './routes/index.js';

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║       ReachInbox Email Scheduler v1.0.0           ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`[Server] Environment: ${config.NODE_ENV}`);
  if (config.USE_SQLITE) console.log('[Server] 📦 Using SQLite (no PostgreSQL needed)');
  if (config.USE_MOCK_REDIS) console.log('[Server] 📦 Using mock Redis (no Redis needed)');
  if (config.DEV_AUTH_BYPASS) console.log('[Server] 🔓 Auth bypass enabled (no Google OAuth needed)');

  // ── 1. Database migrations ────────────────────────────────────────────────
  console.log('[DB] Running migrations...');
  await runMigrations();
  console.log('[DB] Migrations complete.');

  // ── 2. Elasticsearch index ────────────────────────────────────────────────
  try {
    await createEmailIndex();
    console.log('[ES] Elasticsearch index ready.');
  } catch (error) {
    console.warn('[ES] Elasticsearch not available — search will fallback to DB.', (error as Error).message);
  }

  // ── 3. Express app setup ──────────────────────────────────────────────────
  const app = express();

  // Security & logging
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow Bull Board inline scripts
    })
  );
  app.use(morgan('short'));

  // CORS
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Sessions
  app.use(
    session({
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax',
      },
    })
  );

  // Passport
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // ── 4. Bull Board dashboard ───────────────────────────────────────────────
  try {
    const { createBullBoard } = await import('@bull-board/api');
    const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter.js');
    const { ExpressAdapter } = await import('@bull-board/express');

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullMQAdapter(emailQueue)],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());
    console.log('[BullBoard] Dashboard available at /admin/queues');
  } catch (error) {
    console.warn('[BullBoard] Could not initialize dashboard:', (error as Error).message);
  }

  // ── 5. API routes ────────────────────────────────────────────────────────
  app.use('/api', routes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // Global error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('[Server] Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      });
    }
  );

  // ── 6. Rehydrate jobs from DB ─────────────────────────────────────────────
  console.log('[Queue] Rehydrating jobs from database...');
  const rehydratedCount = await rehydrateJobs();
  console.log(`[Queue] Rehydrated ${rehydratedCount} job(s).`);

  // ── 7. Start email worker ─────────────────────────────────────────────────
  startEmailWorker();
  console.log(`[Worker] Email worker started with concurrency=${config.WORKER_CONCURRENCY}`);

  // ── 7b. Simple polling scheduler (workaround for old Redis) ─────────────────
  if (config.USE_MOCK_REDIS) {
    console.log('[Scheduler] Using polling-based scheduler (mock Redis workaround)');
    const POLL_INTERVAL_MS = 10000; // Check every 10 seconds

    // Import worker logic directly for processing
    const { processEmailJob } = await import('./workers/emailWorker.js');

    const pollScheduler = setInterval(async () => {
      try {
        const now = new Date();
        const dueJobs = await emailJobModel.findDueJobs(now);

        if (dueJobs.length > 0) {
          console.log(`[Scheduler] Found ${dueJobs.length} due job(s), processing directly`);
          for (const job of dueJobs) {
            try {
              await emailJobModel.updateStatus(job.id, 'queued');
              // Process directly without BullMQ
              await processEmailJob({ emailJobId: job.id });
            } catch (error) {
              console.error(`[Scheduler] Failed to process job ${job.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('[Scheduler] Polling error:', error);
      }
    }, POLL_INTERVAL_MS);

    // Store interval for cleanup
    (global as any).pollScheduler = pollScheduler;
  }

  // ── 8. Start server ──────────────────────────────────────────────────────
  app.listen(config.PORT, () => {
    console.log(`[Server] Listening on http://localhost:${config.PORT}`);
    console.log(`[Server] Frontend expected at ${config.FRONTEND_URL}`);
    console.log('');
    console.log('Ready to schedule emails! 🚀');
  });

  // ── 9. Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully...`);

    // Clear polling scheduler if running
    if ((global as any).pollScheduler) {
      clearInterval((global as any).pollScheduler);
      console.log('[Scheduler] Polling scheduler stopped.');
    }

    try {
      await emailQueue.close();
      console.log('[Queue] Queue closed.');
    } catch (error) {
      console.error('[Queue] Error closing queue:', error);
    }

    try {
      await db.destroy();
      console.log('[DB] Database connection closed.');
    } catch (error) {
      console.error('[DB] Error closing database:', error);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});
