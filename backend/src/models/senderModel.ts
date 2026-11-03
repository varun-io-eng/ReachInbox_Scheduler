import db from '../config/database.js';
import config from '../config/index.js';
import type { Sender } from '../types/index.js';

const TABLE = 'senders';

/**
 * Create a new sender record.
 */
export async function create(data: {
  id: string;
  user_id: string;
  email: string;
  name: string;
  ethereal_user: string;
  ethereal_pass: string;
}): Promise<Sender> {
  if (config.USE_SQLITE) {
    await db.table(TABLE).insert(data);
    return db.table(TABLE).first({ id: data.id }) as Promise<Sender>;
  }
  const [sender] = await db<Sender>(TABLE).insert(data).returning('*');
  return sender;
}

/**
 * Find all senders for a user.
 */
export async function findByUserId(userId: string): Promise<Sender[]> {
  if (config.USE_SQLITE) {
    const result = await db.table(TABLE).query({
      conditions: { user_id: userId },
      orderBy: 'created_at',
      order: 'desc',
    });
    return result.rows as Sender[];
  }
  return db<Sender>(TABLE).where({ user_id: userId }).orderBy('created_at', 'desc');
}

/**
 * Find a sender by email address (scoped to a user).
 */
export async function findByEmail(userId: string, email: string): Promise<Sender | undefined> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).first({ user_id: userId, email }) as Promise<Sender | undefined>;
  }
  return db<Sender>(TABLE).where({ user_id: userId, email }).first();
}

/**
 * Find a sender by its primary key.
 */
export async function findById(id: string): Promise<Sender | undefined> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).first({ id }) as Promise<Sender | undefined>;
  }
  return db<Sender>(TABLE).where({ id }).first();
}

/**
 * Delete a sender by ID (scoped to a user for safety).
 */
export async function remove(id: string, userId: string): Promise<number> {
  if (config.USE_SQLITE) {
    return db.table(TABLE).delete({ id, user_id: userId });
  }
  return db<Sender>(TABLE).where({ id, user_id: userId }).del();
}

export default {
  create,
  findByUserId,
  findByEmail,
  findById,
  remove,
};
