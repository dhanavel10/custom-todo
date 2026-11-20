import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { authenticate } from '../auth.js';
import { parseCapture } from '../parser.js';
import { analyzeTaskWithAI } from '../ollamaService.js';
import { formatTask } from './tasks.js';

const router = express.Router();
router.use(authenticate);

// POST /api/v1/captures - Universal quick capture
router.post('/', async (req, res, next) => {
  try {
    const { text, inputMode = 'TEXT', autoConvert = true } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Capture text cannot be empty' }
      });
    }

    const captureId = randomUUID();
    const now = new Date().toISOString();
    const rawText = text.trim();

    // 1. Immediately save raw capture to database first!
    await db.prepare(`
      INSERT INTO captures (id, user_id, raw_text, input_mode, parse_status, created_at)
      VALUES (?, ?, ?, ?, 'NOT_PROCESSED', ?)
    `).run(captureId, req.user.id, rawText, inputMode, now);

    // 2. Perform parsing
    const userTimeZone = req.user.timeZone || 'Asia/Kolkata';
    const parsed = parseCapture(rawText, userTimeZone);

    // 3. Update capture record with parsed fields
    await db.prepare(`
      UPDATE captures
      SET detected_type = ?,
          parsed_title = ?,
          parsed_due_at = ?,
          parse_status = ?
      WHERE id = ?
    `).run(
      parsed.detectedType,
      parsed.suggestedTitle,
      parsed.suggestedDueAt,
      parsed.parseStatus,
      captureId
    );

    let createdTask = null;
    // 4. Auto-convert tasks to Eisenhower Matrix with AI classification
    if (autoConvert && parsed.detectedType !== 'NOTE') {
      const finalTitle = (parsed.suggestedTitle || rawText).trim();
      const dueAt = parsed.suggestedDueAt || null;

      const aiResult = await analyzeTaskWithAI({
        title: finalTitle,
        description: '',
        deadline: dueAt,
        userTimeZone
      });

      const finalCategory = aiResult.category || 'General';
      const finalUrgency = aiResult.urgency || 'NOT_URGENT';
      const finalImportance = aiResult.importance || 'NOT_IMPORTANT';
      const finalQuadrant = aiResult.eisenhowerQuadrant || 'DO_FIRST';
      const finalIsDeadline = aiResult.isDeadline ? 1 : 0;
      const finalDueAt = dueAt || (aiResult.isDeadline && aiResult.resolvedDeadline ? aiResult.resolvedDeadline : null);

      let finalPriority = null;
      if (finalQuadrant === 'DO_FIRST') finalPriority = 'URGENT';
      else if (finalQuadrant === 'SCHEDULE') finalPriority = 'HIGH';
      else if (finalQuadrant === 'DELEGATE') finalPriority = 'MEDIUM';
      else finalPriority = 'LOW';

      const taskId = randomUUID();
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
        finalTitle,
        null,
        'TODO',
        finalPriority,
        finalCategory,
        finalUrgency,
        finalImportance,
        finalQuadrant,
        finalIsDeadline,
        JSON.stringify(aiResult.detectedDates || []),
        JSON.stringify(aiResult.aiAnalysis || null),
        finalDueAt,
        userTimeZone,
        now,
        now
      );

      await db.prepare(`
        UPDATE captures
        SET converted_entity_type = 'TASK',
            converted_entity_id = ?
        WHERE id = ?
      `).run(taskId, captureId);

      const taskRow = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      createdTask = formatTask(taskRow);
    }

    const captureRow = await db.prepare('SELECT * FROM captures WHERE id = ?').get(captureId);
    res.status(201).json({
      id: captureRow.id,
      userId: captureRow.user_id,
      rawText: captureRow.raw_text,
      inputMode: captureRow.input_mode,
      detectedType: captureRow.detected_type,
      suggestedTitle: captureRow.parsed_title,
      suggestedDueAt: captureRow.parsed_due_at,
      parseStatus: captureRow.parse_status,
      convertedEntityType: captureRow.converted_entity_type,
      convertedEntityId: captureRow.converted_entity_id,
      createdAt: captureRow.created_at,
      createdTask
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/captures - List captures
router.get('/', async (req, res, next) => {
  try {
    const { all = 'false' } = req.query;
    let query = 'SELECT * FROM captures WHERE user_id = ?';
    if (all !== 'true') {
      query += " AND converted_entity_type IS NULL AND parse_status = 'NEEDS_REVIEW'";
    }
    query += ' ORDER BY created_at DESC LIMIT 50';

    const captures = await db.prepare(query).all(req.user.id);
    res.json(captures.map((c) => ({
      id: c.id,
      userId: c.user_id,
      rawText: c.raw_text,
      inputMode: c.input_mode,
      detectedType: c.detected_type,
      suggestedTitle: c.parsed_title,
      suggestedDueAt: c.parsed_due_at,
      parseStatus: c.parse_status,
      convertedEntityType: c.converted_entity_type,
      convertedEntityId: c.converted_entity_id,
      createdAt: c.created_at
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/captures/:id
router.get('/:id', async (req, res, next) => {
  try {
    const capture = await db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!capture) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }
    res.json({
      id: capture.id,
      userId: capture.user_id,
      rawText: capture.raw_text,
      inputMode: capture.input_mode,
      detectedType: capture.detected_type,
      suggestedTitle: capture.parsed_title,
      suggestedDueAt: capture.parsed_due_at,
      parseStatus: capture.parse_status,
      convertedEntityType: capture.converted_entity_type,
      convertedEntityId: capture.converted_entity_id,
      createdAt: capture.created_at
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/captures/:id/convert-to-task
router.post('/:id/convert-to-task', async (req, res, next) => {
  try {
    const capture = await db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!capture) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }

    const {
      title = capture.parsed_title || capture.raw_text,
      description = null,
      dueAt = capture.parsed_due_at,
      priority = null,
      category = 'General',
      eisenhowerQuadrant = 'DO_FIRST'
    } = req.body;

    const taskId = randomUUID();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO tasks (
        id, user_id, capture_id, title, description, status, priority,
        category, eisenhower_quadrant, due_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'TODO', ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      req.user.id,
      capture.id,
      title.trim(),
      description,
      priority,
      category,
      eisenhowerQuadrant,
      dueAt,
      now,
      now
    );

    await db.prepare(`
      UPDATE captures
      SET converted_entity_type = 'TASK',
          converted_entity_id = ?
      WHERE id = ?
    `).run(taskId, capture.id);

    const createdTask = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json(formatTask(createdTask));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/captures/:id/convert-to-note
router.post('/:id/convert-to-note', async (req, res, next) => {
  try {
    const capture = await db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!capture) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }

    const {
      title = capture.parsed_title || null,
      content = capture.raw_text,
      isPinned = false
    } = req.body;

    const noteId = randomUUID();
    const now = new Date().toISOString();

    await db.prepare(`
      INSERT INTO notes (id, user_id, capture_id, title, content, is_pinned, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(noteId, req.user.id, capture.id, title, content, isPinned ? 1 : 0, now, now);

    await db.prepare(`
      UPDATE captures
      SET converted_entity_type = 'NOTE',
          converted_entity_id = ?
      WHERE id = ?
    `).run(noteId, capture.id);

    const note = await db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    res.status(201).json({
      id: note.id,
      userId: note.user_id,
      captureId: note.capture_id,
      title: note.title,
      content: note.content,
      isPinned: Boolean(note.is_pinned),
      isArchived: Boolean(note.is_archived),
      createdAt: note.created_at,
      updatedAt: note.updated_at
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/captures/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.prepare('DELETE FROM captures WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
