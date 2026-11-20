import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sqlitePath = path.resolve(__dirname, '../../data/productivity.db');
const pgUrl = process.env.DATABASE_URL || 'postgres://todo_user:todo_secure_password_2026@127.0.0.1:5432/todo_db';

async function migrate() {
  console.log('=== SQLite to PostgreSQL Migration Tool ===');
  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite database not found at ${sqlitePath}`);
    process.exit(1);
  }

  console.log(`Reading SQLite: ${sqlitePath}`);
  console.log(`Target PostgreSQL: ${pgUrl.replace(/:[^:@]+@/, ':****@')}`);

  const sqlite = new DatabaseSync(sqlitePath);
  const pool = new pg.Pool({ connectionString: pgUrl });

  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');

    // 1. Ensure PG tables exist
    console.log('Ensuring PostgreSQL tables exist...');
    await client.query(`
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
    `);

    // Helper to migrate a table
    async function migrateTable(tableName, columns) {
      try {
        const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
        if (!rows || rows.length === 0) {
          console.log(`[${tableName}] 0 rows found in SQLite.`);
          return;
        }

        let migratedCount = 0;
        for (const row of rows) {
          const colNames = Object.keys(row);
          const values = Object.values(row);
          const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
          const updateSets = colNames
            .filter((c) => c !== 'id' && c !== 'user_id')
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ');

          const conflictTarget = tableName === 'user_preferences' ? '("user_id")' : '("id")';
          const conflictClause = updateSets.length > 0 ? `DO UPDATE SET ${updateSets}` : 'DO NOTHING';

          const sql = `
            INSERT INTO "${tableName}" (${colNames.map((c) => `"${c}"`).join(', ')})
            VALUES (${placeholders})
            ON CONFLICT ${conflictTarget} ${conflictClause}
          `;

          await client.query(sql, values);
          migratedCount++;
        }
        console.log(`[${tableName}] Migrated ${migratedCount} rows successfully.`);
      } catch (e) {
        console.error(`[${tableName}] Migration error:`, e.message);
      }
    }

    await client.query('BEGIN');
    await migrateTable('users');
    await migrateTable('user_preferences');
    await migrateTable('captures');
    await migrateTable('tasks');
    await migrateTable('notes');
    await migrateTable('reminders');
    await migrateTable('notifications');
    await migrateTable('plans');
    await migrateTable('plan_items');
    await client.query('COMMIT');

    client.release();
    console.log('✅ Migration to PostgreSQL completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
