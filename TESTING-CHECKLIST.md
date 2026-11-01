# PREPPX Testing Checklist

## Automated local checks

Run from the project root:

```powershell
npm run typecheck
npm run typecheck:api
npm test
npm run build
```

The current automated tests validate the canonical supported subjects, valid course hierarchy, and invalid parent/cross-course/cycle cases. They are not a substitute for authenticated API or browser integration tests.

## Local service checks

- Start PostgreSQL and the API with `npm run dev:api`; confirm `GET /api/health` reports a connected database.
- Start the frontend with `npm run dev`; confirm the common page loads at `/`.
- Confirm `/login` presents Student Login and Management Login, and does not expose Management registration.
- Without credentials, confirm `/api/management/*` and `/api/student/*` protected resources return `401`.
- Do not print or copy `.env` values. Do not reset the database or run the Management bootstrap during routine tests.

## Authorized Student workflow

With an existing authorized test account and configured email delivery:

- Exercise registration, email verification, login, password recovery, session restoration, profile update, and logout.
- Confirm protected routes redirect anonymous users and that one Student cannot read another Student's records.
- Exercise course selection, lessons, material access, assignment submission, assessments, announcements, live classes, and progress.
- Refresh the browser and verify persisted values are read back from PostgreSQL.

## Authorized Management workflow

With an existing provisioned Management account:

- Verify course counts and student directory search, sort, exact pagination, profile inspection, and permitted profile updates.
- For each supported subject, verify Subject → Course → Unit → Topic → Lesson choices and persistence. Change subject/course mid-selection and verify dependent values clear.
- Test empty courses, missing lessons, archived courses, and invalid cross-course node IDs without seeding unrelated production data.
- Verify material, assignment, assessment, class, announcement, and course operations; check loading, empty, validation, and error states.
- Confirm a Student token cannot access Management APIs and that Management has no account-registration workflow.

## Optional integrations and safe test data

- Email verification requires configured Resend credentials and a verified sender.
- Upload and download verification requires configured private S3-compatible storage.
- Use existing authorized records where possible. Any temporary test records must be explicitly approved, isolated, and removed through normal application operations; never create fake registered students or overwrite real progress.
- Authenticated workflows and external service integrations were not run as part of the current code audit.

## Responsive and accessibility checks

- Verify common, Student, and Management pages at desktop, tablet, and narrow mobile widths.
- Check for horizontal overflow, clipped dropdowns/tables, keyboard-operable controls, visible focus, associated form labels, and reduced-motion behavior.
- Confirm all visible actions have an outcome and failures are surfaced rather than presented as success.
