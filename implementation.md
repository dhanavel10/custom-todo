# Personal Productivity Inbox --- Implementation Plan

## 1. Product Overview

Build a personal productivity application that makes capturing tasks and
creative ideas nearly effortless.

The core product principle is:

> Capture first. Organize later.

Traditional task managers often create friction: users must open the
app, navigate to a form, enter a title, choose a date, set a priority,
select a category, and save. This application should let users record an
item in seconds, even when they have no time or motivation to organize
it.

The application has two primary kinds of information:

-   **Tasks:** actionable items, optionally with deadlines, reminders,
    priority, and status.
-   **Ideas/Notes:** free-form thoughts and creative writing that should
    be saved immediately without requiring task metadata.

A universal **Inbox** accepts unstructured captures. Users can organize
items later, but organization must never be required for saving.

## 2. Goals and Non-Goals

### Goals

1.  Capture a task in one short interaction.
2.  Accept incomplete task details; title-only tasks are valid.
3.  Parse natural-language dates and deadlines where possible.
4.  Capture ideas in a distraction-free editor with automatic saving.
5.  Surface tasks that are due, overdue, or important.
6.  Provide useful reminders without overwhelming the user.
7.  Work across web and mobile-sized screens.
8.  Keep data private, backed up, and exportable.

### Non-Goals for the MVP

-   Team task assignment and collaboration.
-   Complex project management, dependencies, and Gantt charts.
-   Public social feeds or sharing of private notes.
-   A general-purpose AI chatbot.
-   Automatic reading of private messages or emails.
-   Mandatory AI categorization.

## 3. Target User Experience

### 3.1 Quick Capture

The primary action on every major screen is a single capture field.

Example inputs:

-   `Finish project report by November 5`
-   `Call the dentist tomorrow at 10am`
-   `Prepare slides next Friday`
-   `Ask Ravi about the API`
-   `Idea: build a tool that turns voice notes into tasks`

Expected behavior:

1.  User enters text or dictates it.
2.  The frontend submits the raw text immediately.
3.  The backend creates a capture record even if parsing fails.
4.  The backend optionally detects an item type, deadline, and reminder
    suggestion.
5.  The user sees a clear saved confirmation.
6.  The user can edit the interpreted details later.

**Important:** parsing must never be a prerequisite for saving. Preserve
the original text so that a failed or incorrect interpretation can be
corrected.

### 3.2 Universal Inbox

The Inbox stores new or unprocessed captures. It can contain tasks,
ideas, and unclassified text.

Users can later:

-   Convert an inbox item into a task.
-   Convert it into an idea/note.
-   Edit the title and details.
-   Add a deadline or reminder.
-   Archive or delete it.

### 3.3 Task Management

Task fields:

-   Title (required, but may be short).
-   Description (optional).
-   Status: `INBOX`, `TODO`, `IN_PROGRESS`, `COMPLETED`, `ARCHIVED`.
-   Due date/time (optional).
-   Time zone (required when a due time is set).
-   Priority: `LOW`, `MEDIUM`, `HIGH`, `URGENT` (optional; default
    `MEDIUM` only after the user chooses to organize it).
-   Reminder settings (optional).
-   Created and updated timestamps.
-   Source capture text (optional, retained for traceability).

Task views:

-   Today
-   Upcoming
-   Inbox
-   All tasks
-   Completed
-   Overdue

### 3.4 Idea Pad

The Idea Pad is a lightweight writing space, not a task form.

Requirements:

-   Create a note with no required title.
-   Autosave content.
-   Support plain text and Markdown in the MVP.
-   Allow title, tags, pinning, and archive as optional metadata.
-   Search note titles and content.
-   Convert a note into a task without losing the original note.
-   Show a saved/saving/error state.

Autosave should be debounced on the frontend (for example, 600--1000 ms
after typing stops), with a final save when the editor loses focus. Use
optimistic UI carefully and show an error if persistence fails.

### 3.5 Reminders and Daily Review

Reminder types:

-   At the due time.
-   A configurable lead time before the due time.
-   A user-selected custom date/time.

Daily review:

-   Morning summary of today's tasks and overdue tasks.
-   Evening review of incomplete tasks.
-   User-configurable enablement and delivery time.

Notifications should be configurable and rate-limited. Avoid repeatedly
notifying the user about the same overdue task.

## 4. Suggested Technology Stack

### Backend

-   Java 21
-   Spring Boot 3.x
-   Spring Web
-   Spring Data JPA
-   Spring Security
-   Bean Validation
-   PostgreSQL
-   Flyway for database migrations
-   Spring Boot Actuator
-   Spring Scheduler for MVP reminder polling
-   Testcontainers for integration tests
-   JUnit 5 and Mockito

Optional later: - Redis for distributed scheduling, caching, and rate
limiting. - A queue such as RabbitMQ or Kafka if notification volume or
asynchronous processing grows. - An AI provider integration for optional
extraction and classification. Keep it behind an interface so the
application is not coupled to one provider.

### Frontend

-   React with TypeScript
-   Vite
-   React Router
-   TanStack Query for server state
-   React Hook Form and Zod for forms and validation
-   A component system such as shadcn/ui with Tailwind CSS
-   Browser Notifications API, subject to permission
-   A PWA manifest and service worker for installability and basic
    offline capture

### Infrastructure

-   PostgreSQL database
-   Docker Compose for local development
-   Backend and frontend deployed independently or behind a reverse
    proxy
-   HTTPS in production
-   Automated database backups
-   Centralized application logs and health checks

Pin exact dependency versions in the generated project and update them
deliberately rather than using floating versions.

## 5. High-Level Architecture

``` text
React + TypeScript (Browser / PWA)
          |
          | HTTPS / JSON REST API
          v
Spring Boot Application
  ├── Authentication & User Profile
  ├── Capture / Inbox Service
  ├── Task Service
  ├── Idea / Note Service
  ├── Date Parsing Service
  ├── Reminder Service
  ├── Search Service
  └── Notification Service
          |
          v
      PostgreSQL
          |
          └── Scheduled reminder polling
                    |
                    v
             Notification adapter
             (in-app / email / push)
```

Use a modular monolith for the first release. Separate services by
package and interface, but do not introduce microservices before there
is a concrete scaling need.

## 6. Backend Design

Suggested package structure:

``` text
com.example.productivity
├── config
├── security
├── auth
├── user
├── capture
├── task
├── note
├── reminder
├── notification
├── search
├── common
│   ├── exception
│   ├── response
│   └── audit
└── ProductivityApplication.java
```

### 6.1 Domain Entities

#### User

  Field          Type          Notes
  -------------- ------------- --------------------------------
  id             UUID          Primary key
  email          varchar       Unique, normalized
  passwordHash   varchar       Never store plaintext
  displayName    varchar       Optional
  timeZone       varchar       IANA zone, e.g. `Asia/Kolkata`
  createdAt      timestamptz   UTC
  updatedAt      timestamptz   UTC

#### Capture

  -----------------------------------------------------------------------
  Field                   Type                    Notes
  ----------------------- ----------------------- -----------------------
  id                      UUID                    Primary key

  userId                  UUID                    Owner

  rawText                 text                    Original capture;
                                                  required

  detectedType            enum                    `TASK`, `NOTE`,
                                                  `UNKNOWN`

  parsedTitle             varchar                 Nullable

  parsedDueAt             timestamptz             Nullable

  parseStatus             enum                    `NOT_PROCESSED`,
                                                  `PROCESSED`,
                                                  `NEEDS_REVIEW`,
                                                  `FAILED`

  convertedEntityType     enum                    Nullable

  convertedEntityId       UUID                    Nullable

  createdAt               timestamptz             UTC
  -----------------------------------------------------------------------

#### Task

  Field         Type           Notes
  ------------- -------------- ---------------------------------
  id            UUID           Primary key
  userId        UUID           Owner
  captureId     UUID           Nullable source capture
  title         varchar(300)   Required
  description   text           Nullable
  status        enum           See task statuses
  priority      enum           Nullable
  dueAt         timestamptz    Nullable
  dueTimeZone   varchar        Nullable unless due time exists
  completedAt   timestamptz    Nullable
  createdAt     timestamptz    UTC
  updatedAt     timestamptz    UTC
  archivedAt    timestamptz    Nullable

#### Note

  Field        Type           Notes
  ------------ -------------- ------------------------
  id           UUID           Primary key
  userId       UUID           Owner
  title        varchar(300)   Nullable
  content      text           May be empty initially
  isPinned     boolean        Default false
  isArchived   boolean        Default false
  createdAt    timestamptz    UTC
  updatedAt    timestamptz    UTC

#### Reminder

  Field       Type          Notes
  ----------- ------------- ------------------------------------------
  id          UUID          Primary key
  userId      UUID          Owner
  taskId      UUID          Related task
  remindAt    timestamptz   UTC
  channel     enum          `IN_APP`, `EMAIL`, `PUSH`
  status      enum          `PENDING`, `SENT`, `CANCELLED`, `FAILED`
  sentAt      timestamptz   Nullable
  createdAt   timestamptz   UTC

#### Notification

  Field       Type          Notes
  ----------- ------------- ---------------
  id          UUID          Primary key
  userId      UUID          Owner
  taskId      UUID          Nullable
  title       varchar       Display title
  body        text          Display body
  readAt      timestamptz   Nullable
  createdAt   timestamptz   UTC

Use UUIDs for externally visible entity identifiers. Every query and
mutation must be scoped to the authenticated user. Never trust a
`userId` supplied by the browser.

### 6.2 Database Rules and Indexes

-   Use foreign keys and appropriate delete behavior.
-   Index `(user_id, status, due_at)` on tasks.
-   Index `(user_id, created_at)` on captures and notes.
-   Index `(status, remind_at)` on reminders.
-   Index note/task searchable text using PostgreSQL full-text search
    when needed.
-   Store timestamps in UTC; retain the user's IANA time zone for
    interpreting local dates and displaying times.
-   Use Flyway migrations; do not rely on Hibernate schema auto-update
    in production.

### 6.3 REST API

Base path: `/api/v1`

#### Capture

  Method   Endpoint                           Purpose
  -------- ---------------------------------- ---------------------------
  POST     `/captures`                        Save raw text immediately
  GET      `/captures`                        List inbox captures
  GET      `/captures/{id}`                   Get capture details
  POST     `/captures/{id}/convert-to-task`   Convert capture to task
  POST     `/captures/{id}/convert-to-note`   Convert capture to note
  DELETE   `/captures/{id}`                   Delete capture

Example request:

``` json
{
  "text": "Finish project report by November 5",
  "inputMode": "TEXT"
}
```

Example response:

``` json
{
  "id": "c7f4d0a0-4e10-4c5b-8f20-5c1f6d5b6a11",
  "rawText": "Finish project report by November 5",
  "detectedType": "TASK",
  "suggestedTitle": "Finish project report",
  "suggestedDueAt": null,
  "parseStatus": "NEEDS_REVIEW",
  "createdAt": "2026-10-31T18:15:00Z"
}
```

The example deliberately leaves the date unresolved because a date
without a year can be ambiguous. The UI should ask for confirmation
rather than silently choosing a potentially incorrect date.

#### Tasks

  Method   Endpoint                 Purpose
  -------- ------------------------ -------------------------
  POST     `/tasks`                 Create task
  GET      `/tasks`                 List tasks with filters
  GET      `/tasks/{id}`            Get task
  PATCH    `/tasks/{id}`            Update task
  PATCH    `/tasks/{id}/status`     Change status
  POST     `/tasks/{id}/complete`   Complete task
  DELETE   `/tasks/{id}`            Delete task
  GET      `/tasks/today`           Today's tasks
  GET      `/tasks/upcoming`        Upcoming tasks
  GET      `/tasks/overdue`         Overdue tasks

Useful list query parameters:

-   `status`
-   `priority`
-   `from`
-   `to`
-   `q`
-   `page`
-   `size`
-   `sort`

#### Notes

  Method   Endpoint                        Purpose
  -------- ------------------------------- -----------------------------------
  POST     `/notes`                        Create an empty or populated note
  GET      `/notes`                        List notes
  GET      `/notes/{id}`                   Get note
  PATCH    `/notes/{id}`                   Autosave/update note
  POST     `/notes/{id}/pin`               Pin/unpin note
  POST     `/notes/{id}/archive`           Archive note
  POST     `/notes/{id}/convert-to-task`   Create task from note
  DELETE   `/notes/{id}`                   Delete note

#### Reminders and Notifications

  Method   Endpoint                     Purpose
  -------- ---------------------------- ------------------------
  POST     `/tasks/{id}/reminders`      Add reminder
  GET      `/reminders`                 List reminders
  PATCH    `/reminders/{id}`            Update reminder
  DELETE   `/reminders/{id}`            Cancel reminder
  GET      `/notifications`             List notifications
  POST     `/notifications/{id}/read`   Mark notification read
  POST     `/notifications/read-all`    Mark all read

#### User Preferences

  -----------------------------------------------------------------------
  Method                  Endpoint                Purpose
  ----------------------- ----------------------- -----------------------
  GET                     `/me`                   Current user profile

  PATCH                   `/me`                   Update profile and time
                                                  zone

  GET                     `/me/preferences`       Read preferences

  PATCH                   `/me/preferences`       Update reminders and
                                                  daily review settings
  -----------------------------------------------------------------------

### 6.4 API Response and Error Conventions

Use consistent JSON responses and standard HTTP status codes.

-   `201 Created` for successful creation.
-   `200 OK` for reads and updates.
-   `204 No Content` for successful deletion where appropriate.
-   `400 Bad Request` for invalid input.
-   `401 Unauthorized` for unauthenticated requests.
-   `403 Forbidden` for unauthorized access.
-   `404 Not Found` when an entity does not exist or is not owned by the
    user.
-   `409 Conflict` for conflicting state changes.
-   `429 Too Many Requests` for rate limits.

Use a global exception handler (`@RestControllerAdvice`) and return a
stable error structure with a machine-readable code, human-readable
message, and optional field errors. Do not leak stack traces or internal
details.

## 7. Natural-Language Date Parsing

Implement a dedicated interface:

``` java
public interface CaptureParser {
    ParsedCapture parse(String rawText, ZoneId userZone, LocalDate referenceDate);
}
```

The parser should return:

-   Suggested item type.
-   Suggested title.
-   Optional due date/time.
-   Whether the date is ambiguous.
-   Confidence or review requirement.
-   Optional reminder suggestion.

Implementation strategy:

1.  Save the raw capture first.
2.  Parse asynchronously or immediately after persistence.
3.  Use a deterministic date parser for common phrases.
4.  Add an optional AI-backed parser later behind the same interface.
5.  Never overwrite raw text.
6.  Never silently turn ambiguous dates into confirmed deadlines.
7.  Let the user accept, edit, or reject suggestions.

Examples to support:

-   `today`
-   `tomorrow`
-   `next Monday`
-   `in 3 days`
-   `November 5`
-   `November 5 at 3pm`
-   `by end of week`

Always parse relative dates using the user's configured time zone and a
known reference date. Test year boundaries, daylight-saving transitions,
locale differences, and ambiguous expressions. A date-only deadline
should be represented consistently as a local date or as a clearly
defined end-of-day instant; do not accidentally interpret it as midnight
UTC.

## 8. Reminder Processing

For the MVP, use a scheduled Spring service that polls pending reminders
at a short interval.

Pseudo-flow:

1.  Find pending reminders where `remindAt <= now`.
2.  Lock or claim each reminder safely to avoid duplicate processing.
3.  Check that the task is not completed or archived.
4.  Create an in-app notification.
5.  Send optional email or push notification through an adapter.
6.  Mark the reminder sent only after successful processing.
7.  Retry transient failures with bounded backoff.
8.  Record failures for inspection.

Use a database transaction and a safe claiming strategy. If multiple
application instances run, use row locking or a job-locking mechanism.
Do not assume an in-memory scheduler is sufficient for multi-instance
production deployments.

Browser notifications require permission and are not a reliable
replacement for server-side reminders. For dependable mobile push
notifications, add a push provider and service worker in a later phase.

## 9. Frontend Design

Suggested structure:

``` text
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── queryClient.ts
├── components/
│   ├── QuickCapture/
│   ├── TaskItem/
│   ├── TaskEditor/
│   ├── NoteEditor/
│   ├── ReminderPicker/
│   ├── AppShell/
│   └── EmptyState/
├── features/
│   ├── inbox/
│   ├── tasks/
│   ├── notes/
│   ├── reminders/
│   ├── notifications/
│   └── settings/
├── hooks/
├── lib/
│   ├── api.ts
│   ├── date.ts
│   └── validation.ts
├── types/
└── main.tsx
```

### 9.1 Main Navigation

-   Home / Today
-   Inbox
-   Upcoming
-   All Tasks
-   Idea Pad
-   Completed
-   Settings

On mobile, use a compact bottom navigation and keep Quick Capture
visible and easy to reach. On desktop, use a sidebar and a prominent
capture field.

### 9.2 Quick Capture Component

Requirements:

-   Visible on Home and accessible from all main views.
-   Keyboard shortcut on desktop (for example, `Ctrl/Cmd + K`).
-   Enter submits; Shift+Enter adds a newline if multiline capture is
    supported.
-   Voice input can be added through browser speech recognition where
    supported, with a typed fallback.
-   Show a clear saving/saved/error state.
-   Clear the field only after the server confirms the capture was
    saved.
-   Avoid opening a large modal for the common capture path.

### 9.3 Task List

Each task row should show:

-   Completion control.
-   Task title.
-   Due date or "No deadline".
-   Priority indicator only when set.
-   Overdue state.
-   Quick actions: edit, snooze, complete.

Do not require users to assign a priority or category before saving.

### 9.4 Idea Editor

-   Open a new blank note immediately.
-   Autosave with debounce.
-   Provide a visible save state.
-   Keep the editor uncluttered.
-   Support Markdown preview or a lightweight formatting toolbar.
-   Warn before navigating away only if unsaved changes remain after a
    failed save.

### 9.5 Accessibility and Responsive Behavior

-   Fully keyboard navigable.
-   Visible focus states.
-   Semantic buttons and labels.
-   Sufficient contrast.
-   Screen-reader-friendly task status and due-date labels.
-   Touch targets sized appropriately for mobile.
-   Responsive layouts for phone, tablet, and desktop.

## 10. Security, Privacy, and Reliability

-   Use Spring Security.
-   For a first-party browser app, prefer secure, HttpOnly, SameSite
    cookies for session or refresh-token handling where feasible. If
    using bearer tokens, keep the threat model and storage strategy
    explicit; avoid long-lived tokens in localStorage.
-   Hash passwords using BCrypt or Argon2.
-   Enforce ownership checks on every entity read, update, and delete.
-   Validate request payloads with Bean Validation.
-   Add CSRF protection when using cookie-based authentication.
-   Configure CORS narrowly for known frontend origins.
-   Apply rate limits to authentication and capture endpoints.
-   Use HTTPS in production.
-   Avoid logging note contents, passwords, tokens, or sensitive user
    text.
-   Provide account data export and deletion.
-   Back up PostgreSQL and test restore procedures.
-   Keep secrets in environment variables or a secrets manager.

## 11. Testing Strategy

### Backend Unit Tests

-   Capture creation succeeds with only raw text.
-   Parser handles supported date phrases.
-   Ambiguous dates require review.
-   Date parsing respects user time zone.
-   Task status transitions behave correctly.
-   Completed tasks do not trigger reminders.
-   User A cannot access User B's tasks, captures, notes, or reminders.

### Backend Integration Tests

-   REST endpoint validation and response codes.
-   Database persistence and Flyway migrations.
-   Ownership enforcement.
-   Reminder polling and duplicate prevention.
-   Note autosave update behavior.
-   Search and pagination.

Use Testcontainers with PostgreSQL for integration tests.

### Frontend Tests

-   Quick Capture submits and clears only after success.
-   Capture text remains visible after API failure.
-   Date suggestions can be accepted or edited.
-   Task completion updates the list.
-   Note autosave shows saving, saved, and error states.
-   Mobile navigation and keyboard interactions work.

Use Vitest and React Testing Library; add Playwright for end-to-end
critical flows.

### Critical End-to-End Scenarios

1.  Capture `Call Ravi` and verify it appears in Inbox.
2.  Capture a task with an unambiguous deadline and verify the suggested
    date.
3.  Capture an ambiguous date and verify that confirmation is requested.
4.  Create a blank idea note, type content, refresh, and verify it
    persists.
5.  Convert an idea into a task without losing the note.
6.  Set a reminder and verify one notification is generated.
7.  Complete a task and verify its pending reminders are cancelled or
    ignored.
8.  Attempt cross-user access and verify it is denied.

## 12. Delivery Plan

### Milestone 1 --- Project Foundation

-   Create Spring Boot and React TypeScript projects.
-   Configure PostgreSQL and Docker Compose.
-   Add Flyway migrations.
-   Add health endpoint and environment-based configuration.
-   Establish API error conventions and frontend API client.

**Acceptance:** Both applications run locally and the frontend can call
the backend.

### Milestone 2 --- Authentication and User Data

-   Registration, login, logout.
-   Current-user endpoint.
-   User profile and time-zone preference.
-   Ownership checks.

**Acceptance:** A user can securely sign in and only access their own
data.

### Milestone 3 --- Capture and Inbox

-   Quick Capture UI.
-   Capture API and database model.
-   Inbox list and conversion actions.
-   Save confirmation and error recovery.

**Acceptance:** A user can save a capture in one interaction without
supplying metadata.

### Milestone 4 --- Tasks and Deadlines

-   Task CRUD and status management.
-   Today, Upcoming, Overdue, and All Tasks views.
-   Natural-language parser interface and initial deterministic
    implementation.
-   Date confirmation/editing UI.

**Acceptance:** Tasks can be captured, reviewed, edited, completed, and
filtered by due date.

### Milestone 5 --- Idea Pad

-   Notes API and editor.
-   Debounced autosave.
-   Search, pin, archive.
-   Convert note to task.

**Acceptance:** A user can open a blank note, write immediately, and
trust that it is saved.

### Milestone 6 --- Reminders and Notifications

-   Reminder CRUD.
-   Scheduled reminder processing.
-   In-app notification center.
-   User notification preferences.

**Acceptance:** Due reminders create one in-app notification and
completed tasks are not reminded.

### Milestone 7 --- Polish and Release

-   Responsive/PWA support.
-   Accessibility review.
-   Security review.
-   Automated tests and CI.
-   Production deployment, monitoring, backups, and restore test.

**Acceptance:** Critical user journeys pass on desktop and mobile-sized
screens.

## 13. MVP Definition of Done

The MVP is ready when:

-   A user can register and sign in.
-   A user can capture a task with only a few words.
-   Captures are saved before parsing or categorization.
-   The Inbox preserves unprocessed captures.
-   A task can have an optional deadline and status.
-   A user can create and edit a note without a title.
-   Notes autosave and survive refresh.
-   Today, Upcoming, Inbox, and Idea Pad views work.
-   Reminders generate in-app notifications.
-   All user data is isolated by account.
-   Core flows have automated tests.
-   The application is responsive and usable by keyboard.
-   Database backups and a restore procedure are documented.

## 14. Product Principles to Preserve

1.  **Capture must be faster than organizing.**
2.  **Never lose raw input because parsing failed.**
3.  **No required category, priority, or deadline during capture.**
4.  **Tasks and ideas are different kinds of information.**
5.  **Autosave should be visible and trustworthy.**
6.  **Reminders should be helpful, configurable, and restrained.**
7.  **The app should reduce cognitive load, not create another
    maintenance chore.**

## 15. Recommended First Build

Implement the first vertical slice before expanding the scope:

1.  Start the Spring Boot backend and PostgreSQL.
2.  Build `POST /api/v1/captures`.
3.  Build the React Quick Capture field.
4.  Persist and display captures in the Inbox.
5.  Add conversion from a capture to a task.
6.  Add the Idea Pad with autosave.

This proves the central promise of the product---getting information out
of the user's head with almost no friction---before investing in
advanced AI, analytics, or integrations.
