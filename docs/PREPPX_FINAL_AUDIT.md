# PREPPX Code Audit and Remediation Tracker

## Audit status and evidence

This is a working audit record, not a claim that every route and UI operation has passed an end-to-end test. The recursive inventory found 71 first-party files matching the requested source/config/documentation extensions, excluding dependency/build output, `.git`, `.env`, and `package-lock.json`. The final inventory below also lists relevant root metadata, `.env.example`, the lockfile, this report, and the added shared scoring code/tests, for **80 paths**. `.env` contents were not read.

The review traced the subject → course → node workflow through the shared subject catalog, Management selectors, Management API validation, database relationships, and Student course display. It also checked the major route boundaries, auth middleware, representative Student and Management data paths, the schema, route navigation, pagination, assessment timer, and current documentation. The full 71-file inventory was not individually deep-reviewed line-by-line; unverified areas and test limits are called out explicitly below.

No database reset, bootstrap, fake student creation, or content seeding was performed. The existing local API health endpoint reported PostgreSQL connected. Anonymous requests to Management overview/directory and Student courses/progress returned `401`. No environment values or credentials were read or printed.

## Remediation tracker

| Severity | Finding and root cause | Correction | Verification |
|---|---|---|---|
| High | Management subject input was free-form/defaulted to Coding; course choices were not consistently restricted to the selected supported subject, dependent values could remain stale, and node choices were flat. Backend content APIs also lacked complete subject/course/node relationship validation. | Added the shared Coding/Aptitude/Logical Reasoning catalog; subject-driven course filtering and dependent-selection resets; course-tree display labels; server-side catalog, course, node-type, and hierarchy checks; transactional node create/update validation. | `tests/courseNodes.test.ts` validates subject values, hierarchy, invalid parents, cross-course links, missing parents, cycles, and hierarchy ordering. Frontend/API typechecks and build pass. Existing DB has no course nodes and only a Coding course, so other-subject persistence could not be exercised without creating records. |
| High | `PublishedAssessmentsPage` declared timer `useEffect` hooks inside the submit event handler. Assessment submission could therefore trigger an invalid hook call at runtime; timer effects were also coupled to every countdown tick. | Moved hooks to component scope, stabilized refresh/submit callbacks, and made timer start/stop follow the active countdown state. | Frontend typecheck and production build pass. Full timed assessment browser test needs an authenticated assessment and was not run. |
| High | Password reset sent `{ email, password }` from the client, while the verified reset API strictly accepts `{ password }`; every reset request would fail validation. The page also described the server-backed change as browser-local. | Send only the password authorized by the short-lived reset cookie and display accurate server-backed feedback. | Frontend/API typechecks and build pass. Full recovery flow requires email delivery and was not run. |
| Medium | Timed/partial assessment submission could not finish if any multiple-choice item was unanswered: the client sent `null` for that answer, but the server rejected the whole attempt instead of treating it as incorrect. | Extracted objective scoring into a shared helper; unanswered answers earn zero, while invalid option indexes remain rejected. | `tests/assessmentScoring.test.ts` covers unanswered, correct, incorrect, and invalid choices. API typecheck passes. |
| Medium | The Management assessment-review endpoint accepted repeated reviews after the first score/XP award; later score changes could diverge from the already-idempotent XP award. | Lock the attempt and reject any second review with `409` after a successful review. | API typecheck passes. Full database concurrency/review integration testing remains blocked by lack of an authenticated Management test session. |
| Medium | Student course detail rendered a flat node list with only a one-level indent; course-level materials (`node_id = NULL`) were returned by the API but not displayed in the course page. | Render nodes in parent-first hierarchy order with depth-based indentation and expose course-level materials. | Shared hierarchy-order utility test passes; typecheck/build pass. Authenticated browser course test was not possible. |
| Medium | Student directory enabled Next based on a full page of rows, so exactly 25 remaining results enabled an empty extra page; total count was available from the API but not used. | Use API total/page size, display total pages, disable Next at the true final page, and clamp stale pages if data shrinks. | Frontend typecheck/build pass. No authenticated Management browser session was available for interaction testing. |
| Medium | Management overview labeled courses “Published” while counting all non-archived courses; materials could similarly include drafts/unavailable records in an availability count. | Count published courses and materials that are actually visible to students; use matching labels. | API typecheck/build pass. The protected overview endpoint correctly rejects anonymous access; authorized dashboard data was not queried. |
| Medium | Management material uploads had no byte-transfer feedback for new or replacement files. | Added upload-progress callbacks and accessible progress indicators for both upload paths. Updated the legacy password setup page to clearly disclose that its verifier is browser-only and not a server password. | Frontend/API typechecks, tests, and build pass. Actual file transfer remains unverified because S3-compatible storage is not configured. |
| Medium | Student and Management password forms exposed no visibility control, making password entry difficult to inspect on touch and desktop keyboards. | Added a reusable controlled `PasswordInput` with independent per-field visibility state, accessible labels/pressed state, and non-submitting button behavior. Applied to all eight password fields in Student login, registration, legacy password setup, password reset/confirmation, and Management login. No password persistence or authentication behavior changed. | SSR default/accessibility regression test passes; browser checks verified reveal/hide, value preservation, independent fields, keyboard activation, and responsive layout. Authenticated credential submission remains blocked without test credentials and email service. |
| Low | Architecture, testing, and packaging notes described a frontend-only/future Management system and claimed no test script, contradicting the current API/database implementation. | Rewrote the architecture and test/build notes and corrected contribution/README guidance. | Documentation reviewed against current route/config/script setup; no documentation test exists. |

## Source inventory

The following inventory was collected recursively. Group descriptions summarize the role of each area; they are not a complete per-symbol call graph.

### Root documentation and app configuration

| File | Purpose / observed use |
|---|---|
| `ARCHITECTURE.md` | Current application areas, auth/data boundaries, and known limits. |
| `.editorconfig` | Editor formatting defaults. |
| `.env.example` | Environment variable names and placeholder development values; no secret values. |
| `.gitignore` | Generated, local, and secret-file exclusions. |
| `CONTRIBUTING.md` | Engineering and safe-change conventions. |
| `index.html` | Vite HTML entry. |
| `MASTER-TEST-BUILD-NOTES.md` | Build/test limitations and safe local test guidance. |
| `package.json` | Scripts and dependency manifest. |
| `package-lock.json` | Dependency lockfile; inventoried but not reviewed line-by-line. |
| `README.md` | Setup, integrations, features, deployment constraints. |
| `TESTING-CHECKLIST.md` | Local and authenticated test procedures. |
| `.nvmrc` | Node version selection. |
| `vite.config.ts` | Frontend plugins, host/port, and API proxy. |
| `tsconfig.json` | TypeScript project references. |
| `tsconfig.app.json` | Strict frontend/shared-source typecheck configuration. |
| `tsconfig.node.json` | Node/Vite configuration typecheck. |
| `tsconfig.server.json` | Backend typecheck configuration. |
| `docs/PREPPX_FINAL_AUDIT.md` | This remediation tracker and audit evidence. |

### API, authentication, and database

| File | Purpose / observed use |
|---|---|
| `server/app.ts` | Express setup, CORS/security middleware, health endpoint, routes, error responses. |
| `server/auth.ts` | Separate Student/Management tokens, role checks, exact-origin state-change guard. |
| `server/config.ts` | Validates server environment configuration and optional integrations. |
| `server/db/bootstrap.ts` | Optional Management-account provisioning/update; intentionally not run. |
| `server/db/migrate.ts` | Applies the schema file; not rerun during this audit. |
| `server/db/pool.ts` | PostgreSQL pool. |
| `server/db/schema.sql` | Tables, relations, constraints, indexes, and additive schema changes. |
| `server/email.ts` | Optional OTP email delivery and safe configuration errors. |
| `server/http.ts` | Shared route/error/ID helpers. |
| `server/index.ts` | API process entry point. |
| `server/routes/auth.ts` | Provisioned Management login/session/logout. |
| `server/routes/management.ts` | Management APIs, validation, course hierarchy, and content operations. |
| `server/routes/student.ts` | Authenticated Student learning/content/progress APIs. |
| `server/routes/studentAuth.ts` | Student registration, OTP, password recovery, sessions, and profile APIs. |
| `server/storage.ts` | Optional private object-storage upload/download helpers. |

### Shared contracts, app routes, and common components

| File | Purpose / observed use |
|---|---|
| `shared/courseNodes.ts` | Node types, hierarchy validation, path labels, and parent-first ordering. |
| `shared/assessmentScoring.ts` | Pure multiple-choice scoring rule shared with the Student API. |
| `shared/subjects.ts` | Canonical supported subject values used by UI and API. |
| `src/app/App.tsx` | Common, Student, and unified Management route composition. |
| `src/app/studentModules.ts` | Student workspace navigation/module definitions. |
| `src/app/studentRoutes.ts` | Student route constants and query helper. |
| `src/components/common/Brand.tsx` | Shared brand component. |
| `src/components/common/PageTransition.tsx` | Route transition wrapper. |
| `src/components/gamification/GamificationEffects.tsx` | Student XP/level-up presentation. |
| `src/components/gamification/LevelProgressCard.tsx` | Student level summary. |
| `src/components/ui/ProgressBar.tsx` | Shared progress display. |
| `src/components/ui/ThemeToggle.tsx` | Theme control. |
| `src/layouts/StudentLayout.tsx` | Protected Student workspace shell and navigation. |
| `src/main.tsx` | React entry point. |
| `src/providers/ThemeProvider.tsx` | Theme state/provider. |
| `src/styles/index.css` | Shared design system and responsive styling. |
| `src/types/student.ts` | Student-facing data contracts. |
| `src/vite-env.d.ts` | Vite client type declarations. |

### Student features and services

| File | Purpose / observed use |
|---|---|
| `src/features/auth/components/AuthShell.tsx` | Shared auth-page layout. |
| `src/features/auth/components/RequireStudent.tsx` | Client route guard backed by session restoration; server authorization remains authoritative. |
| `src/features/auth/pages/AccountLoginPage.tsx` | Common Student/Management sign-in selection. |
| `src/features/auth/pages/CreatePasswordPage.tsx` | Student password setup/compatibility screen. |
| `src/features/auth/pages/ForgotPasswordPage.tsx` | Student recovery request. |
| `src/features/auth/pages/LandingPage.tsx` | Common entry dashboard. |
| `src/features/auth/pages/LoginPage.tsx` | Student sign-in. |
| `src/features/auth/pages/RegisterPage.tsx` | Student registration. |
| `src/features/auth/pages/ResetPasswordPage.tsx` | Student password reset. |
| `src/features/auth/pages/VerifyOtpPage.tsx` | Student email verification. |
| `src/features/auth/services/authService.ts` | Student auth API calls and legacy-browser-account migration. |
| `src/features/auth/types/auth.ts` | Auth types. |
| `src/features/dashboard/pages/StudentDashboardPage.tsx` | Student overview. |
| `src/features/student/pages/AssignmentsPage.tsx` | Student assignment submission/review UI. |
| `src/features/student/pages/CoursesPage.tsx` | Published course, hierarchy, lesson, and material UI. |
| `src/features/student/pages/LearningJourneyPage.tsx` | Optional isolated Learning Journey presentation demo. |
| `src/features/student/pages/LiveClassesPage.tsx` | Student live-class UI. |
| `src/features/student/pages/PublishedAssessmentsPage.tsx` | Student assessment attempts/timer/results. |
| `src/features/student/pages/StudentModulePage.tsx` | Student module dispatch, practice/resource/progress pages. |
| `src/features/student/services/learningJourneyDemoService.ts` | Demo-only browser-storage progress and XP. |
| `src/features/student/services/learningService.ts` | Student learning/content operations. |
| `src/features/student/services/studentApi.ts` | Authenticated Student API client. |
| `src/services/studentService.ts` | Student dashboard/profile data service. |

### Management feature and tests

| File | Purpose / observed use |
|---|---|
| `src/features/management/pages/ManagementPortalPage.tsx` | Unified Management login, navigation, overview, and forms. |
| `src/features/management/services/managementApi.ts` | Authenticated Management API client. |
| `tests/courseNodes.test.ts` | Shared catalog and course hierarchy regression tests. |
| `src/test/README.md` | Existing test-directory guidance. |
| `tests/assessmentScoring.test.ts` | Objective assessment scoring regression test. |
| `tests/learningJourneyDemo.test.ts` | Demo baseline, storage isolation, unlock order, reset, and duplicate-award regression test. |

## Route-to-data trace (reviewed representative paths)

| Frontend action | API path | Authorization/validation | Persistence |
|---|---|---|---|
| Management subject/course/node authoring | `/api/management/courses`, `/courses/:id/nodes`, and content routes | Management cookie; exact origin on mutations; shared subject enum; course/node and hierarchy validation | `courses`, `course_nodes`, and associated content tables |
| Student course list/detail | `/api/student/courses`, `/courses/:id` | Student cookie; published course filtering; enrollment scoped to token student | `courses`, `course_nodes`, `course_enrollments`, `learning_activity` |
| Lesson completion/XP | `/api/student/lessons/:id/complete` | Student cookie; published lesson; server-derived student ID; transaction and idempotent award key | `learning_activity`, `student_xp`, `student_xp_awards` |
| Assignment submission/review | `/api/student/assignments/...`, `/api/management/submissions/...` | Student ownership/enrollment/deadline; Management cookie for review; score bounded by max marks | `assignment_submissions`, activity, optional object storage |
| Assessment attempt/submit/review | `/api/student/assessments/...`, `/api/management/assessment-attempts/...` | Student ownership and availability; transactional objective grading; Management-only subjective review | attempts, responses, activity, XP awards |
| Auth/session | `/api/student/auth/*`, `/api/management/auth/*` | Separate credentials, JWT audiences, cookies, login limits; no Management registration endpoint observed | student challenge/account and pre-provisioned management account |

This table traces representative workflows, not every route and request shape.

## Remaining verification and audit work

- The local database currently has only one published Coding course and no course-node rows. The three-subject UI and invalid hierarchy rules are covered at the shared utility level; actual Aptitude/Logical Reasoning course persistence and cross-subject selector behavior need authorized test content. No content was added to the existing database for testing.
- No authenticated Management or Student browser session was available. Protected endpoint rejection was tested anonymously; authenticated create/edit/delete, submission, review, assessment, and full navigation journeys remain unverified.
- Resend and S3-compatible storage were not configured for this test session; OTP delivery and file upload/download end-to-end behavior remain unverified.
- The project has no lint script or browser/API integration-test runner. `npm test` currently covers shared subject/hierarchy rules, assessment scoring, and Learning Journey demo isolation, but not live API workflows.
- Practice questions, coding execution, videos/recordings, and some schedule/resource experiences need published content or their respective integrations; empty states are expected when no content exists. Do not populate production with fixtures to hide that state.
- `/student/create-password` is retained only for legacy browser-local account migration; its page now explicitly distinguishes that verifier from the server-backed registration and password-reset flows.
- The recursive inventory is complete for the selected extensions, but semantic review of every listed file and every interactive control is **not complete**. Extend this tracker as remaining files and flows receive direct review.

## Current validation results

- `npm run typecheck` — passed.
- `npm run typecheck:api` — passed.
- `npm test` — passed (6 focused test cases covering subject catalog, course hierarchy/order, assessment scoring, Learning Journey demo isolation/idempotency, and PasswordInput defaults/accessibility semantics).
- `npm run build` — passed.
- `GET /api/health` — HTTP 200; database connected.
- Anonymous Management overview/directory and Student course/progress requests — HTTP 401.
- Local common entry page — HTTP 200; `/login` displayed separate Student and Management choices and explicitly stated that public Management registration is unavailable.
