import { randomBytes, createHash } from 'node:crypto';
import { getDb } from './store.js';

export interface TokenRecord {
  id: number;
  label: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
}

export interface IssuedToken {
  id: number;
  label: string;
  token: string;
  created_at: string;
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function initTokensSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT
    );
  `);
}

export function createToken(label: string): IssuedToken {
  initTokensSchema();
  const db = getDb();
  const raw = randomBytes(32).toString('base64url');
  const token = `sb_${raw}`;
  const h = hash(token);
  const row = db
    .prepare('INSERT INTO tokens (label, token_hash) VALUES (?, ?) RETURNING id, created_at')
    .get(label, h) as { id: number; created_at: string };
  return { id: row.id, label, token, created_at: row.created_at };
}

export function listTokens(): Omit<TokenRecord, 'token_hash'>[] {
  initTokensSchema();
  const db = getDb();
  return db
    .prepare('SELECT id, label, created_at, last_used_at FROM tokens ORDER BY created_at DESC')
    .all() as Omit<TokenRecord, 'token_hash'>[];
}

export function revokeToken(id: number): boolean {
  initTokensSchema();
  const db = getDb();
  const res = db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
  return res.changes > 0;
}

export function verifyToken(token: string): boolean {
  initTokensSchema();
  const db = getDb();
  const h = hash(token);
  const row = db.prepare('SELECT id FROM tokens WHERE token_hash = ?').get(h) as
    | { id: number }
    | undefined;
  if (!row) return false;
  db.prepare('UPDATE tokens SET last_used_at = datetime(\'now\') WHERE id = ?').run(row.id);
  return true;
}
