# Prompter

Prompter is a Node/Express application for running AI-assisted interview and prompt workflows. It includes a browser interview UI, an admin workspace for creating and managing interview templates, report generation, optional voice/video capture, gallery publishing, pricing hooks, and optional memory/search integrations.

Prompter currently powers [sayinterviews.com](https://sayinterviews.com).

This public tree is intentionally sanitized: it does not include the original Git history, local `.env` files, service account JSON, generated media, session backups, private planning docs, or one-off production cleanup scripts.

## Features

- Template-driven AI interviews with configurable prompts and report instructions
- Browser recording support for audio/video responses
- Admin and participant interfaces under `public/`
- Report, transcript, audio, and video artifact APIs
- Firebase Auth/Firestore integration for users, interviews, reports, and gallery data
- Optional Google Cloud Storage media storage
- Optional SendGrid/Gmail email delivery
- Optional Stripe subscriptions and interview purchases
- Optional Deepgram, Exa, mem0, Neo4j, and Qdrant integrations

## Stack

- Node.js 20+
- Express and Socket.IO
- Firebase Admin SDK and Firebase browser SDK
- OpenAI and Anthropic/Claude APIs
- Deepgram streaming/recording support
- FFmpeg for media processing
- Jest, Supertest, and Socket.IO client tests

## Repository Layout

- `server.js` - main Express/Socket.IO app. It is still the production entry point.
- `server/` - modularized routes, middleware, services, socket handlers, config, prompts, and utilities.
- `public/` - browser UI, static pages, CSS, and client-side modules.
- `tests/` and `server/tests/` - Jest test helpers and test suites.
- `memoryService.js`, `pricingService.js` - shared services used by the app.
- `firestore.rules` - Firestore security rules.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment config:

   ```bash
   cp .env.example .env
   ```

3. Fill in the providers you need. At minimum, most AI flows need:

   ```bash
   CLAUDE_API_KEY=your_claude_api_key
   OPENAI_API_KEY=your_openai_api_key
   SESSION_SECRET=your_long_random_session_secret
   ```

4. Configure Firebase.

   Server-side Firebase Admin credentials should be provided through `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SERVICE_ACCOUNT_BASE64`. For local development only, you can place an ignored `firebase-service-account.local.json` at the repo root.

   Browser Firebase config lives in `public/js/firebase-config.js`. Replace the placeholder values or set `window.PROMPTER_FIREBASE_CONFIG` before that script loads.

5. Start the app:

   ```bash
   npm run dev
   ```

   The default local URL is `http://localhost:3001`.

## Common Commands

```bash
npm start
npm run dev
npm test
npm run test:coverage
```

## Security

Do not commit `.env`, service account JSON, private keys, generated session backups, local media, or provider tokens. The `.gitignore` is set up to keep common secret and generated files out of Git.

If you are creating a public repository from an older private tree, use a fresh Git history as this copy does. Removing secret files from the latest commit is not enough if they existed in prior commits.

## Deployment

`railway.json`, `nixpacks.toml`, `Procfile`, and `vercel.json` are included as starting points. Production deploys should use environment variables or secret managers for all credentials.

## License

ISC
