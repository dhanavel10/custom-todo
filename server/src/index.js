import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import capturesRoutes from './routes/captures.js';
import tasksRoutes from './routes/tasks.js';
import notesRoutes from './routes/notes.js';
import remindersRoutes from './routes/reminders.js';
import notificationsRoutes from './routes/notifications.js';
import { startReminderScheduler } from './remindersScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server directory or project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Mount API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/me', userRoutes);
app.use('/api/v1/captures', capturesRoutes);
app.use('/api/v1/tasks', tasksRoutes);
app.use('/api/v1/notes', notesRoutes);
app.use('/api/v1/reminders', remindersRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// Serve frontend client in production
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Global Error Handler conforming to Section 6.4
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

// Start Background Reminder Poller (every 10 seconds for responsive in-app alerts)
startReminderScheduler(10000);

// Start HTTP Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Productivity Backend & App running on port ${PORT}`);
  console.log(`Open in browser: http://localhost:${PORT}`);
});

