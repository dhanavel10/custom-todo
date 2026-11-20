import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { authenticate } from '../auth.js';
import { analyzeTaskWithAI, getOllamaStatus } from '../ollamaService.js';

const router = express.Router();
router.use(authenticate);

// GET /api/v1/tasks/ai-status - Ollama connection & model info
router.get('/ai-status', async (req, res, next) => {
  try {
    const status = await getOllamaStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/matrix - Eisenhower Matrix 4 quadrants
router.get('/matrix', async (req, res, next) => {
  try {
    const tasks = await db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND status != 'ARCHIVED'
      ORDER BY created_at DESC
    `).all(req.user.id);

    const formatted = tasks.map(formatTask);
    res.json({
      doFirst: formatted.filter((t) => t.eisenhowerQuadrant === 'DO_FIRST'),
      schedule: formatted.filter((t) => t.eisenhowerQuadrant === 'SCHEDULE'),
      delegate: formatted.filter((t) => t.eisenhowerQuadrant === 'DELEGATE'),
      eliminate: formatted.filter((t) => t.eisenhowerQuadrant === 'ELIMINATE')
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/today
router.get('/today', async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const tasks = await db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND status != 'ARCHIVED'
        AND status != 'COMPLETED'
        AND due_at >= ? AND due_at <= ?
      ORDER BY due_at ASC, created_at DESC
    `).all(req.user.id, startOfDay, endOfDay);

    res.json(tasks.map(formatTask));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/upcoming
router.get('/upcoming', async (req, res, next) => {
  try {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const tasks = await db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND status != 'ARCHIVED'
        AND status != 'COMPLETED'
        AND due_at > ?
      ORDER BY due_at ASC
    `).all(req.user.id, endOfDay);

    res.json(tasks.map(formatTask));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/overdue
router.get('/overdue', async (req, res, next) => {
  try {
    const now = new Date().toISOString();

    const tasks = await db.prepare(`
      SELECT * FROM tasks
      WHERE user_id = ?
        AND status != 'ARCHIVED'
        AND status != 'COMPLETED'
        AND due_at IS NOT NULL
        AND due_at < ?
      ORDER BY due_at ASC
    `).all(req.user.id, now);

    res.json(tasks.map(formatTask));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks - Filtered list
router.get('/', async (req, res, next) => {
  try {
    const { status, priority, from, to, q, sort = 'created_at_desc', page = 1, size = 50 } = req.query;

    let query = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    if (from) {
      query += ' AND due_at >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND due_at <= ?';
      params.push(to);
    }
    if (q && q.trim()) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    // Sort order
    if (sort === 'due_at_asc') {
      query += ' ORDER BY due_at IS NULL, due_at ASC, created_at DESC';
    } else if (sort === 'due_at_desc') {
      query += ' ORDER BY due_at DESC, created_at DESC';
    } else if (sort === 'priority_desc') {
      query += ` ORDER BY CASE priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END, created_at DESC`;
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const limit = Math.max(1, parseInt(size, 10) || 50);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tasks = await db.prepare(query).all(...params);
    res.json(tasks.map(formatTask));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks - Create task with Ollama AI categorization & Eisenhower analysis
router.post('/', async (req, res, next) => {
  try {
    const {
      title,
      description = null,
      status = 'TODO',
      priority = null,
      dueAt = null,
      dueTimeZone = req.user.timeZone || 'Asia/Kolkata',
      captureId = null,
      category = null,
      urgency = null,
      importance = null,
      eisenhowerQuadrant = null
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Task title is required' } });
    }

    // Run Ollama AI task classification
    const aiResult = await analyzeTaskWithAI({
      title: title.trim(),
      description: description || '',
      deadline: dueAt,
      userTimeZone: dueTimeZone
    });

    const finalCategory = category || aiResult.category || 'General';
    const finalUrgency = urgency || aiResult.urgency || 'NOT_URGENT';
    const finalImportance = importance || aiResult.importance || 'NOT_IMPORTANT';
    const finalQuadrant = (eisenhowerQuadrant && eisenhowerQuadrant !== 'AUTO')
      ? eisenhowerQuadrant
      : (aiResult.eisenhowerQuadrant || 'DO_FIRST');
    const finalIsDeadline = aiResult.isDeadline ? 1 : 0;
    const finalDueAt = dueAt || (aiResult.isDeadline && aiResult.resolvedDeadline ? aiResult.resolvedDeadline : null);

    // Default priority if not given: map from quadrant
    let finalPriority = priority;
    if (!finalPriority) {
      if (finalQuadrant === 'DO_FIRST') finalPriority = 'URGENT';
      else if (finalQuadrant === 'SCHEDULE') finalPriority = 'HIGH';
      else if (finalQuadrant === 'DELEGATE') finalPriority = 'MEDIUM';
      else finalPriority = 'LOW';
    }

    const taskId = randomUUID();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO tasks (
        id, user_id, capture_id, title, description, status, priority,
        category, urgency, importance, eisenhower_quadrant, is_deadline,
        detected_dates, ai_analysis, due_at, due_time_zone, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      req.user.id,
      captureId,
      title.trim(),
      description,
      status,
      finalPriority,
      finalCategory,
      finalUrgency,
      finalImportance,
      finalQuadrant,
      finalIsDeadline,
      JSON.stringify(aiResult.detectedDates || []),
      JSON.stringify(aiResult.aiAnalysis || null),
      finalDueAt,
      dueTimeZone,
      now,
      now
    );

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json(formatTask(task));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }
    const reminders = await db.prepare('SELECT * FROM reminders WHERE task_id = ? AND user_id = ? ORDER BY remind_at ASC').all(task.id, req.user.id);
    res.json({
      ...formatTask(task),
      reminders: reminders.map(formatReminder)
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tasks/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const {
      title,
      description,
      status,
      priority,
      dueAt,
      dueTimeZone,
      category,
      urgency,
      importance,
      eisenhowerQuadrant
    } = req.body;
    const now = new Date().toISOString();

    let completedAt = existing.completed_at;
    let archivedAt = existing.archived_at;

    if (status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      completedAt = now;
      await db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE task_id = ? AND status = 'PENDING'").run(existing.id);
    } else if (status && status !== 'COMPLETED') {
      completedAt = null;
    }

    if (status === 'ARCHIVED' && existing.status !== 'ARCHIVED') {
      archivedAt = now;
      await db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE task_id = ? AND status = 'PENDING'").run(existing.id);
    } else if (status && status !== 'ARCHIVED') {
      archivedAt = null;
    }

    await db.prepare(`
      UPDATE tasks
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = ?,
          category = COALESCE(?, category),
          urgency = COALESCE(?, urgency),
          importance = COALESCE(?, importance),
          eisenhower_quadrant = COALESCE(?, eisenhower_quadrant),
          due_at = ?,
          due_time_zone = COALESCE(?, due_time_zone),
          completed_at = ?,
          archived_at = ?,
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title !== undefined ? title.trim() : null,
      description !== undefined ? description : null,
      status !== undefined ? status : null,
      priority !== undefined ? priority : existing.priority,
      category !== undefined ? category : null,
      urgency !== undefined ? urgency : null,
      importance !== undefined ? importance : null,
      eisenhowerQuadrant !== undefined ? eisenhowerQuadrant : null,
      dueAt !== undefined ? dueAt : existing.due_at,
      dueTimeZone !== undefined ? dueTimeZone : null,
      completedAt,
      archivedAt,
      now,
      req.params.id,
      req.user.id
    );

    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(formatTask(updated));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tasks/:id/quadrant - Move task to a different Eisenhower quadrant
router.patch('/:id/quadrant', async (req, res, next) => {
  try {
    const { quadrant } = req.body;
    const valid = ['DO_FIRST', 'SCHEDULE', 'DELEGATE', 'ELIMINATE'];
    if (!valid.includes(quadrant)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: `Quadrant must be one of: ${valid.join(', ')}` }
      });
    }

    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const urgency = (quadrant === 'DO_FIRST' || quadrant === 'DELEGATE') ? 'URGENT' : 'NOT_URGENT';
    const importance = (quadrant === 'DO_FIRST' || quadrant === 'SCHEDULE') ? 'IMPORTANT' : 'NOT_IMPORTANT';
    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE tasks
      SET eisenhower_quadrant = ?,
          urgency = ?,
          importance = ?,
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(quadrant, urgency, importance, now, req.params.id, req.user.id);

    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(formatTask(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/analyze - Re-analyze an existing task with Ollama AI
router.post('/:id/analyze', async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const aiResult = await analyzeTaskWithAI({
      title: existing.title,
      description: existing.description || '',
      deadline: existing.due_at,
      userTimeZone: existing.due_time_zone || req.user.timeZone
    });

    const now = new Date().toISOString();
    const finalDueAt = existing.due_at || (aiResult.isDeadline && aiResult.resolvedDeadline ? aiResult.resolvedDeadline : null);

    await db.prepare(`
      UPDATE tasks
      SET category = ?,
          urgency = ?,
          importance = ?,
          eisenhower_quadrant = ?,
          is_deadline = ?,
          detected_dates = ?,
          ai_analysis = ?,
          due_at = COALESCE(?, due_at),
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      aiResult.category,
      aiResult.urgency,
      aiResult.importance,
      aiResult.eisenhowerQuadrant,
      aiResult.isDeadline ? 1 : 0,
      JSON.stringify(aiResult.detectedDates || []),
      JSON.stringify(aiResult.aiAnalysis || null),
      finalDueAt,
      now,
      req.params.id,
      req.user.id
    );

    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(formatTask(updated));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/tasks/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Status is required' } });
    }

    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const now = new Date().toISOString();
    let completedAt = existing.completed_at;
    let archivedAt = existing.archived_at;

    if (status === 'COMPLETED') {
      completedAt = now;
      await db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE task_id = ? AND status = 'PENDING'").run(existing.id);
    } else {
      completedAt = null;
    }

    if (status === 'ARCHIVED') {
      archivedAt = now;
      await db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE task_id = ? AND status = 'PENDING'").run(existing.id);
    } else {
      archivedAt = null;
    }

    await db.prepare(`
      UPDATE tasks
      SET status = ?, completed_at = ?, archived_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(status, completedAt, archivedAt, now, req.params.id, req.user.id);

    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(formatTask(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/complete
router.post('/:id/complete', async (req, res, next) => {
  try {
    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const now = new Date().toISOString();
    const newStatus = existing.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    const completedAt = newStatus === 'COMPLETED' ? now : null;

    if (newStatus === 'COMPLETED') {
      await db.prepare("UPDATE reminders SET status = 'CANCELLED' WHERE task_id = ? AND status = 'PENDING'").run(existing.id);
    }

    await db.prepare(`
      UPDATE tasks
      SET status = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(newStatus, completedAt, now, req.params.id, req.user.id);

    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(formatTask(updated));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/tasks/:id/reminders
router.post('/:id/reminders', async (req, res, next) => {
  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const { remindAt, channel = 'IN_APP' } = req.body;
    if (!remindAt) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'remindAt ISO time is required' } });
    }

    const reminderId = randomUUID();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO reminders (id, user_id, task_id, remind_at, channel, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(reminderId, req.user.id, task.id, remindAt, channel, now);

    const reminder = await db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
    res.status(201).json(formatReminder(reminder));
  } catch (err) {
    next(err);
  }
});

export function formatTask(t) {
  let detectedDates = [];
  let aiAnalysis = null;
  try {
    if (t.detected_dates) {
      detectedDates = typeof t.detected_dates === 'string' ? JSON.parse(t.detected_dates) : t.detected_dates;
    }
  } catch {}
  try {
    if (t.ai_analysis) {
      aiAnalysis = typeof t.ai_analysis === 'string' ? JSON.parse(t.ai_analysis) : t.ai_analysis;
    }
  } catch {}

  return {
    id: t.id,
    userId: t.user_id,
    captureId: t.capture_id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category || 'General',
    urgency: t.urgency || 'NOT_URGENT',
    importance: t.importance || 'NOT_IMPORTANT',
    eisenhowerQuadrant: t.eisenhower_quadrant || 'DO_FIRST',
    isDeadline: Boolean(t.is_deadline),
    detectedDates,
    aiAnalysis,
    dueAt: t.due_at,
    dueTimeZone: t.due_time_zone,
    completedAt: t.completed_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    archivedAt: t.archived_at
  };
}

function formatReminder(r) {
  return {
    id: r.id,
    userId: r.user_id,
    taskId: r.task_id,
    remindAt: r.remind_at,
    channel: r.channel,
    status: r.status,
    sentAt: r.sent_at,
    createdAt: r.created_at
  };
}

export default router;
