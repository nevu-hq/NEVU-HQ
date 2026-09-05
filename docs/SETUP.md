# NEVU HQ Setup

## 1. Supabase
Create a Supabase project. In SQL Editor, run `database/001_nevu_hq.sql` as one migration.

Then configure Authentication → Email. The app expects email/password signup and the verification OTP flow.

Create the private `nevu-files` storage bucket if the migration did not create it automatically.

## 2. Local development
```bash
npm install
cp .env.example .env.local
npm run dev
```

Set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never put the Supabase service-role key in a `NEXT_PUBLIC_` variable.

## 3. Render
Use a Render Web Service connected to this repository/package.

Build command:
```bash
npm install && npm run build
```

Start command:
```bash
npm start
```

Set the same public Supabase variables in Render. Set server-only secrets only where their adapters are actually enabled.

## 4. AI
The web application remains available when the local bridge computer is off. For browser-based free web sessions, run the bridge locally and configure `NEVU_BRIDGE_URL`/`NEVU_BRIDGE_SECRET`. For direct provider APIs, add the provider's server-side credentials using the adapter documented in `ai-bridge/README.md`.

## 5. AI availability when the computer is off
There are two paths. The Render application can call a server-side provider adapter when the corresponding server secret is configured. The local Playwright bridge is used when you want a logged-in web-session connector. If the bridge computer is off and no direct provider credentials are configured, NEVU itself still works but that browser-session provider is unavailable. This is intentional rather than pretending a free web account can be remotely controlled while its device is offline.
