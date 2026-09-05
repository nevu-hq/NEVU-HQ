# NEVU HQ Local AI Bridge

This is an **optional connector**, not the NEVU platform itself. NEVU HQ remains available on Render/Supabase when this computer is off.

## Install
From the project root:
```bash
cd ai-bridge
npm install
npx playwright install chromium
cp .env.example .env
```

Set a long `NEVU_BRIDGE_SECRET` and use the same value in the Render environment plus `NEVU_BRIDGE_URL` pointing at a securely reachable bridge endpoint. For local-only development, keep the bridge on `127.0.0.1`.

## First login
Run with `NEVU_BRIDGE_HEADLESS=false`:
```bash
npm run dev
```
Open/use the provider browser window and manually log in. The persistent profile is stored under `ai-bridge/profiles/<provider>`.

Supported browser connectors:
- ChatGPT
- Claude
- Gemini
- Grok
- Llama / Hugging Face

Provider websites can change their UI. Selectors are isolated in `src/index.ts` so a provider change does not require changing the NEVU application.

## Security
Do not expose a browser profile directory, bridge secret, cookies, or provider sessions to GitHub or public hosting. Do not run a personal logged-in browser profile on an untrusted machine.
