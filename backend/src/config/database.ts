import config from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════
// When USE_SQLITE=true, we use a simple in-memory store persisted to JSON.
// This avoids any native dependency issues on Windows.
// When USE_SQLITE=false, we use the real Knex+PostgreSQL connection.
// ═══════════════════════════════════════════════════════════════════════════

interface InMemoryDB {
  users: Record<string, any>[];
  email_jobs: Record<string, any>[];
  senders: Record<string, any>[];
}

let memoryStore: InMemoryDB = { users: [], email_jobs: [], senders: [] };
let dataFilePath: string;

if (config.USE_SQLITE) {
  const dataDir = path.resolve(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  dataFilePath = path.join(dataDir, 'db.json');
  if (fs.existsSync(dataFilePath)) {
    try {
      memoryStore = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
      console.log('[Database] Loaded data from', dataFilePath);
    } catch {
      console.warn('[Database] Could not parse db.json, starting fresh');
    }
  }
}

function persist(): void {
  if (config.USE_SQLITE) {
    fs.writeFileSync(dataFilePath, JSON.stringify(memoryStore, null, 2));
  }
}

// ─── Lightweight query builder that mirrors how the models use Knex ──────

export class SimpleTable {
  private tableName: keyof InMemoryDB;

  constructor(tableName: string) {
    this.tableName = tableName as keyof InMemoryDB;
  }

  private get rows(): Record<string, any>[] {
    return memoryStore[this.tableName];
  }

  async insert(data: Record<string, any> | Record<string, any>[]): Promise<void> {
    const items = Array.isArray(data) ? data : [data];
    for (const item of items) {
      const row = {
        ...item,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
      };
      this.rows.push(row);
    }
    persist();
  }

  async where(conditions: Record<string, any>): Promise<Record<string, any>[]> {
    return this.rows.filter((row) =>
      Object.entries(conditions).every(([key, value]) => row[key] === value)
    );
  }

  async whereIn(field: string, values: any[]): Promise<Record<string, any>[]> {
    return this.rows.filter((row) => values.includes(row[field]));
  }

  async first(conditions: Record<string, any>): Promise<Record<string, any> | undefined> {
    return this.rows.find((row) =>
      Object.entries(conditions).every(([key, value]) => row[key] === value)
    );
  }

  async update(conditions: Record<string, any>, data: Record<string, any>): Promise<void> {
    for (const row of this.rows) {
      const matches = Object.entries(conditions).every(([key, value]) => row[key] === value);
      if (matches) {
        Object.assign(row, data, { updated_at: new Date().toISOString() });
      }
    }
    persist();
  }

  async delete(conditions: Record<string, any>): Promise<number> {
    const before = this.rows.length;
    memoryStore[this.tableName] = this.rows.filter(
      (row) => !Object.entries(conditions).every(([key, value]) => row[key] === value)
    );
    persist();
    return before - memoryStore[this.tableName].length;
  }

  async count(conditions: Record<string, any> = {}): Promise<number> {
    if (Object.keys(conditions).length === 0) return this.rows.length;
    return (await this.where(conditions)).length;
  }

  async countWhere(conditions: Record<string, any>, extraFilter?: (row: Record<string, any>) => boolean): Promise<number> {
    let results = await this.where(conditions);
    if (extraFilter) results = results.filter(extraFilter);
    return results.length;
  }

  /**
   * Query with pagination, sorting, and filtering.
   */
  async query(options: {
    conditions?: Record<string, any>;
    statuses?: string[];
    orderBy?: string;
    order?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
    extraFilter?: (row: Record<string, any>) => boolean;
  }): Promise<{ rows: Record<string, any>[]; total: number }> {
    let results = [...this.rows];

    if (options.conditions) {
      results = results.filter((row) =>
        Object.entries(options.conditions!).every(([key, value]) => row[key] === value)
      );
    }

    if (options.statuses) {
      results = results.filter((row) => options.statuses!.includes(row.status));
    }

    if (options.extraFilter) {
      results = results.filter(options.extraFilter);
    }

    const total = results.length;

    if (options.orderBy) {
      results.sort((a, b) => {
        const aVal = a[options.orderBy!];
        const bVal = b[options.orderBy!];
        if (aVal < bVal) return options.order === 'desc' ? 1 : -1;
        if (aVal > bVal) return options.order === 'desc' ? -1 : 1;
        return 0;
      });
    }

    if (options.offset !== undefined) {
      results = results.slice(options.offset);
    }
    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return { rows: results, total };
  }
}

// ─── Knex-based DB (used when USE_SQLITE=false) ─────────────────────────

let knexDb: any = null;

if (!config.USE_SQLITE) {
  const knexLib = (await import('knex')).default;
  knexDb = knexLib({
    client: 'pg',
    connection: {
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
    },
    pool: { min: 2, max: 10 },
    migrations: { tableName: 'knex_migrations' },
  });
}

/**
 * Runs migrations. For SQLite mode this is a no-op (tables are implicit).
 * For PostgreSQL mode this creates the real tables.
 */
export async function runMigrations(): Promise<void> {
  if (config.USE_SQLITE) {
    console.log('[Database] Using in-memory JSON store (SQLite mode)');
    return;
  }

  console.log('[Database] Running PostgreSQL migrations...');
  const db = knexDb;

  if (!(await db.schema.hasTable('users'))) {
    await db.schema.createTable('users', (table: any) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.string('google_id').unique().notNullable();
      table.string('email').notNullable();
      table.string('name').notNullable();
      table.string('avatar').nullable();
      table.string('slack_access_token').nullable();
      table.string('slack_webhook_url').nullable();
      table.string('slack_channel_id').nullable();
      table.timestamps(true, true);
    });
    console.log('[Database] Created table: users');
  }

  if (!(await db.schema.hasTable('email_jobs'))) {
    await db.schema.createTable('email_jobs', (table: any) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('recipient_email').notNullable();
      table.string('sender_email').notNullable();
      table.string('subject').notNullable();
      table.text('body').notNullable();
      table.timestamp('scheduled_at').notNullable();
      table.timestamp('sent_at').nullable();
      table.enu('status', ['scheduled', 'queued', 'sending', 'sent', 'failed', 'rate_limited'], {
        useNative: true,
        enumName: 'email_job_status',
      }).notNullable().defaultTo('scheduled');
      table.string('bullmq_job_id').nullable();
      table.string('batch_id').nullable();
      table.text('error_message').nullable();
      table.string('idempotency_key').unique().notNullable();
      table.integer('attempts').notNullable().defaultTo(0);
      table.timestamps(true, true);
      table.index(['user_id', 'status']);
      table.index(['sender_email', 'status', 'scheduled_at']);
      table.index(['idempotency_key']);
    });
    console.log('[Database] Created table: email_jobs');
  }

  if (!(await db.schema.hasTable('senders'))) {
    await db.schema.createTable('senders', (table: any) => {
      table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('email').notNullable();
      table.string('name').notNullable();
      table.string('ethereal_user').notNullable();
      table.string('ethereal_pass').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    console.log('[Database] Created table: senders');
  }

  console.log('[Database] Migrations complete.');
}

// ─── Export ──────────────────────────────────────────────────────────────

/**
 * Returns either the Knex instance (PostgreSQL mode) or a table accessor (SQLite mode).
 */
const db = config.USE_SQLITE
  ? {
      table: (name: string) => new SimpleTable(name),
      destroy: async () => { persist(); },
      fn: { now: () => new Date().toISOString() },
    }
  : knexDb;

export default db;
