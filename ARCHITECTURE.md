# PREPPX Application Architecture

## Application areas

The application has one common entry dashboard, a Student Portal, and one unified Management Portal. The shared sign-in choice is `/login`; Student and Management sign-in are separate at `/student/login` and `/management/login`. Management accounts are provisioned records: there is no public Management registration route or student-creation action in Management.

The React/TypeScript frontend is under `src/`, served by Vite. Express/TypeScript API routes are under `server/`; Vite proxies `/api` to the local API. PostgreSQL schema and the idempotent additive migration are in `server/db/`. Shared subject and course-node rules live in `shared/`.

## Authentication and authorization

- Student auth routes use server-verified credentials, email OTP challenges, and an HttpOnly student cookie. Student data endpoints require the Student role and derive the student ID from the verified token.
- Management auth uses a separate HttpOnly cookie and a pre-provisioned Management record. Management endpoints require Management authorization; state-changing API calls also enforce the configured exact-origin allowlist.
- Cookies are role-specific, use separate audiences and expirations, and are scoped to `/api`.
- The prior browser-account migration is a compatibility path; local browser data is not authoritative. Do not treat frontend route guards as security boundaries.

## Subject and learning structure

`shared/subjects.ts` is the canonical supported subject catalog: Coding, Aptitude, and Logical Reasoning. Management subject selectors and backend input schemas use the same values.

Courses contain course nodes in the supported hierarchy Subject → Unit → Topic → Lesson. Shared validation prevents invalid parent types, cross-course links, missing parents, duplicate IDs, and cycles. Management forms filter courses by subject, reset dependent selections, and show node ancestry. Materials are validated against the selected course and allowed node type.

## Student data and demo isolation

Student course activity, assignments, assessments, materials, progress, XP, live classes, and announcements are served through authenticated APIs and backed by PostgreSQL. XP awards use unique activity keys to prevent duplicate rewards.

The Learning Journey presentation preview is opt-in. Sample progress is stored only under `preppx.learning-journey-demo.v1`; it is not read from or written to student accounts or server XP. Resetting the preview restores the local demo baseline. It does not seed the production database.

Content that has not been published remains an empty state; never add fake student accounts or production content to make a screen appear populated. Optional email delivery and private S3-compatible storage fail with explicit configuration errors when unavailable.

## Development and validation

Set local values using `.env.example` without committing `.env`. Run the API with `npm run dev:api` and the frontend with `npm run dev`. `npm run db:migrate` applies the idempotent schema; `npm run db:bootstrap` can create or update the provisioned Management login and must not be run casually against an existing account.

Available checks are `npm run typecheck`, `npm run typecheck:api`, `npm test`, and `npm run build`. The automated tests currently cover shared subject and course-node rules; they do not replace authenticated workflow testing.

## Known limitations

The practice/resource modules that lack published content can remain empty. Resend and S3 integrations need their own configured credentials for end-to-end verification. Full Management and Student authenticated browser journeys, all form operations, and cross-subject persistence require authorized test records and are not represented by the focused unit tests.
