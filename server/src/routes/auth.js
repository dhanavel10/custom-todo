import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { hashPassword, comparePassword, generateToken, authenticate } from '../auth.js';

const router = express.Router();

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName, timeZone } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password must be at least 6 characters'
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists'
        }
      });
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const zone = timeZone || 'Asia/Kolkata';

    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, time_zone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, passwordHash, displayName || null, zone, now, now);

    db.prepare(`
      INSERT INTO user_preferences (user_id, updated_at)
      VALUES (?, ?)
    `).run(userId, now);

    const user = {
      id: userId,
      email: normalizedEmail,
      displayName: displayName || null,
      timeZone: zone,
      createdAt: now
    };

    const token = generateToken({
      id: userId,
      email: normalizedEmail,
      display_name: displayName || null,
      time_zone: zone
    });

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      user,
      token
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);

    if (!userRow) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    const passwordValid = await comparePassword(password, userRow.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      timeZone: userRow.time_zone,
      createdAt: userRow.created_at
    };

    const token = generateToken(userRow);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      user,
      token
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Successfully logged out' });
});

// GET /api/v1/auth/me or GET /api/v1/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, display_name as displayName, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'User not found' }
    });
  }
  const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
  res.status(200).json({ user, preferences });
});

export default router;
