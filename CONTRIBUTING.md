# Preppx Student Portal — Contribution Rules

1. Use TypeScript and keep strict checking enabled.
2. Keep feature UI and logic under `src/features/<feature>/`.
3. Pages must call typed services; do not embed fabricated records in JSX.
4. Do not add sample student identities, fake progress, placeholder tests, invented resources, fabricated sessions, or seeded notifications.
5. When content is unavailable, build a useful empty state that explains what will appear there once assigned or published.
6. Show personal data only from the authenticated student's account record. Do not derive a display name from an email address.
7. Keep data operations scoped to the current account. Do not mix one student's local activity with another student's activity.
8. Keep account/profile details, authentication state, and learning activity in their service boundaries.
9. Keep shared visual components reusable and the monochrome light/dark design consistent.
10. Ensure desktop, tablet, and mobile layouts remain usable.
11. Never expose API secrets or privileged credentials in frontend code or `VITE_` environment variables.
12. Treat local browser authentication and the visible OTP as development-only. Do not describe the frontend as production-secure.
13. Keep student and unified Management APIs separately authenticated and authorized. Do not add a public Management registration flow.
14. Before handing off changes, run `npm run typecheck` and `npm run build` where dependencies are available, and document any check that could not be run.
15. Preserve existing database records, credentials, and unrelated workspace changes. Prefer additive database changes and never reset a populated database for tests.


## Route boundary

- Keep the existing common Preppx entry page at `/`. Do not redesign it as part of Student Portal-only changes unless explicitly requested.
- Keep all student sign-in, registration, password setup/recovery, dashboard and learning screens under `/student/*`.
- Student modules must not import Faculty or Admin page components.
- Keep older root-level student auth URLs only as redirects for compatibility.
