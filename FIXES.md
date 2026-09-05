# Bug-fix round — what was found and what changed

## How to run

```bash
# backend
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python migrate_fixes.py        # existing DB only — adds chat columns, backfills enrolments
# (fresh DB instead: python create_tables.py && python seed_data.py)
uvicorn app.main:app --reload

# frontend
cd frontend && npm install && npm run dev
```

`platform.db.pre-migration.bak` is the untouched original database.

---

## The four reported bugs

### 1. Batch registration was optional
`courseId`/`batchId` were `Optional[str] = None` in all three paths, and the frontend
selects submit `""` (not `null`) when nothing is chosen — which satisfied `Optional[str]`
silently. There was also no existence check anywhere: `uuid.UUID(payload.batchId)` went
straight into a FK column, so any well-formed UUID was accepted.

- `schemas/registration.py` — `courseId`/`batchId` now required on
  `StudentRegisterByStaffRequest` and `CreateInviteRequest`, with a validator that rejects
  blanks and malformed UUIDs (422 instead of a 500 from `uuid.UUID()` deeper down).
- `services/registration_service.py` — new `_validate_course_and_batch()` checks both rows
  exist **and** that the batch belongs to the course. It calls the already-present but
  never-used `reg_repo.get_course()` / `get_batch()`.
- Bulk upload now requires `course_id` + `batch_id` columns and validates per row, so one
  bad row is reported against that row instead of corrupting the job.
- Frontend: both selects marked required, batch disabled until a course is picked, and the
  batch selection is reset when the course changes so a mismatched pair can't be submitted.

### 2. Announcement delivery was dead code
`students_for_batches()` existed but was never called; `broadcast()` wrote
`announcements` + `announcement_batches` rows and returned.

`AnnouncementService.broadcast()` now resolves recipients (enrolled students **plus** the
staff on those batches, minus the author) and writes real `notifications` +
`notification_recipients` rows through the existing `NotificationRepo`, then runs the
existing `_dispatch()` for email/sms channels.

`faculty_for_batches()` reads staff from **both** places a batch can carry them:
the denormalised `Batch.faculty_id` / `Batch.trainer_id` columns *and* the `BatchFaculty`
join table.

The response now includes `recipientCount`, and the UI says so — an announcement to an
empty batch reports "nobody was notified" instead of looking successful.

### 3. Two disconnected messaging systems
Both now write to the same `notifications` / `notification_recipients` tables the student
dashboard widget already reads.

- `POST /api/v1/announcements` — opened from faculty/trainer to all staff roles.
- `POST /api/v1/notifications/broadcast` — opened from Super Admin/Admin to all staff, and
  gained `batchIds` targeting alongside the existing role targeting.
- `NotificationRepo.resolve_target_users()` takes `target_batches` and normalises role
  strings ("Super Admin" → "super_admin"), since the frontend sends mixed casing.
- Rejects a broadcast that resolves to zero recipients (400) rather than silently no-oping.
- Admin Notification Management page gained batch-selection chips.

### 4. Faculty↔student chat cross-contamination
Worse than reported: `chat_history` also backs the AI Assistant (`ai_repo.log_chat`), so
`user_id IN [faculty_id, student_id]` returned other students' messages **and both parties'
private AI-assistant conversations**. Verified: the old filter returned 5 rows where 2 were
correct.

`ChatHistory` gained `faculty_id` + `student_id`. A thread is now keyed on that pair;
`user_id` means "sender". AI-assistant rows leave both NULL and are therefore excluded.
Added a student-side send/read endpoint (the thread was previously one-directional) and
sender attribution (`senderId`, `sentByStudent`) so the UI can tell who wrote what.

---

## Found during the audit

### 5. Registration never enrolled anyone into `batch_students` — CRITICAL
All three registration paths set `student_profiles.batch_id` but never created the
`BatchStudent` row. Every batch-scoped feature reads `batch_students`: faculty rosters,
attendance, performance, reports, and announcement delivery. Confirmed in the shipped DB —
`mahi nakhate` had `student_profiles.batch_id` set and zero `batch_students` rows.

**This sits upstream of bugs 1–3: fixing announcement delivery alone would still have
delivered to nobody.** Added `BatchRepository.enroll_student()` (idempotent), called from
all three registration paths, plus a backfill in `migrate_fixes.py`.

### 6. Student dashboard would 500 on the first notification — CRITICAL
`student_schemas.NotificationOut` requires `is_read: bool`, but
`get_recent_notifications()` returned `Notification` ORM rows — `is_read` lives on
`NotificationRecipient`, and the schema's `link` field has no column at all. It only
appeared to work because the table was empty. Fixing bugs 2/3 would have broken the exact
widget they were meant to feed. The repository now returns dicts carrying `is_read` and
`recipient_id` (so the UI can mark-as-read).

### 7. `PATCH /admin/users/{id}/role` → 405
`services/adminUsersApi.ts` used PATCH; backend only had PUT. Route now registered under
both verbs.

### 8. Two clients, two contracts on `GET /admin/users`
`services/adminUsersApi.ts` expected `{total, items}`; `api/adminPlatformApi.ts` expected a
bare array; backend returned an array without `isActive` (which the access toggle needs).
The envelope is now canonical, `UserOut` carries `isActive`, the endpoint supports
`search`, and the array-consuming client unwraps `.items`.

### 9. `fetchClient.ts` had no `patch` method — added.

### 10. `BatchService.create_batch` → IntegrityError 500
An unresolvable course name passed `course_id=None` into a `NOT NULL` column. Now a 400.

### 11. Batch analytics excluded zero-attempt students
`weakStudents` was built only from students who had results, so a student with no attempts
— arguably the weakest — never appeared. Rows are now built for every enrolled student;
the average still only counts students who attempted something; top/weak lists no longer
overlap in small batches.

### 12. `notification_recipients.delivered` was never set to `True` — fixed.

### 13. Unguarded `uuid.UUID()` on query/form params
`GET /registration/batches?course_id=…` and `POST /registration/batches` returned 500 on
malformed input; now 422, and batch creation verifies the course exists.

### SQLite-specific
No new UUID issues. The earlier `core/db_types.GUID` fix (dashed `CHAR(36)` on SQLite,
native UUID on Postgres) is correct and consistent; `migrate_fixes.py` uses the same
`CHAR(36)` format for the new columns so they join against `users.id`.

---

## Verification

`pip install` / `npm install` can't reach the network in the environment these fixes were
made in, so the servers were not booted. Instead:

- All backend Python compiles (`compileall`).
- Routes re-extracted from the AST and re-matched against every frontend call.
- The core fixed logic was replayed as raw SQL against a copy of the real `platform.db`:
  batch recipient resolution, staff resolution from both sources, exclusion of other
  batches and of the author, dashboard visibility, the `delivered` flag, and chat thread
  isolation (old filter 5 rows → new filter exactly the 2 correct ones, with the other
  student's message and both AI histories excluded). All assertions passed.
- `migrate_fixes.py` was run against the real DB and re-run to confirm idempotency; it
  backfilled the one orphaned enrolment.

**Still worth doing once you can run it:** a real boot + click-through, and a student-side
chat UI page — the backend endpoints for student→faculty replies now exist but no frontend
page consumes them yet.
