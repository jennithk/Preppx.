# PREPPX

PREPPX is a student learning and management platform with a shared entry dashboard, a Student Portal, and one unified Management Portal.

## Overview

The application provides separate sign-in paths for students and pre-provisioned management users. Students can access their learning workspace and recorded course activity. Authorized management users can administer supported learning content and review student progress. The frontend is served by Vite; its API requests are proxied to the Express server, which persists application data in PostgreSQL.

## Core application areas

### Common Entry Dashboard

- Landing page and common login entry.
- Account selection with separate Student and Management sign-in paths.

### Student Portal

- Server-backed registration, email verification, login, session restoration, and password recovery.
- Student dashboard, profile, published courses, course learning sequence, and learning materials.
- Assignment and assessment workflows, including supported submissions and assessment results/review status.
- Live-class listings, announcements, learning activity, progress, and XP.
- A clearly isolated Learning Journey presentation demo with local sample progress; demo progress is not server-backed student progress or XP.

Some practice, resource, and schedule views depend on published content or connected services. See [Project status](#project-status).

### Management Portal

- Sign-in for pre-provisioned Management accounts; **there is no public Management registration**.
- Existing student directory, profile, and progress review.
- Course, subject, and learning-sequence management.
- Learning materials, assignments, assessments, grading/review, live classes, and announcements.
- Classroom workspace for class rosters, joining codes, stream posts, topic-organized classwork, calendar, review queue, and gradebook.
- Student classroom access for enrolled students, using existing courses and classwork records.
- Reporting and progress monitoring.

The Management UI does not offer a public student-account creation workflow. Server-side authorization protects management and student APIs separately.

## Classroom management

The unified Management Portal's Classes area links each classroom to a reusable published course; creating a classroom does not copy course content. Management can enroll existing student accounts, share a joining code, publish stream announcements and classwork, schedule live classes, and review grades. Students can join with their authenticated PREPPX account and see only classrooms where they are enrolled.

Classroom tables and optional classroom references on existing classwork are additive entries in `server/db/schema.sql`. Apply them with `npm run db:migrate` only after verifying the configured database and taking an appropriate backup. The migration is not run automatically by the application. See [the classroom implementation report](docs/CLASSROOM_PORTAL_IMPLEMENTATION.md) for functionality and verification status.

For the current release-readiness matrix, known blockers, environment setup, and next-agent instructions, see the [final AI handoff](docs/PREPPX_FINAL_HANDOFF.md) and [release report](docs/PREPPX_RELEASE_REPORT.md).

## Technology stack

- React 19, TypeScript, React Router, and Vite.
- Node.js and Express 5 API.
- PostgreSQL with SQL schema setup in `server/db/schema.sql`.
- Zod request/environment validation, JWT-based sessions, and bcrypt password hashing.
- Resend for optional email delivery and S3-compatible object storage for optional file uploads.
- `tsx` and Node's test runner for the available automated tests.

## Application architecture

The React application and shared TypeScript utilities are in `src/` and `shared/`. The Express API handles authentication, authorization, validation, database operations, email delivery, and optional object storage. Vite proxies `/api` requests to the local API.

```text
.
├── docs/                 Audit and maintenance records
├── public/               Static public assets
├── server/
│   ├── db/               PostgreSQL pool, schema, migration, bootstrap
│   └── routes/            Authentication, Student, and Management APIs
├── shared/               Shared subject, course-node, and scoring rules
├── src/
│   ├── app/              Routes and Student module definitions
│   ├── features/         Auth, dashboard, Student, and Management UI
│   ├── layouts/          Portal layouts
│   ├── services/         Client services
│   └── styles/           Application styles
├── tests/                Focused shared-logic regression tests
├── package.json
├── .env.example
└── vite.config.ts
```

## Prerequisites

- Node.js **22.12 or newer**, as specified by `package.json` and `.nvmrc`.
- npm and Git.
- A PostgreSQL server and a database/user for local development. The project does not pin a PostgreSQL major version.

## Installation and local setup

1. Clone the PREPPX repository using its GitHub Clone URL, then enter the project directory:

   ```sh
   git clone <PREPPX-repository-URL>
   cd preppx-student
   ```

2. Install the locked dependencies and create a private local environment file:

   ```sh
   npm ci
   cp .env.example .env
   ```

   On PowerShell, `Copy-Item .env.example .env` may be used instead of `cp`.

3. Create a local PostgreSQL database and configure `DATABASE_URL` in `.env`. Set a random `MANAGEMENT_JWT_SECRET` of at least 32 characters and the exact local `FRONTEND_ORIGIN` (`http://localhost:5173`). Keep `.env` private.

4. Apply the schema:

   ```sh
   npm run db:migrate
   ```

   Back up any database containing existing data before schema changes. The migration applies the current schema; it is not a database reset.

5. To provision a Management account in a **fresh local database only**, set all three `MANAGEMENT_BOOTSTRAP_NAME`, `MANAGEMENT_BOOTSTRAP_EMAIL`, and `MANAGEMENT_BOOTSTRAP_PASSWORD` values, then run:

   ```sh
   npm run db:bootstrap
   ```

   Bootstrap creates or updates the Management record for that email, including its password hash. Do not run it against an existing account unless you intentionally want to update that account's name/password. Management registration is not public.

6. Start the API and frontend in separate terminals:

   ```sh
   npm run dev:api
   ```

   ```sh
   npm run dev
   ```

   Open `http://localhost:5173`. The API listens on port `3001` by default, and Vite proxies `/api` to it. The shared account-selection page is `/login`; Student and Management sign-in pages are `/student/login` and `/management/login`.

## Environment variables

Set names and local placeholders in `.env`; never commit real values. To enable student registration, sign-in codes, and password recovery, create a Resend API key and verify the sender domain in Resend. Set `RESEND_API_KEY` and `EMAIL_FROM` together; use a sender on that verified domain, such as `PREPPX <no-reply@your-verified-domain.com>`.

| Variable | Requirement | Purpose |
|---|---|---|
| `DATABASE_URL` | Required | PostgreSQL connection URL. |
| `MANAGEMENT_JWT_SECRET` | Required | Secret used for signed sessions; at least 32 characters. |
| `FRONTEND_ORIGIN` | Required | Exact trusted frontend origin, such as the local Vite origin. |
| `FRONTEND_ORIGINS` | Optional | Comma-separated additional exact trusted origins. |
| `API_PORT` | Optional; defaults to `3001` | API listening port. |
| `COOKIE_SECURE` | Optional; defaults to false unless exactly `true` | Enables the Secure cookie attribute; use `true` with HTTPS. |
| `MANAGEMENT_BOOTSTRAP_NAME` | Optional; all three bootstrap values required together | Management account name for the bootstrap command. |
| `MANAGEMENT_BOOTSTRAP_EMAIL` | Optional; all three bootstrap values required together | Management account email for the bootstrap command. |
| `MANAGEMENT_BOOTSTRAP_PASSWORD` | Optional; all three bootstrap values required together | Bootstrap password; at least 12 characters. |
| `RESEND_API_KEY` | Required for student registration, sign-in OTP, and password recovery | Resend API key. Configure it together with `EMAIL_FROM`; without both, these email-dependent workflows return a configuration error. |
| `EMAIL_FROM` | Required with `RESEND_API_KEY` | Sender email, optionally formatted as `PREPPX <no-reply@your-domain.com>`. The address/domain must be verified in Resend and authorized for the API key. |
| `S3_ENDPOINT` | Optional integration; configure all five S3 values together | S3-compatible storage endpoint over HTTP(S). |
| `S3_REGION` | Optional integration; configure all five S3 values together | Object-storage region. |
| `S3_BUCKET` | Optional integration; configure all five S3 values together | Private object-storage bucket. |
| `S3_ACCESS_KEY_ID` | Optional integration; configure all five S3 values together | Object-storage access key. |
| `S3_SECRET_ACCESS_KEY` | Optional integration; configure all five S3 values together | Object-storage secret key. |

Email-dependent registration, verification, and password recovery are unavailable until Resend is configured. File operations requiring object storage report an error until a private S3-compatible service is configured. Do not expose the bucket publicly.

## Development commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend. |
| `npm run dev:api` | Start the Express API in watch mode. |
| `npm run typecheck` | Type-check the frontend and shared application project. |
| `npm run typecheck:api` | Type-check the API. |
| `npm test` | Run focused tests using `tsx` and Node's test runner. |
| `npm run build` | Type-check and create the production frontend build in `dist/`. |
| `npm run preview` | Preview the production frontend build; does not start the API. |
| `npm run db:migrate` | Apply the schema in `server/db/schema.sql`. |
| `npm run db:bootstrap` | Create or update the configured Management account. Use cautiously as described above. |

There is no dedicated lint script in `package.json`.

## Authentication and roles

Student registration, login verification, and password recovery use server APIs and email OTP delivery. Student and Management sessions use separate authentication paths and protected server routes. The browser-only legacy password setup is retained for compatibility/migration and does not set a server-backed account password. Management accounts are pre-provisioned; there is no public Management registration.

## Database and safe development

PostgreSQL is the source of truth for server-backed accounts, courses, learning activity, submissions, and other persisted workflows. `npm run db:migrate` applies the current SQL schema. Back up data before applying schema changes to a database with existing records. Never drop, recreate, or reset a production or shared database to make a local test pass. Do not run the bootstrap command against an existing Management account unless an account update is intended.

## Testing

Run the frontend typecheck, API typecheck, focused test suite, and production build with:

```sh
npm run typecheck
npm run typecheck:api
npm test
npm run build
```

The automated tests cover subject catalog and course-node hierarchy rules, assessment scoring, and Learning Journey demo isolation. They are not a full API/database or browser integration suite. Authenticated workflows and external email/storage integrations require appropriate local test configuration and have not all been end-to-end verified.

## Project status

The repository includes server-backed Student and Management areas, protected API routes, PostgreSQL schema setup, and a focused automated test suite. The Management subject/course/node selection and validation rules have shared frontend/backend handling. The Learning Journey sample mode is isolated from real student progress.

Some student screens depend on published learning content; practice/resource areas are not all connected to complete content workflows. Email and file-storage integrations require external configuration. The application has not been exhaustively validated as a production LMS; consult [the audit tracker](docs/PREPPX_FINAL_AUDIT.md) for known verification gaps.

## Security notes

- Keep `.env`, passwords, signing secrets, API keys, database dumps, and private user uploads out of source control.
- Use a unique random signing secret and strong account passwords.
- Use HTTPS and set `COOKIE_SECURE=true` in deployed environments.
- Configure only trusted exact frontend origins.
- Keep object-storage buckets private and protect database backups and student data.
- Review changes and database migrations before applying them to environments with real users.

## License

No license has been specified in this repository.
