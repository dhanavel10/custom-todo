import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'productivity-inbox-super-secret-key-change-in-prod';
const TOKEN_EXPIRY = '7d';

/**
 * Validates strong password rules:
 * - At least 8 characters
 * - At least 1 lowercase letter
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export function validateStrongPassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*...)' };
  }
  return { valid: true };
}

/**
 * Validates username (3-30 characters, alphanumeric and underscore)
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: 'Username is required' };
  }
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 30) {
    return { valid: false, message: 'Username must be between 3 and 30 characters' };
  }
  if (!/^[a-z0-9_]+$/.test(trimmed)) {
    return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
  }
  return { valid: true, username: trimmed };
}

/**
 * Verifies a Google ID Token using Google's public tokeninfo endpoint
 */
export async function verifyGoogleIdToken(credential) {
  if (!credential) {
    throw new Error('Google credential token is required');
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error_description || 'Invalid Google credential');
  }

  const payload = await resp.json();
  const configuredAud = process.env.GOOGLE_CLIENT_ID;
  if (configuredAud && payload.aud !== configuredAud) {
    throw new Error('Google token audience does not match configured GOOGLE_CLIENT_ID');
  }

  return {
    googleId: payload.sub,
    email: payload.email?.toLowerCase(),
    emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
    displayName: payload.name || payload.given_name || payload.email?.split('@')[0],
    avatarUrl: payload.picture || null
  };
}

export async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, 12);
}

export async function comparePassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false;
  return await bcrypt.compare(plainPassword, hash);
}

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username || null,
      displayName: user.display_name || user.displayName || null,
      timeZone: user.time_zone || user.timeZone || 'Asia/Kolkata',
      avatarUrl: user.avatar_url || user.avatarUrl || null
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.clearCookie('token');
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing. Please sign in.'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.status(401).json({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Your 7-day login session has expired. Please sign in again.'
      }
    });
  }
}
