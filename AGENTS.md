# Agent Guide

## Project Shape

Prompter is a Node.js 20 Express app with Socket.IO. `server.js` is still the production entry point and contains substantial legacy logic. Newer code is gradually moving into `server/` modules.

Primary areas:

- `server.js` - main app, routes, socket bootstrapping, Firebase/GCS setup, and legacy interview/report workflows.
- `server/routes/` - extracted route modules for Gmail OAuth, document processing, website scraping, uploads, campaigns, and context strings.
- `server/utils/` - audio, video, report generation, file processing, streaming TTS, media queue, and question generation helpers.
- `server/middleware/` - auth, validation, and rate limiting.
- `public/` - static HTML/CSS/client JavaScript for the admin, interview, report, gallery, pricing, and studio surfaces.
- `tests/` and `server/tests/` - Jest tests and shared test utilities.

## Development Commands

```bash
npm install
npm run dev
npm start
npm test
npm run test:coverage
```

Use `npm test -- --runInBand` when debugging flaky integration tests.

## Configuration

Never commit real credentials. Use `.env` locally and deployment secrets in production. See `.env.example` for supported variables.

Accepted local credential files are intentionally gitignored:

- `firebase-service-account.local.json`
- `google-cloud-credentials.local.json`

Prefer environment variables for shared or deployed environments:

- `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `GOOGLE_CLOUD_CREDENTIALS` or `GOOGLE_CLOUD_CREDENTIALS_BASE64`

## Coding Guidelines

- Keep changes scoped. This codebase has legacy paths and duplicate client behavior; avoid broad rewrites unless the task explicitly requires them.
- When touching `server.js`, extract only the related logic into `server/` if it reduces risk or duplication. Do not attempt a full monolith refactor in one pass.
- Check both `public/admin.js` and the relevant `public/js/` modules when changing shared admin/interview behavior.
- Keep provider integrations optional where practical. Missing optional keys should disable that feature, not prevent the server from starting.
- Do not add real project IDs, API keys, service account files, private URLs, personal emails, generated media, or production cleanup scripts.
- Add or update focused tests when changing routes, shared utilities, socket behavior, billing, auth, or media workflows.

## Security Checklist

Before committing:

1. Run a secret scan or at least search for common token patterns.
2. Confirm `git status --short` does not include `.env`, credential JSON, logs, generated media, or backups.
3. Confirm new docs use placeholders that do not look like real provider tokens.
4. Confirm deployment config references environment variables rather than inline secrets.
