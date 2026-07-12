// Klario ai-assist Edge Function
// Deploy:  supabase functions deploy ai-assist --no-verify-jwt=false
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// LLM as writer & fallback, never as judge: clinical statuses are computed
// client-side by code; this function only (a) rescues unparseable documents
// into strict JSON, (b) writes prose from already-computed facts, (c) tags notes.

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL_FAST = "claude-haiku-4-5";      // parse fallback, tagging
const MODEL_SMART = "claude-sonnet-5";      // doctor summary, insight prose

const PROMPTS: Record<string, (p: any) => { system: string; user: string; model: string; maxTokens: number }> = {
  parse: (p) => ({
    model: MODEL_FAST, maxTokens: 2000,
    system: `You extract lab results from raw report text. Return ONLY JSON matching:
{"name":string|null,"dob":"YYYY-MM-DD"|null,"collected":"YYYY-MM-DD"|null,"clinic":string|null,
 "values":[{"marker":string,"value":number,"unit":string|null,"refLo":number|null,"refHi":number|null}]}
Rules: marker = the canonical analyte name as printed; never invent values; skip anything ambiguous;
numbers only in value/refLo/refHi; if a reference is "< X" set refHi=X, "> X" set refLo=X.`,
    user: p.text.slice(0, 24000),
  }),
  narrate: (p) => ({
    model: MODEL_SMART, maxTokens: 1200,
    system: `You write short, warm, plain-language health narration for a lab-tracking app.
You are given COMPUTED facts (statuses already decided by code). Never change a status,
never diagnose, never prescribe. British English. Return ONLY JSON:
{"systemSummaries":{"<systemId>":"1-2 sentences"},"insightBodies":{"<insightIdx>":"2-3 sentences"},
 "doctorParagraph":"3-4 sentences for the 'Needs attention' preamble of a doctor summary"}`,
    user: JSON.stringify(p.facts),
  }),
  tag: (p) => ({
    model: MODEL_FAST, maxTokens: 400,
    system: `Classify a personal health diary note (it may be dictated speech, so tolerate rambling/filler).
Systems: Cardiovascular, Blood, Inflammation, Liver, Kidneys, Metabolic, Thyroid, Brain & Nerves, Lungs, Musculoskeletal, Other.
"kind" is one of: symptom, pain, medication, appointment, measurement, reminder, note.
If the note implies a future action (recheck, book, appointment, take/refill meds, follow-up), set isReminder=true, write a short reminderTitle, and set dueISO to the best YYYY-MM-DD date. Resolve relative dates ("next Tuesday", "in 3 months", "tomorrow") against TODAY (given). If only a rough horizon is known, also give dueInMonths.
Clean the note into a tidy one-line "autoMeta" summary. Never diagnose or prescribe.
Return ONLY JSON: {"sysTag":string,"kind":string,"isReminder":boolean,"reminderTitle":string|null,
"dueISO":"YYYY-MM-DD"|null,"dueInMonths":number|null,"autoMeta":string|null}`,
    user: JSON.stringify({ today: p.today || null, note: String(p.text || "").slice(0, 2000) }),
  }),
  ask: (p) => ({
    model: MODEL_SMART, maxTokens: 900,
    system: `You are Klario, a calm, plain-language health companion. Answer the user's question using ONLY the DATA provided (their own lab results, computed statuses, trends and diary notes).
Hard rules: never invent values, dates or facts that are not in the data; if the data doesn't contain the answer, say so plainly; the clinical statuses in the data were decided by code — do not overrule them; NEVER diagnose, prescribe, or give personalised medical advice — explain what the numbers mean and suggest discussing specifics with their doctor; be warm and concise (2-6 sentences); British English.
Return ONLY JSON: {"answer": string, "sources": [string]} where each source names a specific reading or note you relied on, e.g. "LDL Cholesterol · Randox · 1 Apr 2026".`,
    user: JSON.stringify({ question: String(p.question || "").slice(0, 800), data: p.data }),
  }),
};

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    // must include x-client-info / x-supabase-api-version that supabase-js adds, or the
    // browser blocks the request at preflight ("Failed to send a request to the Edge Function")
    "Access-Control-Allow-Headers": "*, authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // require a signed-in user
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorised" }), { status: 401, headers: cors });

  const { task, payload } = await req.json();
  const spec = PROMPTS[task]?.(payload);
  if (!spec) return new Response(JSON.stringify({ error: "unknown task" }), { status: 400, headers: cors });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: spec.model, max_tokens: spec.maxTokens,
      system: spec.system,
      messages: [{ role: "user", content: spec.user }],
    }),
  });
  if (!r.ok) {
    const errBody = await r.text();
    console.error(`anthropic ${r.status} for task=${task} model=${spec.model}: ${errBody.slice(0, 500)}`);
    return new Response(JSON.stringify({ error: "upstream", status: r.status, detail: errBody.slice(0, 300) }), { status: 502, headers: cors });
  }
  const j = await r.json();
  const text = j?.content?.[0]?.text ?? "";
  if (!text) console.error(`anthropic empty text for task=${task}: ${JSON.stringify(j).slice(0, 300)}`);
  // hard JSON validation — refuse to pass through non-JSON
  let out: unknown;
  try { out = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); }
  catch { return new Response(JSON.stringify({ error: "model returned non-JSON" }), { status: 502, headers: cors }); }
  return new Response(JSON.stringify(out), { headers: { ...cors, "content-type": "application/json" } });
});
