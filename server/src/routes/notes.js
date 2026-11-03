import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { authenticate } from '../auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/v1/notes
router.get('/', (req, res, next) => {
  try {
    const { q, pinned, archived } = req.query;
    let query = 'SELECT * FROM notes WHERE user_id = ?';
    const params = [req.user.id];

    if (archived === 'true') {
      query += ' AND is_archived = 1';
    } else {
      query += ' AND is_archived = 0';
    }

    if (pinned === 'true') {
      query += ' AND is_pinned = 1';
    }

    if (q && q.trim()) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    query += ' ORDER BY is_pinned DESC, updated_at DESC';

    const notes = db.prepare(query).all(...params);
    res.json(notes.map(formatNote));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notes - Create an empty or populated note
router.post('/', (req, res, next) => {
  try {
    const { title = '', content = '', isPinned = false } = req.body;
    const noteId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO notes (id, user_id, title, content, is_pinned, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(noteId, req.user.id, title || null, content, isPinned ? 1 : 0, now, now);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    res.status(201).json(formatNote(note));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notes/:id
router.get('/:id', (req, res, next) => {
  try {
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    }
    res.json(formatNote(note));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/notes/:id - Autosave / update note
router.patch('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    }

    const { title, content, isPinned, isArchived } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE notes
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          is_pinned = COALESCE(?, is_pinned),
          is_archived = COALESCE(?, is_archived),
          updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title !== undefined ? title : null,
      content !== undefined ? content : null,
      isPinned !== undefined ? (isPinned ? 1 : 0) : null,
      isArchived !== undefined ? (isArchived ? 1 : 0) : null,
      now,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(formatNote(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notes/:id/pin
router.post('/:id/pin', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    }

    const newPinned = existing.is_pinned ? 0 : 1;
    const now = new Date().toISOString();
    db.prepare('UPDATE notes SET is_pinned = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(newPinned, now, req.params.id, req.user.id);

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(formatNote(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notes/:id/archive
router.post('/:id/archive', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    }

    const newArchived = existing.is_archived ? 0 : 1;
    const now = new Date().toISOString();
    db.prepare('UPDATE notes SET is_archived = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(newArchived, now, req.params.id, req.user.id);

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(formatNote(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notes/:id/convert-to-task - Convert note into task without losing note!
router.post('/:id/convert-to-task', (req, res, next) => {
  try {
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
    }

    const {
      title = note.title || (note.content ? note.content.slice(0, 80) : 'Note task'),
      description = note.content || null,
      dueAt = null,
      priority = null
    } = req.body;

    const taskId = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, user_id, title, description, status, priority, due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'TODO', ?, ?, ?, ?)
    `).run(taskId, req.user.id, title, description, priority, dueAt, now, now);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    res.status(201).json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueAt: task.due_at,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      },
      originalNote: formatNote(note)
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/notes/:id
router.delete('/:id', (req, res, next) => {
  try {
    const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Note not found' } });
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
