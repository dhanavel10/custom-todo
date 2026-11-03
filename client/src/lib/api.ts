import type { User, UserPreferences, Capture, Task, Note, Reminder, Notification } from '../types';

const BASE_URL = '/api/v1';

let authToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).code = data?.error?.code;
    throw err;
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    register: (body: { email: string; password: string; displayName?: string; timeZone?: string }) =>
      request<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    login: (body: { email: string; password: string }) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body)
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ user: User; preferences: UserPreferences }>('/auth/me')
  },

  // User Profile & Preferences
  user: {
    getMe: () => request<{ user: User; preferences: UserPreferences }>('/me'),
    updateMe: (body: Partial<User>) =>
      request<{ user: User }>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
    getPreferences: () => request<UserPreferences>('/me/preferences'),
    updatePreferences: (body: Partial<UserPreferences>) =>
      request<UserPreferences>('/me/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
    getExportUrl: () => `${BASE_URL}/me/export`
  },

  // Captures
  captures: {
    create: (text: string, inputMode = 'TEXT', autoConvert = true) =>
      request<Capture & { createdTask?: Task }>('/captures', {
        method: 'POST',
        body: JSON.stringify({ text, inputMode, autoConvert })
      }),
    list: (all = false) =>
      request<Capture[]>(`/captures?all=${all}`),
    get: (id: string) =>
      request<Capture>(`/captures/${id}`),
    convertToTask: (id: string, overrides: Partial<Task> = {}) =>
      request<Task>(`/captures/${id}/convert-to-task`, {
        method: 'POST',
        body: JSON.stringify(overrides)
      }),
    convertToNote: (id: string, overrides: Partial<Note> = {}) =>
      request<Note>(`/captures/${id}/convert-to-note`, {
        method: 'POST',
        body: JSON.stringify(overrides)
      }),
    delete: (id: string) =>
      request<void>(`/captures/${id}`, { method: 'DELETE' })
  },

  // Tasks
  tasks: {
    list: (params: Record<string, string> = {}) => {
      const q = new URLSearchParams(params).toString();
      return request<Task[]>(`/tasks${q ? `?${q}` : ''}`);
    },
    today: () => request<Task[]>('/tasks/today'),
    upcoming: () => request<Task[]>('/tasks/upcoming'),
    overdue: () => request<Task[]>('/tasks/overdue'),
    matrix: () => request<{ doFirst: Task[]; schedule: Task[]; delegate: Task[]; eliminate: Task[] }>('/tasks/matrix'),
    getAIStatus: () => request<{ connected: boolean; baseUrl: string; model: string; availableModels: string[]; error?: string }>('/tasks/ai-status'),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (task: Partial<Task>) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(task) }),
    update: (id: string, updates: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    updateStatus: (id: string, status: string) =>
      request<Task>(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    moveToQuadrant: (id: string, quadrant: string) =>
      request<Task>(`/tasks/${id}/quadrant`, { method: 'PATCH', body: JSON.stringify({ quadrant }) }),
    reanalyze: (id: string) =>
      request<Task>(`/tasks/${id}/analyze`, { method: 'POST' }),
    complete: (id: string) =>
      request<Task>(`/tasks/${id}/complete`, { method: 'POST' }),
    delete: (id: string) =>
      request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    addReminder: (taskId: string, remindAt: string, channel = 'IN_APP') =>
      request<Reminder>(`/tasks/${taskId}/reminders`, {
        method: 'POST',
        body: JSON.stringify({ remindAt, channel })
      })
  },

  // Notes
  notes: {
    list: (params: { q?: string; pinned?: boolean; archived?: boolean } = {}) => {
      const search = new URLSearchParams();
      if (params.q) search.set('q', params.q);
      if (params.pinned) search.set('pinned', 'true');
      if (params.archived !== undefined) search.set('archived', String(params.archived));
      const str = search.toString();
      return request<Note[]>(`/notes${str ? `?${str}` : ''}`);
    },
    get: (id: string) => request<Note>(`/notes/${id}`),
    create: (body: Partial<Note>) =>
      request<Note>('/notes', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Note>) =>
      request<Note>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    pin: (id: string) =>
      request<Note>(`/notes/${id}/pin`, { method: 'POST' }),
    archive: (id: string) =>
      request<Note>(`/notes/${id}/archive`, { method: 'POST' }),
    convertToTask: (id: string, overrides: Partial<Task> = {}) =>
      request<{ task: Task; originalNote: Note }>(`/notes/${id}/convert-to-task`, {
        method: 'POST',
        body: JSON.stringify(overrides)
      }),
    delete: (id: string) =>
      request<void>(`/notes/${id}`, { method: 'DELETE' })
  },

  // Reminders
  reminders: {
    list: () => request<Reminder[]>('/reminders'),
    update: (id: string, body: Partial<Reminder>) =>
      request<Reminder>(`/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/reminders/${id}`, { method: 'DELETE' }),
    triggerCheck: () =>
      request<{ message: string }>('/reminders/trigger-check', { method: 'POST' })
  },

  // Notifications
  notifications: {
    list: () =>
      request<{ notifications: Notification[]; unreadCount: number }>('/notifications'),
    markRead: (id: string) =>
      request<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () =>
      request<{ message: string }>('/notifications/read-all', { method: 'POST' })
  }
};
