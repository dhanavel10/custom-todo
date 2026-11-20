import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  authenticate,
  validateStrongPassword,
  validateUsername,
  verifyGoogleIdToken
} from '../auth.js';

const router = express.Router();

// GET /api/v1/auth/config - Expose public auth configuration to frontend
router.get('/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: true
    }
  });
});

// POST /api/v1/auth/google - Authenticate or register with Google OAuth
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Google credential is required' }
      });
    }

    const googleProfile = await verifyGoogleIdToken(credential);
    const { googleId, email, displayName, avatarUrl } = googleProfile;

    if (!email) {
      return res.status(400).json({
        error: { code: 'GOOGLE_AUTH_ERROR', message: 'Could not obtain email from Google account' }
      });
    }

    // Check if user already exists by google_id or email
    let userRow = await db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);

    const now = new Date().toISOString();

    if (userRow) {
      // Update google_id or avatar if missing
      await db.prepare(`
        UPDATE users
        SET google_id = COALESCE(google_id, ?),
            avatar_url = COALESCE(?, avatar_url),
            display_name = COALESCE(display_name, ?),
            updated_at = ?
        WHERE id = ?
      `).run(googleId, avatarUrl, displayName, now, userRow.id);

      userRow = await db.prepare('SELECT * FROM users WHERE id = ?').get(userRow.id);
    } else {
      // Create new user via Google Sign-In
      const userId = randomUUID();
      const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';
      let candidateUsername = baseUsername.slice(0, 20);

      // Ensure unique username
      const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(candidateUsername);
      if (existingUser) {
        candidateUsername = `${candidateUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const zone = 'Asia/Kolkata';

      await db.prepare(`
        INSERT INTO users (id, email, username, google_id, display_name, avatar_url, time_zone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, email, candidateUsername, googleId, displayName, avatarUrl, zone, now, now);

      await db.prepare(`
        INSERT INTO user_preferences (user_id, updated_at)
        VALUES (?, ?)
      `).run(userId, now);

      userRow = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }

    const token = generateToken(userRow);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = {
      id: userRow.id,
      email: userRow.email,
      username: userRow.username,
      displayName: userRow.display_name,
      avatarUrl: userRow.avatar_url,
      timeZone: userRow.time_zone,
      createdAt: userRow.created_at
    };

    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password, displayName, timeZone } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
    }

    // Strong password validation
    const passCheck = validateStrongPassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: passCheck.message
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const existingEmail = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingEmail) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email already exists'
        }
      });
    }

    // Handle username
    let normalizedUsername = null;
    if (username && username.trim()) {
      const userCheck = validateUsername(username);
      if (!userCheck.valid) {
        return res.status(400).json({
          error: {
            code: 'INVALID_USERNAME',
            message: userCheck.message
          }
        });
      }
      normalizedUsername = userCheck.username;

      const existingUsername = await db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
      if (existingUsername) {
        return res.status(409).json({
          error: {
            code: 'USERNAME_ALREADY_EXISTS',
            message: 'This username is already taken'
          }
        });
      }
    } else {
      // Auto-generate safe username from email prefix
      const base = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';
      let candidate = base.slice(0, 20);
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(candidate);
      normalizedUsername = existing ? `${candidate}_${Math.floor(1000 + Math.random() * 9000)}` : candidate;
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const zone = timeZone || 'Asia/Kolkata';

    await db.prepare(`
      INSERT INTO users (id, email, username, password_hash, display_name, time_zone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, normalizedUsername, passwordHash, displayName || null, zone, now, now);

    await db.prepare(`
      INSERT INTO user_preferences (user_id, updated_at)
      VALUES (?, ?)
    `).run(userId, now);

    const user = {
      id: userId,
      email: normalizedEmail,
      username: normalizedUsername,
      displayName: displayName || null,
      timeZone: zone,
      createdAt: now
    };

    const token = generateToken({
      id: userId,
      email: normalizedEmail,
      username: normalizedUsername,
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

// POST /api/v1/auth/login (supports logging in by email OR username)
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, email, username, password } = req.body;
    const loginIdentifier = (identifier || email || username || '').trim().toLowerCase();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username/Email and password are required'
        }
      });
    }

    // Lookup user by either email or username
    const userRow = await db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(loginIdentifier, loginIdentifier);

    if (!userRow || !userRow.password_hash) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials. If you signed up with Google, please use Google Sign-In.'
        }
      });
    }

    const passwordValid = await comparePassword(password, userRow.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        }
      });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      username: userRow.username,
      displayName: userRow.display_name,
      avatarUrl: userRow.avatar_url,
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

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await db.prepare('SELECT id, email, username, display_name as displayName, avatar_url as avatarUrl, time_zone as timeZone, created_at as createdAt FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' }
      });
    }
    const preferences = await db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    res.status(200).json({ user, preferences });
  } catch (err) {
    next(err);
  }
});

export default router;
