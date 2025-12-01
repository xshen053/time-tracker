# Time Tracker Frontend (Vite + React)

Quick local frontend to call the infra API.

Getting started:

1. Install dependencies

```bash
cd frontend
npm install
```

2. Create `.env` from `.env.example` and set `VITE_API_ENDPOINT` to your API (or a local mock)

3. Run the dev server

```bash
npm run dev
```

Notes:
- The app reads `import.meta.env.VITE_API_ENDPOINT` at runtime.
- If you don't have a deployed infra yet, you can run a local mock server that implements `/log` and `/events` endpoints and set `VITE_API_ENDPOINT` to `http://localhost:3000`.
- This is a minimal template — I can add routing, auth, or a production build config if you want.
