import express from 'express';
import { db } from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/v1/me
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT id, email, display_name as displayName, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
  }
  const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  res.json({ user, preferences });
});

// PATCH /api/v1/me
router.patch('/me', (req, res) => {
  const { displayName, timeZone } = req.body;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET display_name = COALESCE(?, display_name),
        time_zone = COALESCE(?, time_zone),
        updated_at = ?
    WHERE id = ?
  `).run(displayName !== undefined ? displayName : null, timeZone !== undefined ? timeZone : null, now, req.user.id);

  const updated = db.prepare('SELECT id, email, display_name as displayName, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: updated });
});

// GET /api/v1/me/preferences
router.get('/me/preferences', (req, res) => {
  let prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  if (!prefs) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)').run(req.user.id, now);
    prefs = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  }
  res.json(prefs);
});

// PATCH /api/v1/me/preferences
router.patch('/me/preferences', (req, res) => {
  const {
    dailyReviewMorningEnabled,
    dailyReviewMorningTime,
    dailyReviewEveningEnabled,
    dailyReviewEveningTime,
    leadTimeMinutes,
    inAppNotifications
  } = req.body;

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE user_preferences
    SET daily_review_morning_enabled = COALESCE(?, daily_review_morning_enabled),
        daily_review_morning_time = COALESCE(?, daily_review_morning_time),
        daily_review_evening_enabled = COALESCE(?, daily_review_evening_enabled),
        daily_review_evening_time = COALESCE(?, daily_review_evening_time),
        lead_time_minutes = COALESCE(?, lead_time_minutes),
        in_app_notifications = COALESCE(?, in_app_notifications),
        updated_at = ?
    WHERE user_id = ?
  `).run(
    dailyReviewMorningEnabled !== undefined ? (dailyReviewMorningEnabled ? 1 : 0) : null,
    dailyReviewMorningTime !== undefined ? dailyReviewMorningTime : null,
    dailyReviewEveningEnabled !== undefined ? (dailyReviewEveningEnabled ? 1 : 0) : null,
    dailyReviewEveningTime !== undefined ? dailyReviewEveningTime : null,
    leadTimeMinutes !== undefined ? leadTimeMinutes : null,
    inAppNotifications !== undefined ? (inAppNotifications ? 1 : 0) : null,
    now,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  res.json(updated);
});

// GET /api/v1/me/export (Backup & Export account data)
router.get('/me/export', (req, res) => {
  const user = db.prepare('SELECT id, email, display_name as displayName, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
  const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  const captures = db.prepare('SELECT * FROM captures WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const notes = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="productivity-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: '1.0',
    user,
    preferences,
    captures,
    tasks,
    notes,
    reminders,
    notifications
  });
});

// DELETE /api/v1/me (Account Deletion)
router.delete('/me', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.clearCookie('token');
  res.status(204).send();
});

export default router;
