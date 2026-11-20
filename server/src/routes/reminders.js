import express from 'express';
import { db } from '../db.js';
import { authenticate } from '../auth.js';
import { processPendingReminders } from '../remindersScheduler.js';

const router = express.Router();
router.use(authenticate);

// GET /api/v1/reminders
router.get('/', async (req, res, next) => {
  try {
    const reminders = await db.prepare(`
      SELECT r.*, t.title as task_title
      FROM reminders r
      JOIN tasks t ON r.task_id = t.id
      WHERE r.user_id = ?
      ORDER BY r.remind_at ASC
    `).all(req.user.id);

    res.json(reminders.map(r => ({
      id: r.id,
      userId: r.user_id,
      taskId: r.task_id,
      taskTitle: r.task_title,
      remindAt: r.remind_at,
      channel: r.channel,
      status: r.status,
      sentAt: r.sent_at,
      createdAt: r.created_at
    })));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/reminders/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    }

    const { remindAt, channel, status } = req.body;
    await db.prepare(`
      UPDATE reminders
      SET remind_at = COALESCE(?, remind_at),
          channel = COALESCE(?, channel),
          status = COALESCE(?, status)
      WHERE id = ? AND user_id = ?
    `).run(remindAt || null, channel || null, status || null, req.params.id, req.user.id);

    const updated = await db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
    res.json({
      id: updated.id,
      userId: updated.user_id,
      taskId: updated.task_id,
      remindAt: updated.remind_at,
      channel: updated.channel,
      status: updated.status,
      sentAt: updated.sent_at,
      createdAt: updated.created_at
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/reminders/:id (Cancel reminder)
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reminders/trigger-check - on-demand poll trigger
router.post('/trigger-check', async (req, res, next) => {
  try {
    await processPendingReminders();
    res.json({ message: 'Reminder check triggered successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
