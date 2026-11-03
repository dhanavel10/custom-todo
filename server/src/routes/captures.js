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
    db.prepare(`
      INSERT INTO captures (id, user_id, raw_text, input_mode, parse_status, created_at)
      VALUES (?, ?, ?, ?, 'NOT_PROCESSED', ?)
    `).run(captureId, req.user.id, rawText, inputMode, now);

    // 2. Perform parsing
    const userTimeZone = req.user.timeZone || 'Asia/Kolkata';
    const parsed = parseCapture(rawText, userTimeZone);

    // 3. Update capture record with parsed fields
    db.prepare(`
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
      db.prepare(`
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

      db.prepare(`
        UPDATE captures
        SET converted_entity_type = 'TASK',
            converted_entity_id = ?
        WHERE id = ?
      `).run(taskId, captureId);

      const taskRow = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      createdTask = formatTask(taskRow);
    }

    // Format response matching Section 6.3
    res.status(201).json({
      id: captureId,
      rawText,
      inputMode,
      detectedType: parsed.detectedType,
      suggestedTitle: parsed.suggestedTitle,
      suggestedDueAt: parsed.suggestedDueAt,
      isAmbiguous: parsed.isAmbiguous,
      parseStatus: parsed.parseStatus,
      createdTask,
      createdAt: now
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/captures - List captures (unprocessed or all)
router.get('/', (req, res, next) => {
  try {
    const { all } = req.query;
    let query = 'SELECT * FROM captures WHERE user_id = ?';
    if (!all || all === 'false') {
      // Return captures that have not been converted yet
      query += ' AND converted_entity_id IS NULL';
    }
    query += ' ORDER BY created_at DESC';

    const captures = db.prepare(query).all(req.user.id);
    const formatted = captures.map(c => ({
      id: c.id,
      rawText: c.raw_text,
      inputMode: c.input_mode,
      detectedType: c.detected_type,
      suggestedTitle: c.parsed_title,
      suggestedDueAt: c.parsed_due_at,
      parseStatus: c.parse_status,
      convertedEntityType: c.converted_entity_type,
      convertedEntityId: c.converted_entity_id,
      createdAt: c.created_at
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/captures/:id
router.get('/:id', (req, res, next) => {
  try {
    const capture = db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!capture) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }
    res.json({
      id: capture.id,
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
    const capture = db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!capture) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }

    const {
      title = capture.parsed_title || capture.raw_text,
      description = null,
      priority = null,
      dueAt = capture.parsed_due_at || null,
      dueTimeZone = req.user.timeZone || 'Asia/Kolkata',
      status = 'TODO'
    } = req.body;

    const finalTitle = (title || capture.raw_text).trim();
    const aiResult = await analyzeTaskWithAI({
      title: finalTitle,
      description: description || '',
      deadline: dueAt,
      userTimeZone: dueTimeZone
    });

    const finalCategory = aiResult.category || 'General';
    const finalUrgency = aiResult.urgency || 'NOT_URGENT';
    const finalImportance = aiResult.importance || 'NOT_IMPORTANT';
    const finalQuadrant = aiResult.eisenhowerQuadrant || 'DO_FIRST';
    const finalIsDeadline = aiResult.isDeadline ? 1 : 0;
    const finalDueAt = dueAt || (aiResult.isDeadline && aiResult.resolvedDeadline ? aiResult.resolvedDeadline : null);

    let finalPriority = priority;
    if (!finalPriority) {
      if (finalQuadrant === 'DO_FIRST') finalPriority = 'URGENT';
      else if (finalQuadrant === 'SCHEDULE') finalPriority = 'HIGH';
      else if (finalQuadrant === 'DELEGATE') finalPriority = 'MEDIUM';
      else finalPriority = 'LOW';
    }

    const taskId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (
        id, user_id, capture_id, title, description, status, priority,
        category, urgency, importance, eisenhower_quadrant, is_deadline,
        detected_dates, ai_analysis, due_at, due_time_zone, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      req.user.id,
      capture.id,
      finalTitle,
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

    db.prepare(`
      UPDATE captures
      SET converted_entity_type = 'TASK',
          converted_entity_id = ?
      WHERE id = ?
    `).run(taskId, capture.id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json(formatTask(task));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/captures/:id/convert-to-note
router.post('/:id/convert-to-note', (req, res, next) => {
  try {
    const capture = db.prepare('SELECT * FROM captures WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!capture) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }

    const {
      title = capture.parsed_title || null,
      content = capture.raw_text || ''
    } = req.body;

    const noteId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notes (id, user_id, capture_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(noteId, req.user.id, capture.id, title, content, now, now);

    db.prepare(`
      UPDATE captures
      SET converted_entity_type = 'NOTE',
          converted_entity_id = ?
      WHERE id = ?
    `).run(noteId, capture.id);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    res.status(201).json(formatNote(note));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/captures/:id
router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM captures WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});


function formatNote(n) {
  return {
    id: n.id,
    userId: n.user_id,
    captureId: n.capture_id,
    title: n.title,
    content: n.content,
    isPinned: Boolean(n.is_pinned),
    isArchived: Boolean(n.is_archived),
    createdAt: n.created_at,
    updatedAt: n.updated_at
  };
}

export default router;
