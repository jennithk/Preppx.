# PREPPX Final AI Handoff

**Audit date:** 2026-11-01
**Release assessment:** **PARTIAL / NOT RELEASE-READY for student registration and complete classroom workflows.** Frontend/API typechecks, tests, production build, API/database health, anonymous authorization checks, and additive schema migration passed. No authorized Student or Management account was used, and Resend/S3 credentials are not configured, so the complete user journeys remain unverified.

This handoff records source and runtime evidence gathered for the release-readiness task. It does not treat the presence of a page or API route as proof that its full workflow has passed.

## A. Project overview

PREPPX is a web-based learning and classroom-management platform with three primary areas:

1. **Common entry:** public landing page and account selection.
2. **Student Portal:** server-backed student authentication, courses, coursework, assessments, classroom access, progress, and account features.
3. **Unified Management Portal:** pre-provisioned Management authentication, student records, classroom management, publishing, and review.

The browser app is React 19 + TypeScript + React Router, built and served by Vite. The API is Node.js + Express 5 + TypeScript. PostgreSQL stores accounts, course content, learning activity, coursework, classroom data, and grades. Zod validates environment variables and request bodies. Resend is used for email OTP delivery; S3-compatible private object storage is used for file workflows when configured.

## B. Project structure and important paths

```text
src/
  main.tsx                                  React entry point
  app/App.tsx                               Browser routes and portal boundaries
  app/studentRoutes.ts                      Student route names
  app/studentModules.ts                     Student navigation/module catalog
  layouts/StudentLayout.tsx                 Authenticated Student shell
  features/auth/                            Student auth pages, services, route guard
  features/dashboard/                       Student dashboard
  features/student/pages/                   Student courses, classrooms, assignments, etc.
  features/student/services/                 Student API, learning and demo services
  features/management/pages/
    ClassroomPortalPage.tsx                 Active unified Management Portal
    ManagementPortalPage.tsx                Legacy Management UI component; not mounted by App.tsx
  features/management/services/managementApi.ts
  components/ui/PasswordInput.tsx           Shared hidden-by-default password control
  styles/index.css                          Application and responsive styles
server/
  app.ts                                    Express setup, middleware, API mounts, errors
  index.ts                                  API startup and shutdown
  auth.ts                                   Student/Management cookies, JWTs, role middleware
  config.ts                                 Environment validation and integration readiness
  email.ts                                  Resend OTP delivery
  storage.ts                                Optional private object storage
  routes/auth.ts                            Management login/session/logout
  routes/studentAuth.ts                     Student registration, OTP, login, recovery, profile
  routes/student.ts                         Student courses, materials, submissions, assessments, progress
  routes/management.ts                      Management courses, nodes, coursework, reviews, announcements
  routes/classrooms.ts                      Management and Student classroom APIs
  db/pool.ts                                PostgreSQL pool
  db/schema.sql                             Idempotent schema and additive DDL
  db/migrate.ts                             Applies schema.sql
  db/bootstrap.ts                           Creates/updates configured Management account
shared/
  subjects.ts                               Canonical supported subject values
  courseNodes.ts                            Course-node validation, ordering, and labels
  assessmentScoring.ts                      Objective assessment scoring
tests/
  assessmentScoring.test.ts
  courseNodes.test.ts
  learningJourneyDemo.test.ts
  passwordInput.test.ts
docs/
  PREPPX_FINAL_AUDIT.md                     Existing detailed audit/tracker
  CLASSROOM_PORTAL_IMPLEMENTATION.md         Classroom implementation details
  PREPPX_RELEASE_REPORT.md                   Release assessment and Git result
```

The frontend calls `/api/student/*` and `/api/management/*`. Vite proxies `/api` to `http://127.0.0.1:3001`. Student and Management use separate HttpOnly cookies, JWT audiences, and authorization middleware. Route guards are a UX boundary only; server authorization is authoritative.

## C. Current implementation status

Status definitions: **PASS** means the named check passed, not that every feature has been exhaustively tested. **PARTIAL** means source functionality exists but a full flow or required content/service was not verified. **BLOCKED** means required external configuration/access is missing. **NOT IMPLEMENTED** means no working content or end-to-end feature is supplied.

| Feature | Status | Evidence and important details |
|---|---|---|
| Common Entry | PASS (smoke) | `/` and `/login` rendered in browser; account selection showed Student and Management choices and no public Management registration. |
| Student authentication | PARTIAL | Registration, OTP verify/resend, password login, reset, session, and logout routes exist. No complete account flow was run; email configuration is empty. |
| Management authentication | PARTIAL | Separate pre-provisioned login/session/logout exists. Anonymous protected endpoints returned 401; no authorized credentials were used. |
| Password visibility | PARTIAL | Shared control is hidden by default. Browser check confirmed independent registration toggles and hidden Management password; unit test passed. All active password fields use the component, but each route was not manually exercised. |
| Email verification | BLOCKED | Resend service and safe readiness booleans are implemented; `RESEND_API_KEY` and `EMAIL_FROM` are empty. No message was sent. |
| Student Dashboard | PARTIAL | Aggregates current-account API data and has explicit loading/error/empty states; no authenticated dashboard was opened. |
| Learning Journey demo | PASS (automated) | Subject-specific sample progress is isolated in browser demo storage, prevents duplicate XP awards, and resets to baseline; the focused test passed. |
| Student courses/materials | PARTIAL | Published-course and course-node APIs, authorization, material download route, and frontend exist. No student-account journey or file download was run. |
| Coding practice | PARTIAL | UI supports editor/draft/filter presentation, but challenge provider returns no challenges and code execution/submission is explicitly not enabled. Drafts are browser-local. |
| Aptitude practice | PARTIAL | UI exists, but question provider returns an empty list; recorded answer/progress is browser-local. |
| Assignments | PARTIAL | API supports publication, text/file submissions, review and feedback; file submission requires S3. Authenticated submit/review was not tested. |
| Assessments | PARTIAL | API supports attempts, objective scoring, timer, and manual review; no authenticated attempt/review was run. |
| Progress/XP | PARTIAL | Server-backed course activity and XP exist; local practice modules are not authoritative server progress. No authenticated values were inspected. |
| Announcements/notifications | PARTIAL | Management announcements and Student announcement/read APIs are wired to the Student UI; authenticated display/read was not exercised. Classroom stream is separate and membership-scoped. |
| Live classes | PARTIAL | Existing live-class APIs plus classroom scheduling/linking are present; no actual meeting link was joined. |
| Classroom creation | PARTIAL | Management API/UI validates a published course and matching supported subject; authenticated create/edit/archive was not run. |
| Classroom Stream | PARTIAL | Draft/publish/pin/edit/archive and student comments are implemented; not integration-tested. |
| Classwork/topics/materials | PARTIAL | Topics, assignments, quizzes, course materials, links, and live classes have API persistence. Storage upload is blocked without S3; no authenticated workflow was run. |
| People/enrollment | PARTIAL | Existing students can be searched/enrolled/removed; join code and duplicate prevention exist. Not tested with authorized accounts. |
| Grades/feedback | PARTIAL | Gradebook, missing-work state, submission/attempt review, score limits, and student grade endpoints exist. Not persistence-tested through the UI. |
| Calendar/To Review | PARTIAL | APIs and pages combine deadlines, scheduled classes, submissions, and attempts; no authorized records were used. |
| Subject/course/topic/lesson selection | PARTIAL | Shared Coding/Aptitude/Logical Reasoning catalog and course hierarchy validation are tested. Classroom subject filters published matching courses; material choices now show full node ancestry. No multi-subject database journey was run. |
| Backend API | PASS (smoke/typecheck) | API started; `GET /api/health` returned 200 with database connected; anonymous Student and Management protected calls returned 401. |
| PostgreSQL migration | PASS | Additive schema applied twice; classroom tables and classroom references were confirmed through `information_schema`. No reset/bootstrap/content seed was run. |
| S3 file storage | BLOCKED | All S3 settings are empty; uploads/downloads were not tested. |
| Responsive UI | PARTIAL | Responsive styles exist. No comprehensive desktop/tablet/mobile audit was run in this release pass. |
| Automated tests/build | PASS | Six existing tests, frontend/API typechecks, and production build passed. |
| Lint/API integration suite | NOT IMPLEMENTED | `package.json` defines neither a lint script nor an API/database integration-test script. |

## D. Completed work in the current implementation

- Added the classroom data model and protected Management/Student classroom APIs.
- Mounted the new unified classroom-oriented Management portal and the authenticated Student “My classrooms” module.
- Added class roster/enrollment, join codes, Stream posts/comments, class topics, assignments, assessments, materials, external links, live classes, gradebook, calendar, and review queue workflows.
- Kept a classroom linked to a reusable existing Course instead of duplicating its learning content.
- Added membership checks to class-linked assignment and assessment list/start/submit paths.
- Added Resend OTP delivery, sender-format checks, configuration readiness booleans, verification-link OTP prefill, resend cooldown, and explicit error behavior. Real Resend readiness/delivery is still externally blocked.
- Kept `.env` ignored and `.env.example` value-free for Resend; extended `.gitignore` for local secrets, certificates, backups, logs, caches, build output, and uploads.
- Preserved the common landing/login entry, separate role sessions, existing data schema, and Learning Journey demo isolation.
- Corrected Management session bootstrap handling so non-401 failures are shown instead of silently appearing as a signed-out state.
- Changed classroom material node labels to display their course hierarchy and node type.

## E. Remaining work and tracked issues

| Priority | Feature/task | Current state and exact gap | Relevant paths/API | Next action | Dependency |
|---|---|---|---|---|---|
| P0 before student-auth release | Registration/login/recovery email E2E | Code exists but no OTP delivery/verification was possible because both Resend variables are empty. | `server/email.ts`, `server/config.ts`, `server/routes/studentAuth.ts`, `/api/student/auth/*` | Configure valid settings; test registration → delivered OTP/link → verified account → login OTP → protected page → reset/resend/expiry/errors. | Resend API key and verified sender domain |
| P0 before classroom release | Authenticated Management + Student E2E | No authorized sessions were available. All classroom create, publish, enroll, submit, grade, and feedback behavior is therefore PARTIAL, not proven complete. | `server/routes/classrooms.ts`, `server/routes/student.ts`; corresponding portal pages | Use existing approved test accounts and non-production records; test full journeys and cross-account/class membership isolation. Do not seed fake accounts. | Approved Management/Student test accounts |
| P1 | Course/node authoring access | `ManagementPortalPage.tsx` contains legacy course/node management UI, but `App.tsx` mounts `ClassroomPortalPage` for `/management/*`; no active navigation reaches the legacy editor. Current class creation consumes existing published courses, and classroom materials attach to existing nodes. | `src/app/App.tsx`, `src/features/management/pages/ManagementPortalPage.tsx`, `/api/management/courses*` | Confirm whether course/node authoring must remain available. If required, expose it within the unified portal without adding a second portal or losing current classrooms. Verify the subject → course → topic → lesson chain for all three subjects. | Product decision/content-management access |
| P1 when file workflows are needed | Material/submission uploads | S3 storage is intentionally unconfigured, so file transfer cannot work yet. | `server/storage.ts`, `/api/management/classrooms/:id/materials`, `/api/student/assignments/:id/attachment` | Configure all five S3 values and test private upload/download permissions and failure behavior. | Private S3-compatible endpoint and credentials |
| P2 | Coding/aptitude content | Providers in `learningService.ts` currently return empty lists; coding execution/submission is explicitly disabled. | `src/features/student/services/learningService.ts`, `StudentModulePage.tsx` | Connect an approved trainer content source and safe code-execution/submission service before advertising these as operational practice. Keep empty states until real content exists. | Content/service implementation |
| P2 | Videos, recordings, general sessions | Current providers return empty lists or state that playback/meeting data is unavailable. Live classes have a separate API-backed implementation. | `learningService.ts`, `StudentModulePage.tsx` | Integrate real published resources/schedules or retain clear empty/unavailable states. | Published content/integrations |
| P2 | Comprehensive integration/accessibility/responsive suite | Existing tests are shared-logic and component-render tests only; no browser test runner/API test suite is configured. | `tests/`, `package.json`, `TESTING-CHECKLIST.md` | Add focused API/database/browser tests only when a safe test database and authorized test identities are available. | Test infrastructure and safe fixtures |
| P3 | Lint | No lint script or configured lint runner is present. | `package.json` | Decide whether linting is a project requirement before adding tooling. | Project decision |

No unresolved runtime defect was established by the automated checks. The items above are verification, external configuration, or product/content gaps; they must not be reported as completed user journeys.

## F. Database and migration information

- **Database:** PostgreSQL via `pg.Pool` in `server/db/pool.ts`.
- **Schema source:** `server/db/schema.sql`; `server/db/migrate.ts` reads and applies the complete schema file.
- **Important tables:** `management_users`, `students`, `student_auth_challenges`, `courses`, `course_nodes`, `course_enrollments`, `classrooms`, `classroom_enrollments`, `classroom_topics`, `classroom_posts`, `classroom_comments`, `classroom_resources`, `learning_materials`, `live_classes`, `assignments`, `assignment_submissions`, `assessments`, `assessment_questions`, `assessment_attempts`, `assessment_responses`, `learning_activity`, `student_xp`, `student_xp_awards`, `announcements`, and `student_announcement_reads`.
- **Core relationships:** a classroom has one reusable course; a course can be linked to many classrooms. Classroom membership is unique per `(classroom_id, student_id)`. Topics/posts/resources belong to a classroom; assignments/assessments/live classes have nullable classroom references to preserve legacy non-classroom records. Course content remains in course/node/material tables.
- Classroom enrollment is written transactionally together with the existing course enrollment. Removing classroom membership removes the classroom membership; it does not delete a potentially shared course enrollment.
- **Migration command:** `npm run db:migrate`. This applies all `CREATE ... IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` statements in the schema. Review the target and back up shared/production data first.
- During this release pass, the six classroom tables and three classroom reference columns were absent before migration; the schema was applied twice successfully and those objects were then verified. The schema contains no `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, or `INSERT` statements. No account bootstrap, database reset, test student, or content seed was run.
- No record-level before/after audit was performed. Do not assume a database backup exists.

## G. Environment configuration

Configure values only in the ignored local `.env`; do not commit or paste secrets. The current safe presence check found `DATABASE_URL`, `MANAGEMENT_JWT_SECRET`, and `FRONTEND_ORIGIN` nonempty; Resend and S3 values were empty. Values were not printed.

| Variable | Purpose / requirement |
|---|---|
| `DATABASE_URL` | Required PostgreSQL connection URL. |
| `MANAGEMENT_JWT_SECRET` | Required signing key, minimum 32 characters. |
| `FRONTEND_ORIGIN` | Required exact frontend origin used by CORS and mutation origin checks. |
| `FRONTEND_ORIGINS` | Optional comma-separated exact additional origins. |
| `API_PORT` | Optional API port; default `3001`. |
| `COOKIE_SECURE` | Set `true` for HTTPS deployments; local development defaults false. |
| `MANAGEMENT_BOOTSTRAP_NAME` | Optional bootstrap account name; configure with email/password only when provisioning intentionally. |
| `MANAGEMENT_BOOTSTRAP_EMAIL` | Optional bootstrap account email. |
| `MANAGEMENT_BOOTSTRAP_PASSWORD` | Optional bootstrap password, minimum 12 characters. Bootstrap can update an existing Management account; do not run casually. |
| `RESEND_API_KEY` | Required for student registration, sign-in OTP, and password recovery email. |
| `EMAIL_FROM` | Required with Resend key; sender address/display-name format must use an address authorized by a verified Resend domain. |
| `S3_ENDPOINT` | Optional private object-storage endpoint; configure all S3 variables together. |
| `S3_REGION` | S3-compatible region. |
| `S3_BUCKET` | Private bucket. |
| `S3_ACCESS_KEY_ID` | Storage access key. |
| `S3_SECRET_ACCESS_KEY` | Storage secret key. |

Management’s authenticated email readiness endpoint is `/api/management/classrooms/settings/email`; it returns only presence/format booleans, never secret values. It cannot prove DNS/domain verification or successful provider delivery. Resend currently blocks real email workflows; S3 currently blocks actual file transfer.

## H. Local setup and startup

Prerequisites: Node.js `>=22.12.0` (repository `.nvmrc` is `22.16.0`), npm, and PostgreSQL.

```powershell
npm ci
Copy-Item .env.example .env
```

Set required environment values in `.env`, verify `DATABASE_URL` points to the intended database, and back up shared data before schema changes. The classroom schema has already been applied to the database selected by the `.env` used during this audit; do not rerun it against another environment without review.

```powershell
npm run dev:api
```

In another terminal:

```powershell
npm run dev
```

Open `http://localhost:5173`. API defaults to port `3001`.

Available checks:

```powershell
npm run typecheck
npm run typecheck:api
npm test
npm run build
npm run db:migrate
```

There is no lint or API integration-test script. `npm run db:bootstrap` is not a routine startup command and must not be run against an existing account unless an update is intentional.

## I. Known issues and blockers

1. **Student email workflows are externally blocked:** Resend key/sender are empty. No delivery or real OTP verification was tested.
2. **S3 workflows are externally blocked:** storage settings are empty; no file upload/download was tested.
3. **No authorized credentials were used:** end-to-end Management/Student classroom and grade workflows remain unverified.
4. **Legacy course/node authoring UI is not reachable through active routing:** the new portal allows classroom creation against existing published courses and uses existing nodes for materials; decide how course and node authoring should remain available.
5. **Coding and aptitude practice have no populated content source:** providers currently return empty lists. Coding execution/submission is not enabled.
6. **Video/recording/session provider paths remain empty or unavailable without published content.**
7. **No lint or integration/e2e runner is configured.**
8. **Database records were not inspected individually or compared before/after migration.** Migration was additive, but this is not a substitute for a backup or data-level audit.

## J. Test evidence

Executed on 2026-11-01:

| Command/check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run typecheck:api` | PASS |
| `npm test` | PASS — 6 tests |
| `npm run build` | PASS — Vite production bundle completed |
| `npm run db:migrate` | PASS — completed twice; repeat application succeeded |
| `GET /api/health` | PASS — HTTP 200, database connected |
| Anonymous Management session/overview | PASS — HTTP 401 as expected |
| Anonymous Student session/courses/progress | PASS — HTTP 401 as expected |
| Browser `/` and `/login` | PASS smoke — landing and account choices rendered |
| Browser Student registration | PARTIAL smoke — moved through review without submitting; both password fields began hidden and toggling one left the other hidden |
| Browser Management login | PASS smoke — page rendered; password began hidden; login was not attempted |
| Schema introspection | PASS — classroom tables and class-linked columns existed after migration |
| Resend delivery/OTP complete flow | BLOCKED — credentials/sender absent |
| S3 upload/download | BLOCKED — storage config absent |
| Authenticated classroom create-to-grade journey | NOT RUN — no approved authenticated account used |
| `git diff --check` | PASS |
| Lint | NOT AVAILABLE — no script defined |

The database migration did not reset or seed records. No Management bootstrap or account creation was executed.

## K. Instructions for the next AI agent

1. Start from the current `main` branch and inspect `git status` before editing. Preserve `.env` and all unrelated user changes.
2. Do not rewrite the app or create another portal. `src/app/App.tsx` is the route source; the active Management UI is `ClassroomPortalPage.tsx`. `ManagementPortalPage.tsx` is present but is not mounted.
3. Use `shared/subjects.ts` and `shared/courseNodes.ts` as canonical subject/hierarchy rules. Keep client selectors and server validation aligned; test all three supported subjects.
4. Student and Management authorization is server-side in `server/auth.ts` and route middleware. Do not rely on React route guards. Keep classroom data restricted through `classroom_enrollments`.
5. Use existing course/material/assignment/assessment tables and APIs. Do not duplicate course content or introduce fake student identities/content to populate empty screens.
6. The schema migration has been applied to the environment selected by the audit `.env`; confirm a target before migrating another database. Never reset data or invoke Management bootstrap casually.
7. Student OTP and file workflows remain blocked until the user configures Resend/S3 credentials locally. Do not ask for credentials in chat and do not claim delivery works without a real authorized test.
8. Fix P0 validation blockers first: authorized complete Student/Management workflows, role/membership isolation, and Resend registration/verify/login/recovery. Then address course/node authoring reachability and S3 file workflows.
9. After changes, run the scripts that exist: `npm run typecheck`, `npm run typecheck:api`, `npm test`, `npm run build`, and `git diff --check`. Run browser/database workflows only with approved test accounts and safe data.
10. Update this handoff and release report when evidence changes; keep generated builds, dependencies, `.env`, databases, and user records safe.
