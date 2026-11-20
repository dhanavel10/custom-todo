import { randomUUID } from 'node:crypto';
import { db } from './db.js';

export const PLAN_GRACE_MINUTES = 60;

/**
 * Polls pending reminders and generates in-app notifications
 */
export async function processPendingReminders() {
  try {
    const now = new Date().toISOString();

    // 1. Find pending reminders where remind_at <= now
    const pendingReminders = await db.prepare(`
      SELECT r.*, t.title as task_title, t.status as task_status
      FROM reminders r
      JOIN tasks t ON r.task_id = t.id
      WHERE r.status = 'PENDING'
        AND r.remind_at <= ?
    `).all(now);

    for (const reminder of pendingReminders) {
      // 2. Check that task is not completed or archived
      if (reminder.task_status === 'COMPLETED' || reminder.task_status === 'ARCHIVED') {
        await db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE id = ?").run(reminder.id);
        continue;
      }

      // 3. Create in-app notification
      const notifId = randomUUID();
      const notifTitle = `Task Reminder: ${reminder.task_title}`;
      const notifBody = `Reminder for your task "${reminder.task_title}" scheduled for ${new Date(reminder.remind_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;

      await db.prepare(`
        INSERT INTO notifications (id, user_id, task_id, title, body, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(notifId, reminder.user_id, reminder.task_id, notifTitle, notifBody, now);

      // 4. Mark reminder as SENT
      await db.prepare(`
        UPDATE reminders
        SET status = 'SENT', sent_at = ?
        WHERE id = ?
      `).run(now, reminder.id);
    }

    // 4b. Study plan items
    await processPlanItems();

    // 5. Daily reviews
    await processDailyReviews();
  } catch (err) {
    console.error('Error in reminder scheduler:', err);
  }
}

export async function processPlanItems() {
  try {
    const nowDate = new Date();
    const now = nowDate.toISOString();

    // Time to do it
    const due = await db.prepare(`
      SELECT i.*, p.title AS plan_title FROM plan_items i
      JOIN plans p ON p.id = i.plan_id
      WHERE i.status = 'PENDING' AND i.reminded_at IS NULL AND i.scheduled_at <= ?
    `).all(now);

    for (const item of due) {
      await db.prepare(`
        INSERT INTO notifications (id, user_id, title, body, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        randomUUID(), item.user_id,
        `Study time: ${item.title}`,
        `${item.plan_title} · Day ${item.day_number}. It's time for "${item.title}". Open Study Plans to mark it complete when you're done.`,
        now
      );
      await db.prepare('UPDATE plan_items SET reminded_at = ? WHERE id = ?').run(now, item.id);
    }

    // Not completed in time -> MISSED
    const cutoff = new Date(nowDate.getTime() - PLAN_GRACE_MINUTES * 60000).toISOString();
    const late = await db.prepare(`
      SELECT i.*, p.title AS plan_title FROM plan_items i
      JOIN plans p ON p.id = i.plan_id
      WHERE i.status = 'PENDING' AND i.scheduled_at <= ?
    `).all(cutoff);

    for (const item of late) {
      await db.prepare("UPDATE plan_items SET status = 'MISSED', missed_at = ?, updated_at = ? WHERE id = ?")
        .run(now, now, item.id);
      await db.prepare(`
        INSERT INTO notifications (id, user_id, title, body, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        randomUUID(), item.user_id,
        `Not completed: ${item.title}`,
        `You didn't mark "${item.title}" (${item.plan_title}, Day ${item.day_number}) as done. Pick a new time for it in Study Plans.`,
        now
      );
    }
  } catch (err) {
    console.error('Error processing plan items:', err);
  }
}

export async function processDailyReviews() {
  try {
    const now = new Date();
    const currentDateStr = now.toISOString().slice(0, 10);
    const currentHourMinute = now.toTimeString().slice(0, 5);

    const usersWithPrefs = await db.prepare(`
      SELECT u.id as user_id, p.*
      FROM users u
      JOIN user_preferences p ON u.id = p.user_id
    `).all();

    for (const pref of usersWithPrefs) {
      // Morning Review
      if (
        pref.daily_review_morning_enabled &&
        pref.last_morning_review_date !== currentDateStr &&
        currentHourMinute >= pref.daily_review_morning_time
      ) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

        const todayTasksCountRow = await db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE user_id = ? AND status NOT IN ('COMPLETED', 'ARCHIVED')
            AND due_at >= ? AND due_at <= ?
        `).get(pref.user_id, startOfDay, endOfDay);
        const todayTasksCount = Number(todayTasksCountRow?.count || 0);

        const overdueCountRow = await db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE user_id = ? AND status NOT IN ('COMPLETED', 'ARCHIVED')
            AND due_at IS NOT NULL AND due_at < ?
        `).get(pref.user_id, startOfDay);
        const overdueCount = Number(overdueCountRow?.count || 0);

        if (todayTasksCount > 0 || overdueCount > 0) {
          const notifId = randomUUID();
          const title = 'Morning Productivity Briefing';
          const body = `You have ${todayTasksCount} task(s) scheduled for today${overdueCount > 0 ? ` and ${overdueCount} overdue item(s)` : ''}. Capture first, organize later!`;
          const notifNow = new Date().toISOString();

          await db.prepare(`
            INSERT INTO notifications (id, user_id, title, body, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(notifId, pref.user_id, title, body, notifNow);
        }

        await db.prepare('UPDATE user_preferences SET last_morning_review_date = ? WHERE user_id = ?')
          .run(currentDateStr, pref.user_id);
      }

      // Evening Review
      if (
        pref.daily_review_evening_enabled &&
        pref.last_evening_review_date !== currentDateStr &&
        currentHourMinute >= pref.daily_review_evening_time
      ) {
        const incompleteCountRow = await db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE user_id = ? AND status NOT IN ('COMPLETED', 'ARCHIVED')
        `).get(pref.user_id);
        const incompleteCount = Number(incompleteCountRow?.count || 0);

        if (incompleteCount > 0) {
          const notifId = randomUUID();
          const title = 'Evening Review & Wrap-Up';
          const body = `You have ${incompleteCount} open task(s). Take a quick moment to clear your mind or defer tasks to tomorrow.`;
          const notifNow = new Date().toISOString();

          await db.prepare(`
            INSERT INTO notifications (id, user_id, title, body, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(notifId, pref.user_id, title, body, notifNow);
        }

        await db.prepare('UPDATE user_preferences SET last_evening_review_date = ? WHERE user_id = ?')
          .run(currentDateStr, pref.user_id);
      }
    }
  } catch (err) {
    console.error('Error processing daily reviews:', err);
  }
}

let pollerInterval = null;

export function startReminderScheduler(intervalMs = 15000) {
  if (pollerInterval) return;
  processPendingReminders();
  pollerInterval = setInterval(() => {
    processPendingReminders();
  }, intervalMs);
}

export function stopReminderScheduler() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}
