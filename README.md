# NEVU HQ — Unified Master System & Operating Framework

A clean rebuild of NEVU HQ designed for Render + Supabase, with Holding isolation, Sole Administrator authority, Holding Discussion Rooms, NEVU HQ Boardroom, Personal AI, portfolio/approval/archive foundations, realtime messaging, polls, voice notes, and a provider-agnostic AI orchestration layer.

## Important architecture decision
NEVU HQ does **not** depend on the Administrator's computer being online. The web application and database live on Render/Supabase. The optional local Playwright bridge is only for browser-based AI provider sessions.

## Quick start
```bash
npm install
cp .env.example .env.local
npm run dev
```

Then configure Supabase and run `database/001_nevu_hq.sql`.

See `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `ai-bridge/README.md`.
