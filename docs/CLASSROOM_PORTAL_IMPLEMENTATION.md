# PREPPX Classroom Portal Implementation

## What changed

- Reorganized the unified Management Portal around Dashboard, Classes, Calendar, To Review, Student Records, and Settings.
- Added classroom workspaces for Stream, Classwork, People, and Grades, with roster management, join codes, topics, announcements, classwork, live classes, review, and feedback.
- Added an authenticated Student Portal page for joining and viewing enrolled classrooms, class posts and comments, published classwork, submissions, assessments, materials, live classes, and grades.
- Updated the README with classroom setup and migration guidance.

## Existing systems reused

Classrooms reference existing published courses rather than copying course content. The implementation uses the existing student and management authentication, course enrollments, assignments and submissions, assessments and attempts, learning materials, live classes, and PostgreSQL pool. Management remains pre-provisioned; no public Management registration or student-account seeding was added.

## Database changes

`server/db/schema.sql` adds classroom, enrollment, topic, post, comment, and external-resource tables, plus nullable classroom/topic references and indexes for existing assignments, assessments, and live classes. The changes are additive and idempotent. No database was reset, and the migration was not applied during this implementation.

Before using classroom features, verify that `.env` points to the intended PostgreSQL database, back up databases with existing data, and then run `npm run db:migrate`. Do not run this against a shared or production database without the normal review and backup process.

## Verification performed

- `npm run typecheck` — passed.
- `npm run typecheck:api` — passed.
- `npm test` — passed (6 tests).
- `npm run build` — passed.
- `git diff --check` — passed.
- Browser smoke check — Management sign-in page rendered. The API was not running, so authenticated page workflows could not be exercised.

No PostgreSQL server was listening on the local default port during verification, so classroom APIs, migrations, and the complete Management-to-Student workflows were not database-tested. At the last safe configuration check, `RESEND_API_KEY` and `EMAIL_FROM` were unset/empty; no live email delivery was attempted.

## Remaining local setup

1. Configure `DATABASE_URL` for the intended local PostgreSQL database and review/back up existing data.
2. Apply the additive schema with `npm run db:migrate`.
3. Configure `RESEND_API_KEY` and `EMAIL_FROM` in the backend `.env` to enable registration and OTP email. Verify the sender domain in Resend; do not share or commit credentials.
4. Start the API with `npm run dev:api` and the frontend with `npm run dev` in separate terminals.
5. Sign in with an existing Management account, then use an existing student account to verify classroom enrollment and student access.
