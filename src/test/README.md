# PREPPX Test Notes

Use the root [TESTING-CHECKLIST.md](../../TESTING-CHECKLIST.md) as the current browser and API workflow plan.

The API and PostgreSQL are active parts of this project. Student identity, course activity, assignments, assessments, announcements, and XP are server-backed. Student OTP requires configured email delivery; there is no local fixed OTP. Learning Journey demo progress is a separate browser-only presentation store and must not be used as official Student progress.

The current Node test suite is run with `npm test`. It covers shared subject/course hierarchy logic, objective assessment scoring, and demo storage isolation/idempotency. Authenticated browser/API workflows require an authorized account and are not covered by this focused suite. Do not create fake student accounts or reset the database for tests.
