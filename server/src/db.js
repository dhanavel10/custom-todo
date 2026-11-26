import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDataDir = fs.existsSync(path.resolve(__dirname, '../../data'))
  ? path.resolve(__dirname, '../../data')
  : path.resolve(__dirname, '../data');
const dataDir = process.env.DATA_DIR || defaultDataDir;
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.warn(`[DB] Could not create data directory at ${dataDir}: ${err.message}`);
  }
}

const dbPath = path.join(dataDir, 'productivity.db');
let sqliteDb = null;
let pgPool = null;
let isPg = false;

export function toPgSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

function ensureSqlite() {
  if (!sqliteDb) {
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
    initSqliteSchema();
  }
  return sqliteDb;
}

export function initSqliteSchema() {
  const dbInst = sqliteDb;
  if (!dbInst) return;

  dbInst.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      google_id TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      avatar_url TEXT,
      time_zone TEXT DEFAULT 'Asia/Kolkata',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      daily_review_morning_enabled INTEGER DEFAULT 1,
      daily_review_morning_time TEXT DEFAULT '09:00',
      daily_review_evening_enabled INTEGER DEFAULT 1,
      daily_review_evening_time TEXT DEFAULT '18:00',
      lead_time_minutes INTEGER DEFAULT 15,
      in_app_notifications INTEGER DEFAULT 1,
      last_morning_review_date TEXT,
      last_evening_review_date TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      raw_text TEXT NOT NULL,
      input_mode TEXT DEFAULT 'TEXT',
      detected_type TEXT DEFAULT 'UNKNOWN',
      parsed_title TEXT,
      parsed_due_at TEXT,
      parse_status TEXT DEFAULT 'NOT_PROCESSED',
      converted_entity_type TEXT,
      converted_entity_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      capture_id TEXT REFERENCES captures(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'INBOX',
      priority TEXT,
      category TEXT,
      urgency TEXT,
      importance TEXT,
      eisenhower_quadrant TEXT,
      is_deadline INTEGER DEFAULT 0,
      detected_dates TEXT,
      ai_analysis TEXT,
      due_at TEXT,
      due_time_zone TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      capture_id TEXT REFERENCES captures(id) ON DELETE SET NULL,
      title TEXT,
      content TEXT DEFAULT '',
      topic TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      remind_at TEXT NOT NULL,
      channel TEXT DEFAULT 'IN_APP',
      status TEXT DEFAULT 'PENDING',
      sent_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      day_number INTEGER NOT NULL DEFAULT 1,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reminded_at TEXT,
      missed_at TEXT,
      completed_at TEXT,
      reschedule_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_plan_items_user_status ON plan_items(user_id, status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON tasks(user_id, status, due_at);
    CREATE INDEX IF NOT EXISTS idx_captures_user_created ON captures(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_reminders_status_remind ON reminders(status, remind_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_quadrant ON tasks(user_id, eisenhower_quadrant);
  `);

  try {
    const userCols = new Set(dbInst.prepare("PRAGMA table_info(users)").all().map((c) => c.name));
    if (!userCols.has('username')) dbInst.exec('ALTER TABLE users ADD COLUMN username TEXT UNIQUE;');
    if (!userCols.has('google_id')) dbInst.exec('ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;');
    if (!userCols.has('avatar_url')) dbInst.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT;');

    const noteCols = new Set(dbInst.prepare("PRAGMA table_info(notes)").all().map((c) => c.name));
    if (!noteCols.has('topic')) dbInst.exec('ALTER TABLE notes ADD COLUMN topic TEXT;');
  } catch (err) {
    // Column already exists or error
  }
}

export async function initPgSchema() {
  if (!pgPool) return;

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      google_id TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT,
      avatar_url TEXT,
      time_zone TEXT DEFAULT 'Asia/Kolkata',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      daily_review_morning_enabled INTEGER DEFAULT 1,
      daily_review_morning_time TEXT DEFAULT '09:00',
      daily_review_evening_enabled INTEGER DEFAULT 1,
      daily_review_evening_time TEXT DEFAULT '18:00',
      lead_time_minutes INTEGER DEFAULT 15,
      in_app_notifications INTEGER DEFAULT 1,
      last_morning_review_date TEXT,
      last_evening_review_date TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS captures (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      raw_text TEXT NOT NULL,
      input_mode TEXT DEFAULT 'TEXT',
      detected_type TEXT DEFAULT 'UNKNOWN',
      parsed_title TEXT,
      parsed_due_at TEXT,
      parse_status TEXT DEFAULT 'NOT_PROCESSED',
      converted_entity_type TEXT,
      converted_entity_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      capture_id TEXT REFERENCES captures(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'INBOX',
      priority TEXT,
      category TEXT,
      urgency TEXT,
      importance TEXT,
      eisenhower_quadrant TEXT,
      is_deadline INTEGER DEFAULT 0,
      detected_dates TEXT,
      ai_analysis TEXT,
      due_at TEXT,
      due_time_zone TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      capture_id TEXT REFERENCES captures(id) ON DELETE SET NULL,
      title TEXT,
      content TEXT DEFAULT '',
      topic TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      remind_at TEXT NOT NULL,
      channel TEXT DEFAULT 'IN_APP',
      status TEXT DEFAULT 'PENDING',
      sent_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      day_number INTEGER NOT NULL DEFAULT 1,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reminded_at TEXT,
      missed_at TEXT,
      completed_at TEXT,
      reschedule_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_plan_items_user_status ON plan_items(user_id, status, scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON tasks(user_id, status, due_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_quadrant ON tasks(user_id, eisenhower_quadrant);
    CREATE INDEX IF NOT EXISTS idx_captures_user_created ON captures(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_reminders_status_remind ON reminders(status, remind_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);

    ALTER TABLE notes ADD COLUMN IF NOT EXISTS topic TEXT;
  `);
}

export async function initDb() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://todo_user:todo_secure_password_2026@127.0.0.1:5432/todo_db';
  try {
    const testPool = new pg.Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 2500
    });
    const client = await testPool.connect();
    client.release();
    pgPool = testPool;
    isPg = true;
    console.log('[DB] Connected to PostgreSQL at', dbUrl.replace(/:[^:@]+@/, ':****@'));
    await initPgSchema();
    return;
  } catch (err) {
    console.warn(`[DB] PostgreSQL not reachable (${err.message}). Using SQLite fallback.`);
    isPg = false;
  }

  ensureSqlite();
}

// Initialise SQLite fallback immediately so imports never fail
ensureSqlite();

function flattenParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export const db = {
  get isPostgres() {
    return isPg;
  },
  async get(sql, ...params) {
    const args = flattenParams(params);
    if (isPg && pgPool) {
      const res = await pgPool.query(toPgSql(sql), args);
      return res.rows[0];
    }
    const dbInst = ensureSqlite();
    return dbInst.prepare(sql).get(...args);
  },
  async all(sql, ...params) {
    const args = flattenParams(params);
    if (isPg && pgPool) {
      const res = await pgPool.query(toPgSql(sql), args);
      return res.rows;
    }
    const dbInst = ensureSqlite();
    return dbInst.prepare(sql).all(...args);
  },
  async run(sql, ...params) {
    const args = flattenParams(params);
    if (isPg && pgPool) {
      const res = await pgPool.query(toPgSql(sql), args);
      return { changes: res.rowCount };
    }
    const dbInst = ensureSqlite();
    const res = dbInst.prepare(sql).run(...args);
    return { changes: res.changes };
  },
  async exec(sql) {
    if (isPg && pgPool) {
      await pgPool.query(sql);
      return;
    }
    const dbInst = ensureSqlite();
    dbInst.exec(sql);
  },
  prepare(sql) {
    return {
      get: (...params) => db.get(sql, ...params),
      all: (...params) => db.all(sql, ...params),
      run: (...params) => db.run(sql, ...params)
    };
  }
};
