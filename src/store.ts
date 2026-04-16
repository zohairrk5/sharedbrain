import Database from 'better-sqlite3';
import { brainDbPath } from './paths.js';

export interface Memory {
  id: number;
  content: string;
  source: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SearchHit extends Memory {
  rank: number;
  snippet: string;
}

let cached: Database.Database | null = null;

export function getDb(): Database.Database {
  if (cached) return cached;
  const db = new Database(brainDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  cached = db;
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      source TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      tags,
      source UNINDEXED,
      content=memories,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, tags, source)
      VALUES (new.id, new.content, new.tags, new.source);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags, source)
      VALUES ('delete', old.id, old.content, old.tags, old.source);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, tags, source)
      VALUES ('delete', old.id, old.content, old.tags, old.source);
      INSERT INTO memories_fts(rowid, content, tags, source)
      VALUES (new.id, new.content, new.tags, new.source);
    END;
  `);
}

function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: row.id as number,
    content: row.content as string,
    source: (row.source as string | null) ?? null,
    tags: JSON.parse((row.tags as string) ?? '[]'),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function remember(opts: { content: string; source?: string; tags?: string[] }): Memory {
  const db = getDb();
  const tags = JSON.stringify(opts.tags ?? []);
  const stmt = db.prepare(
    'INSERT INTO memories (content, source, tags) VALUES (?, ?, ?) RETURNING *'
  );
  const row = stmt.get(opts.content, opts.source ?? null, tags) as Record<string, unknown>;
  return rowToMemory(row);
}

export function recall(opts: { id?: number; limit?: number; source?: string }): Memory[] {
  const db = getDb();
  if (opts.id !== undefined) {
    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(opts.id) as
      | Record<string, unknown>
      | undefined;
    return row ? [rowToMemory(row)] : [];
  }
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  if (opts.source) {
    const rows = db
      .prepare('SELECT * FROM memories WHERE source = ? ORDER BY created_at DESC LIMIT ?')
      .all(opts.source, limit) as Record<string, unknown>[];
    return rows.map(rowToMemory);
  }
  const rows = db
    .prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(rowToMemory);
}

function escapeFtsQuery(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map((t) => t.replace(/['"]/g, '').trim())
    .filter(Boolean)
    .map((t) => `"${t}"`);
  return tokens.join(' OR ');
}

export function search(opts: { query: string; limit?: number; source?: string }): SearchHit[] {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);
  const ftsQuery = escapeFtsQuery(opts.query);
  if (!ftsQuery) return [];
  const baseSql = `
    SELECT m.*, bm25(memories_fts) AS rank,
           snippet(memories_fts, 0, '[', ']', '…', 20) AS snippet
    FROM memories_fts
    JOIN memories m ON m.id = memories_fts.rowid
    WHERE memories_fts MATCH ?
    ${opts.source ? 'AND m.source = ?' : ''}
    ORDER BY rank
    LIMIT ?
  `;
  const stmt = db.prepare(baseSql);
  const params: unknown[] = opts.source ? [ftsQuery, opts.source, limit] : [ftsQuery, limit];
  const rows = stmt.all(...params) as Record<string, unknown>[];
  return rows.map((row) => ({
    ...rowToMemory(row),
    rank: row.rank as number,
    snippet: row.snippet as string,
  }));
}

export function forget(id: number): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  return result.changes > 0;
}

export function stats(): { total: number; sources: Record<string, number> } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) AS c FROM memories').get() as { c: number }).c;
  const rows = db
    .prepare('SELECT COALESCE(source, \'(none)\') AS source, COUNT(*) AS c FROM memories GROUP BY source')
    .all() as { source: string; c: number }[];
  const sources: Record<string, number> = {};
  for (const r of rows) sources[r.source] = r.c;
  return { total, sources };
}
