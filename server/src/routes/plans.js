import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();
router.use(authenticate);

function badRequest(res, message) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
}

function notFound(res, entity = 'Resource') {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: `${entity} not found` } });
}

function isValidIso(str) {
  if (!str || typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function formatItem(it) {
  return {
    id: it.id,
    planId: it.plan_id,
    userId: it.user_id,
    title: it.title,
    notes: it.notes || null,
    dayNumber: it.day_number,
    scheduledAt: it.scheduled_at,
    durationMinutes: it.duration_minutes,
    status: it.status,
    remindedAt: it.reminded_at || null,
    missedAt: it.missed_at || null,
    completedAt: it.completed_at || null,
    rescheduleCount: it.reschedule_count || 0,
    createdAt: it.created_at,
    updatedAt: it.updated_at
  };
}

function formatPlanSummary(p) {
  return {
    id: p.id,
    userId: p.user_id,
    title: p.title,
    description: p.description || null,
    totalItems: Number(p.total_items || 0),
    completedItems: Number(p.completed_items || 0),
    missedItems: Number(p.missed_items || 0),
    nextScheduledAt: p.next_scheduled_at || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  };
}

// GET /api/v1/plans
router.get('/', async (req, res, next) => {
  try {
    const plans = await db.prepare(`
      SELECT p.*,
        COUNT(i.id) AS total_items,
        SUM(CASE WHEN i.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_items,
        SUM(CASE WHEN i.status = 'MISSED' THEN 1 ELSE 0 END) AS missed_items,
        MIN(CASE WHEN i.status = 'PENDING' THEN i.scheduled_at ELSE NULL END) AS next_scheduled_at
      FROM plans p
      LEFT JOIN plan_items i ON i.plan_id = p.id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(req.user.id);
    res.json(plans.map(formatPlanSummary));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/plans/items/missed
router.get('/items/missed', async (req, res, next) => {
  try {
    const items = await db.prepare(`
      SELECT i.*, p.title AS plan_title
      FROM plan_items i
      JOIN plans p ON p.id = i.plan_id
      WHERE i.user_id = ? AND i.status = 'MISSED'
      ORDER BY i.scheduled_at ASC
    `).all(req.user.id);
    res.json(items.map((it) => ({
      ...formatItem(it),
      planTitle: it.plan_title
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/plans/:id
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await db.prepare('SELECT * FROM plans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!plan) return notFound(res, 'Plan');

    const items = await db.prepare(`
      SELECT * FROM plan_items
      WHERE plan_id = ? AND user_id = ?
      ORDER BY scheduled_at ASC, day_number ASC
    `).all(plan.id, req.user.id);

    res.json({
      id: plan.id,
      userId: plan.user_id,
      title: plan.title,
      description: plan.description || null,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
      items: items.map(formatItem)
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/plans
router.post('/', async (req, res, next) => {
  try {
    const { title, description, items } = req.body;
    if (!title || !String(title).trim()) return badRequest(res, 'Plan title is required');
    if (!Array.isArray(items) || items.length === 0) return badRequest(res, 'At least one item is required');
    if (items.length > 500) return badRequest(res, 'A plan can have at most 500 items');

    for (const it of items) {
      if (!it.title || !String(it.title).trim()) return badRequest(res, 'Every item needs a title');
      if (!isValidIso(it.scheduledAt)) return badRequest(res, `Invalid scheduledAt for "${it.title}"`);
    }

    const now = new Date().toISOString();
    const planId = randomUUID();

    await db.exec('BEGIN');
    try {
      await db.prepare('INSERT INTO plans (id, user_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(planId, req.user.id, String(title).trim(), description || null, now, now);

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        await db.prepare(`
          INSERT INTO plan_items (id, plan_id, user_id, title, notes, day_number, scheduled_at, duration_minutes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
        `).run(
          randomUUID(), planId, req.user.id,
          String(it.title).trim(), it.notes || null,
          Number.isInteger(it.dayNumber) ? it.dayNumber : idx + 1,
          new Date(it.scheduledAt).toISOString(),
          Number.isInteger(it.durationMinutes) ? it.durationMinutes : 60,
          now, now
        );
      }
      await db.exec('COMMIT');
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }

    const plan = await db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    res.status(201).json(formatPlanSummary(plan));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/plans/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.prepare('DELETE FROM plans WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return notFound(res, 'Plan');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

async function getOwnedItem(req) {
  return await db.prepare('SELECT * FROM plan_items WHERE id = ? AND user_id = ?').get(req.params.itemId, req.user.id);
}

// POST /api/v1/plans/items/:itemId/complete (toggles complete <-> pending)
router.post('/items/:itemId/complete', async (req, res, next) => {
  try {
    const item = await getOwnedItem(req);
    if (!item) return notFound(res, 'Plan item');
    const now = new Date().toISOString();

    if (item.status === 'COMPLETED') {
      await db.prepare("UPDATE plan_items SET status = 'PENDING', completed_at = NULL, updated_at = ? WHERE id = ?").run(now, item.id);
    } else {
      await db.prepare("UPDATE plan_items SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?").run(now, now, item.id);
    }
    const updated = await db.prepare('SELECT * FROM plan_items WHERE id = ?').get(item.id);
    res.json(formatItem(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/plans/items/:itemId/reschedule
router.post('/items/:itemId/reschedule', async (req, res, next) => {
  try {
    const item = await getOwnedItem(req);
    if (!item) return notFound(res, 'Plan item');
    const { scheduledAt } = req.body;
    if (!isValidIso(scheduledAt)) return badRequest(res, 'A valid scheduledAt is required');
    if (new Date(scheduledAt).getTime() <= Date.now()) return badRequest(res, 'Pick a time in the future');
    if (item.status === 'COMPLETED') return badRequest(res, 'Item is already completed');

    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE plan_items
      SET scheduled_at = ?, status = 'PENDING', reminded_at = NULL, missed_at = NULL,
          reschedule_count = reschedule_count + 1, updated_at = ?
      WHERE id = ?
    `).run(new Date(scheduledAt).toISOString(), now, item.id);

    const updated = await db.prepare('SELECT * FROM plan_items WHERE id = ?').get(item.id);
    res.json(formatItem(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
