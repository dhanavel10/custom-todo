export type TaskStatus = 'INBOX' | 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | null;
export type ItemType = 'TASK' | 'NOTE' | 'UNKNOWN';
export type ParseStatus = 'NOT_PROCESSED' | 'PROCESSED' | 'NEEDS_REVIEW' | 'FAILED';

export type EisenhowerQuadrant = 'DO_FIRST' | 'SCHEDULE' | 'DELEGATE' | 'ELIMINATE';
export type UrgencyLevel = 'URGENT' | 'NOT_URGENT';
export type ImportanceLevel = 'IMPORTANT' | 'NOT_IMPORTANT';

export interface DetectedDateEntity {
  raw: string;
  dateISO: string | null;
  isDeadline: boolean;
  reason: string;
}

export interface TaskAIAnalysis {
  source: string;
  model: string;
  urgencyScore: number;
  importanceScore: number;
  reasoning: string;
}

export interface EisenhowerMatrixData {
  doFirst: Task[];
  schedule: Task[];
  delegate: Task[];
  eliminate: Task[];
}

export interface AIStatus {
  connected: boolean;
  baseUrl: string;
  model: string;
  availableModels: string[];
  error?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  timeZone: string;
  createdAt: string;
}

export interface UserPreferences {
  user_id: string;
  daily_review_morning_enabled: number;
  daily_review_morning_time: string;
  daily_review_evening_enabled: number;
  daily_review_evening_time: string;
  lead_time_minutes: number;
  in_app_notifications: number;
}

export interface Capture {
  id: string;
  rawText: string;
  inputMode: string;
  detectedType: ItemType;
  suggestedTitle: string | null;
  suggestedDueAt: string | null;
  isAmbiguous?: boolean;
  parseStatus: ParseStatus;
  convertedEntityType: 'TASK' | 'NOTE' | null;
  convertedEntityId: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  userId: string;
  captureId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category?: string;
  urgency?: UrgencyLevel;
  importance?: ImportanceLevel;
  eisenhowerQuadrant?: EisenhowerQuadrant;
  isDeadline?: boolean;
  detectedDates?: DetectedDateEntity[];
  aiAnalysis?: TaskAIAnalysis | null;
  dueAt: string | null;
  dueTimeZone: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  reminders?: Reminder[];
}

export interface Note {
  id: string;
  userId: string;
  captureId: string | null;
  title: string | null;
  content: string;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  taskId: string;
  taskTitle?: string;
  remindAt: string;
  channel: 'IN_APP' | 'EMAIL' | 'PUSH';
  status: 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  sentAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  taskId: string | null;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}
