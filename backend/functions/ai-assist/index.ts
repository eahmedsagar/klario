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
    model: MODEL_FAST, maxTokens: 300,
    system: `Classify a personal health diary note. Systems: Cardiovascular, Blood, Inflammation, Liver,
Kidneys, Metabolic, Thyroid, Brain & Nerves, Lungs, Musculoskeletal, Other.
Return ONLY JSON: {"sysTag":string,"isReminder":boolean,"reminderTitle":string|null,
"dueInMonths":number|null,"autoMeta":string|null}`,
    user: p.text.slice(0, 2000),
  }),
};

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
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
