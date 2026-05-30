// Session JWT locale — table local_session (id = 1, singleton)
import { db } from './schema';
import type { LocalSession } from '../types';

export async function saveSession(session: LocalSession): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO local_session
       (id, user_id, user_role, jwt_token, refresh_token, full_name, phone, expires_at, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      session.user_id,
      session.user_role,
      session.jwt_token,
      session.refresh_token ?? null,
      session.full_name ?? null,
      session.phone ?? null,
      session.expires_at,
    ]
  );
}

export async function getSession(): Promise<LocalSession | null> {
  return db.getFirstAsync<LocalSession>(
    `SELECT * FROM local_session WHERE id = 1`
  );
}

export async function clearSession(): Promise<void> {
  await db.runAsync(`DELETE FROM local_session WHERE id = 1`);
}

export function isSessionExpired(session: LocalSession): boolean {
  return new Date(session.expires_at) <= new Date();
}
