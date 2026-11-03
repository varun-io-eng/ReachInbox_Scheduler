import db from '../config/database.js';
import config from '../config/index.js';
import type { User } from '../types/index.js';

const TABLE = 'users';

function getTable() {
  return config.USE_SQLITE ? db.table(TABLE) : db(TABLE);
}

/**
 * Find a user by their primary key.
 */
export async function findById(id: string): Promise<User | undefined> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).first({ id }) as Promise<User | undefined>;
  }
  return db<User>(TABLE).where({ id }).first();
}

/**
 * Find a user by their Google OAuth ID.
 */
export async function findByGoogleId(googleId: string): Promise<User | undefined> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).first({ google_id: googleId }) as Promise<User | undefined>;
  }
  return db<User>(TABLE).where({ google_id: googleId }).first();
}

/**
 * Create a new user record and return it.
 */
export async function create(data: {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar?: string | null;
}): Promise<User> {
  if (config.USE_SQLITE) {
    await db.table(TABLE).insert(data);
    return db.table(TABLE).first({ id: data.id }) as Promise<User>;
  }
  const [user] = await db<User>(TABLE).insert(data).returning('*');
  return user;
}

/**
 * Update an existing user and return the updated record.
 */
export async function update(
  id: string,
  data: Partial<Pick<User, 'email' | 'name' | 'avatar'>>
): Promise<User | undefined> {
  if (config.USE_SQLITE) {
    await db.table(TABLE).update({ id }, data);
    return db.table(TABLE).first({ id }) as Promise<User | undefined>;
  }
  const [user] = await db<User>(TABLE)
    .where({ id })
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return user;
}

/**
 * Store Slack integration tokens for a user.
 */
export async function updateSlackTokens(
  id: string,
  tokens: {
    slack_access_token: string | null;
    slack_webhook_url: string | null;
    slack_channel_id: string | null;
  }
): Promise<User | undefined> {
  if (config.USE_SQLITE) {
    await db.table(TABLE).update({ id }, tokens);
    return db.table(TABLE).first({ id }) as Promise<User | undefined>;
  }
  const [user] = await db<User>(TABLE)
    .where({ id })
    .update({ ...tokens, updated_at: db.fn.now() })
    .returning('*');
  return user;
}

export default {
  findById,
  findByGoogleId,
  create,
  update,
  updateSlackTokens,
};
