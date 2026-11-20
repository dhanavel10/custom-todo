import express from 'express';
import { db } from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/v1/me
router.get('/me', async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT id, email, username, display_name as displayName, avatar_url as avatarUrl, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const preferences = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    res.json({ user, preferences });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/me
router.patch('/me', async (req, res, next) => {
  try {
    const { displayName, timeZone } = req.body;
    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE users
      SET display_name = COALESCE(?, display_name),
          time_zone = COALESCE(?, time_zone),
          updated_at = ?
      WHERE id = ?
    `).run(displayName !== undefined ? displayName : null, timeZone !== undefined ? timeZone : null, now, req.user.id);

    const updated = await db.prepare('SELECT id, email, username, display_name as displayName, avatar_url as avatarUrl, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/me/preferences
router.get('/me/preferences', async (req, res, next) => {
  try {
    let prefs = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    if (!prefs) {
      const now = new Date().toISOString();
      await db.prepare('INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)').run(req.user.id, now);
      prefs = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    }
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/me/preferences
router.patch('/me/preferences', async (req, res, next) => {
  try {
    const {
      dailyReviewMorningEnabled,
      dailyReviewMorningTime,
      dailyReviewEveningEnabled,
      dailyReviewEveningTime,
      leadTimeMinutes,
      inAppNotifications
    } = req.body;

    const now = new Date().toISOString();

    await db.prepare(`
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

    const updated = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/me/export (Backup & Export account data)
router.get('/me/export', async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT id, email, username, display_name as displayName, avatar_url as avatarUrl, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
    const preferences = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    const captures = await db.prepare('SELECT * FROM captures WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    const tasks = await db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    const notes = await db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    const reminders = await db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    const notifications = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);

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
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/me (Account Deletion)
router.delete('/me', async (req, res, next) => {
  try {
    await db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    res.clearCookie('token');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
