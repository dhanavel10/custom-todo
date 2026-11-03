import express from 'express';
import { db } from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/v1/notifications
router.get('/', (req, res, next) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(req.user.id);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND read_at IS NULL
    `).get(req.user.id)?.count || 0;

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        userId: n.user_id,
        taskId: n.task_id,
        title: n.title,
        body: n.body,
        readAt: n.read_at,
        createdAt: n.created_at
      })),
      unreadCount
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/:id/read
router.post('/:id/read', (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE notifications
      SET read_at = ?
      WHERE id = ? AND user_id = ?
    `).run(now, req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    }

    const updated = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
    res.json({
      id: updated.id,
      userId: updated.user_id,
      taskId: updated.task_id,
      title: updated.title,
      body: updated.body,
      readAt: updated.read_at,
      createdAt: updated.created_at
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/read-all
router.post('/read-all', (req, res, next) => {
  try {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE notifications
      SET read_at = ?
      WHERE user_id = ? AND read_at IS NULL
    `).run(now, req.user.id);

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

export default router;
