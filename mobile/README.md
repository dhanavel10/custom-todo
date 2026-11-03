# Intelligent Todo & Eisenhower Matrix — Flutter Mobile App

A minimalist Flutter mobile application built for personal productivity, natural language quick-capture, AI-assisted Eisenhower matrix task classification, and day-wise schedule planning.

---

## 🎨 Minimalist Theme & Color Palette

Designed specifically in compliance with the minimalist UI specifications:

* **Primary (`#4F46E5`)**: Active tabs, buttons, checkboxes, progress indicators, and Schedule quadrant.
* **Background (`#EEF2FF`)**: Clean, distraction-free soft backdrop.
* **Surface (`#FFFFFF`)**: Pure white cards, bottom sheets, navigation bar, and dialogs.
* **Heading (`#1E1B4B`)**: High-contrast typography for page titles, headers, and task names.
* **Accent (`#06B6D4`)**: AI analysis badges, lightning indicators, and Delegate quadrant.

---

## 📱 Features

1. **Eisenhower Matrix**:
   * 4 Quadrants: **Do First** (Q1), **Schedule** (Q2), **Delegate** (Q3), and **Eliminate** (Q4).
   * Task completion checkboxes with instant strike-through.
   * Move tasks between quadrants via context actions.
   * Quick Add task directly inside any quadrant.
   * View AI classification reasoning and models.

2. **Day Planner**:
   * 7-day horizontal date ribbon with active day selection and indicator dots.
   * Daily progress bar (e.g. `3 of 5 tasks done - 60%`).
   * Time blocks: Morning (before 12 PM), Afternoon (12 PM – 5 PM), Evening / Scheduled.
   * Day-specific task scheduling.

3. **Quick Capture with AI**:
   * Natural language task capture modal sheet (accessible via FAB).
   * Automatically parses dates, deadlines, urgency tags, and auto-converts to an AI-classified task via the backend's Ollama engine.

4. **Inbox & All Tasks**:
   * Search filter with instant query matching.
   * Filter chips: All Tasks, Pending, Today, and Completed.

5. **Scratchpad & Notes**:
   * Minimalist note editor with title and multi-line body.
   * Delete and review notes.

6. **Notifications & Reminders**:
   * Slide-up notification drawer showing due reminders and alerts.
   * One-tap mark as read.

7. **Configurable Connectivity**:
   * In-app settings dialog (`Settings` icon in AppBar) to configure the backend API URL:
     * **Android Emulator**: `http://10.0.2.2:3001`
     * **Desktop / iOS Simulator**: `http://127.0.0.1:3001`
     * **Physical Phone**: `http://<YOUR_PC_IP>:3001` (e.g., `http://192.168.1.100:3001`)

---

## 🚀 Running the Mobile App

### 1. Ensure the Backend Server is Running
```bash
# In the project root
npm run server
# Verified listening on port 3001
```

### 2. Run on Android or iOS
```bash
cd mobile
flutter run
```

### 3. Run on Windows Desktop or Chrome for testing
```bash
cd mobile
flutter run -d windows
# or
flutter run -d chrome
```

### 4. Running Analysis & Tests
```bash
cd mobile
flutter analyze
flutter test
```
