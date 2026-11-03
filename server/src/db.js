import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'productivity.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for SQLite performance & integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON tasks(user_id, status, due_at);
    CREATE INDEX IF NOT EXISTS idx_captures_user_created ON captures(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_reminders_status_remind ON reminders(status, remind_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at);
  `);

  // Run safe schema migrations for existing DB instances
  try {
    const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
    const existingCols = new Set(tableInfo.map((c) => c.name));
    const columnsToEnsure = [
      ['category', 'TEXT'],
      ['urgency', 'TEXT'],
      ['importance', 'TEXT'],
      ['eisenhower_quadrant', 'TEXT'],
      ['is_deadline', 'INTEGER DEFAULT 0'],
      ['detected_dates', 'TEXT'],
      ['ai_analysis', 'TEXT']
    ];

    for (const [colName, colType] of columnsToEnsure) {
      if (!existingCols.has(colName)) {
        db.exec(`ALTER TABLE tasks ADD COLUMN ${colName} ${colType};`);
      }
    }

    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user_quadrant ON tasks(user_id, eisenhower_quadrant);`);
  } catch (err) {
    console.error('Error migrating tasks table columns:', err);
  }
}

// Initialise DB schema
initDb();
