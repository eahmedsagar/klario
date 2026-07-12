# Klario backend — 10-minute setup

## 1. Create the project (3 min)
1. supabase.com → Start your project → sign in with GitHub/Google (free).
2. New project → name "klario" → **Region: London (eu-west-2)** (UK GDPR) → generate a strong DB password (save it) → Create.

## 2. Database (2 min)
3. Left menu → SQL Editor → New query → paste ALL of `schema.sql` → Run.
4. New query → paste ALL of `policies.sql` → Run.  ✅ Every row is now owner-only, enforced in the database.

## 3. Sign-in (2 min)
5. Authentication → Providers → **Google** → Enable. Follow the inline link to create the (free) Google OAuth client; paste client ID + secret.
6. Authentication → URL Configuration → set **Site URL** to your app's URL (your Netlify/tiiny address). Add the same to Redirect URLs.
7. (Email magic-link works out of the box — no config.)
8. (Optional, later) **Apple** sign-in needs an Apple Developer account ($99/yr) — steps are in the same Providers page.

## 4. Keys → app (1 min)
9. Project Settings → API → copy **Project URL** and **anon public** key into `config.js`.
10. Re-upload the app folder to your host. Done — the app now shows "Sign in" and syncs.

## 5. AI features (optional, 2 min)
11. Install the Supabase CLI (or use Dashboard → Edge Functions → New) and deploy `functions/ai-assist`.
    CLI: `supabase functions deploy ai-assist`
12. Get an Anthropic API key at console.anthropic.com → in Supabase:
    `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
    (Dashboard: Edge Functions → ai-assist → Secrets.)
13. That's it. The app automatically: rescues PDFs the local parser can't read,
    writes richer insight/summary prose, and smart-tags diary notes.
    Cost: fractions of a penny per report (Haiku) / per summary (Sonnet).

## What syncs
members, reports (PDFs go to private Storage), readings, notes, reminders.
Offline-first: the phone keeps working with no connection; changes push when back online.
Conflict rule: last write wins (per record, by updated_at).

## Roadmap notes (not built yet)
- Family logins (invite Shezah to her own sign-in, shared household) — needs a households table + invite flow.
- WhatsApp reminders — a scheduled Edge Function + Meta WhatsApp Business API.
- Photo OCR — route photos through ai-assist with vision.
