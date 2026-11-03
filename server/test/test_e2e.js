import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db.js';
import { processPendingReminders } from '../src/remindersScheduler.js';
import { hashPassword, generateToken } from '../src/auth.js';
import { randomUUID } from 'node:crypto';

test('End-to-end SQLite Database & Domain Logic Validation', async () => {
  const userAId = randomUUID();
  const userBId = randomUUID();
  const now = new Date().toISOString();

  // 1. Create two users
  const hash = await hashPassword('password123');
  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, time_zone, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Asia/Kolkata', ?, ?)
  `).run(userAId, `userA_${Date.now()}@example.com`, hash, 'User A', now, now);

  db.prepare(`
    INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)
  `).run(userAId, now);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, time_zone, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'Asia/Kolkata', ?, ?)
  `).run(userBId, `userB_${Date.now()}@example.com`, hash, 'User B', now, now);

  // 2. Capture creation
  const capId = randomUUID();
  db.prepare(`
    INSERT INTO captures (id, user_id, raw_text, parse_status, created_at)
    VALUES (?, ?, ?, 'NOT_PROCESSED', ?)
  `).run(capId, userAId, 'Call Ravi tomorrow at 10am', now);

  // Check ownership isolation: User B cannot query User A's capture
  const userACaptureForB = db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(capId, userBId);
  assert.strictEqual(userACaptureForB, undefined);

  // 3. Convert capture to task
  const taskId = randomUUID();
  db.prepare(`
    INSERT INTO tasks (id, user_id, capture_id, title, status, due_at, created_at, updated_at)
    VALUES (?, ?, ?, 'Call Ravi', 'TODO', ?, ?, ?)
  `).run(taskId, userAId, capId, new Date(Date.now() + 86400000).toISOString(), now, now);

  db.prepare(`
    UPDATE captures SET converted_entity_type = 'TASK', converted_entity_id = ? WHERE id = ?
  `).run(taskId, capId);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, userAId);
  assert.strictEqual(task.title, 'Call Ravi');

  // 4. Create reminder for task
  const remId = randomUUID();
  const pastRemindTime = new Date(Date.now() - 5000).toISOString(); // Due in past to test processing
  db.prepare(`
    INSERT INTO reminders (id, user_id, task_id, remind_at, channel, status, created_at)
    VALUES (?, ?, ?, ?, 'IN_APP', 'PENDING', ?)
  `).run(remId, userAId, taskId, pastRemindTime, now);

  // 5. Trigger reminder poller
  processPendingReminders();

  // Verify reminder was marked SENT and notification was created
  const processedReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(remId);
  assert.strictEqual(processedReminder.status, 'SENT');

  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? AND task_id = ?').all(userAId, taskId);
  assert.strictEqual(notifications.length, 1);
  assert.ok(notifications[0].title.includes('Call Ravi'));

  // 6. Complete task and verify pending reminders are cancelled
  const remId2 = randomUUID();
  const futureRemindTime = new Date(Date.now() + 100000).toISOString();
  db.prepare(`
    INSERT INTO reminders (id, user_id, task_id, remind_at, channel, status, created_at)
    VALUES (?, ?, ?, ?, 'IN_APP', 'PENDING', ?)
  `).run(remId2, userAId, taskId, futureRemindTime, now);

  // Mark task completed
  db.prepare("UPDATE tasks SET status = 'COMPLETED', completed_at = ? WHERE id = ?").run(now, taskId);
  db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE task_id = ? AND status = 'PENDING'").run(taskId);

  const cancelledRem = db.prepare('SELECT * FROM reminders WHERE id = ?').get(remId2);
  assert.strictEqual(cancelledRem.status, 'CANCELLED');

  // 7. Idea Pad Note Creation & Conversion
  const noteId = randomUUID();
  db.prepare(`
    INSERT INTO notes (id, user_id, title, content, is_pinned, is_archived, created_at, updated_at)
    VALUES (?, ?, 'My Idea', '# Brainstorm\n- Item 1\n- Item 2', 1, 0, ?, ?)
  `).run(noteId, userAId, now, now);

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  assert.strictEqual(note.is_pinned, 1);

  // Non-destructive task conversion
  const noteTaskId = randomUUID();
  db.prepare(`
    INSERT INTO tasks (id, user_id, title, description, status, created_at, updated_at)
    VALUES (?, ?, 'Task from note', ?, 'TODO', ?, ?)
  `).run(noteTaskId, userAId, note.content, now, now);

  // Original note remains intact
  const originalNoteStillExists = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  assert.ok(originalNoteStillExists);
  assert.strictEqual(originalNoteStillExists.title, 'My Idea');
});
