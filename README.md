# Klario — real app (v0.2)

This is a working app, not a mockup. Everything is stored on the device (IndexedDB); nothing leaves your phone.

## What works
- Onboarding (name, DOB, sex) — creates your profile locally
- Scan flow: pick one or MANY lab PDFs → Klario extracts every value, the lab's own reference ranges, patient name, DOB and collection date
- New family members auto-created from the name+DOB on their report (one tap: relationship)
- Body map, Tiles, Insights, Trends, Reports (with the original PDF viewable), Diary (+ auto reminders), Summary for Doctor (Share/Save as PDF), dark + pastel light themes
- Installable on iPhone: Safari → Share → Add to Home Screen (runs full-screen, works offline after first load)

## Cloud & AI (new in v0.2 — optional)
Out of the box the app is local-only. To enable accounts, cross-device sync, backup and AI:
follow **backend/SETUP.md** (~10 min: free Supabase project + paste 2 keys into config.js).
You get: Google SSO + email magic-link sign-in · Postgres with row-level security ·
original PDFs in private Storage · offline-first sync (last-write-wins) ·
and the ai-assist Edge Function (Anthropic key as server secret) which rescues
unparseable PDFs, writes richer insight/summary prose, and smart-tags diary notes.

## Not yet (honest list)
- Photo OCR (photos are politely declined — use PDFs)
- Wearables / Apple Health (native), WhatsApp reminder delivery (scheduled Edge Function + Meta API — next), family member logins (household invites — next)

## Host it (2 minutes)
Zip nothing — upload this whole folder to:
- Netlify Drop (app.netlify.com/drop) — drag the folder in, done, or
- tiiny.site — zip the folder first, upload the zip.
Then open the URL on your iPhone → Share → Add to Home Screen.

## Files
index.html (the app) · pdf.min.js + pdf.worker.min.js (PDF engine, local/offline)
manifest.json, sw.js, icon-*.png (PWA) · Randox_Jun2026_sample.pdf (try scanning this first)
