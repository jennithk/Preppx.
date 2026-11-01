# PREPPX Build and Test Notes

This repository contains the React/Vite Student Portal, the shared entry dashboard, and a separate unified Management Portal backed by an Express/PostgreSQL API. It is not a frontend-only archive.

## Current validation

The commands available in `package.json` are:

```powershell
npm run typecheck
npm run typecheck:api
npm test
npm run build
```

The focused automated tests cover supported subjects and course-node hierarchy behavior. They do not authenticate to PostgreSQL, create student records, call optional external services, or exercise the full Management/Student browser workflows.

## Safe local testing

Use an existing authorized account for authenticated workflows. Do not run `npm run db:bootstrap` unless deliberately provisioning or updating Management credentials. Do not reset the database, create fake registered students, or print environment credentials. For API and UI workflow details, see [TESTING-CHECKLIST.md](./TESTING-CHECKLIST.md) and [docs/PREPPX_FINAL_AUDIT.md](./docs/PREPPX_FINAL_AUDIT.md).

Resend and private S3-compatible storage are optional local integrations; the relevant email and upload flows require them to be configured and were not tested without credentials.
