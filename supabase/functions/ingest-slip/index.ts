// Accepts one or many slip images from iOS Shortcut (or curl).
// - Validates Bearer token
// - Reads images from multipart/form-data (any field) OR raw image body OR JSON {images:[dataUrl,...]}
// - Server-side compress via imagescript (resize longest edge → 1600px, JPEG q80)
// - For each image: call Lovable AI to parse → insert expense → upload original to storage
// - Returns { ok, count, results: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are a Thai bank transfer slip / receipt parser (SCB, KBank, BBL, Krungsri, TTB, GSB, KTB, TrueMoney, PromptPay) and generic receipts.
Return ONE slip per image. Default currency is THB unless explicitly shown otherwise.
For suggested_category, pick a short common Thai-life category in English: Food, Transport, Shopping, Bills, Utilities, Entertainment, Health, Education, Transfer, Salary, Other.`;

const FALLBACK_USD_THB = 35;

type ImgIn = { bytes: Uint8Array; type: string; name: string };

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

function dataUrlToBytes(dataUrl: string): ImgIn | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return { bytes: bin, type: m[1], name: "slip.jpg" };
}

async function readImages(req: Request): Promise<ImgIn[]> {
  const ct = req.headers.get("content-type") || "";
  const out: ImgIn[] = [];
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [, v] of form.entries()) {
      if (v instanceof File && v.size > 0 && (v.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(v.name))) {
        out.push({ bytes: new Uint8Array(await v.arrayBuffer()), type: v.type || "image/jpeg", name: v.name || "slip.jpg" });
      }
    }
    return out;
  }
  if (ct.startsWith("image/")) {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length) out.push({ bytes: buf, type: ct, name: "slip.jpg" });
    return out;
  }
  if (ct.includes("application/json")) {
    const j = await req.json().catch(() => null) as any;
    const arr: string[] = j?.images || (j?.image ? [j.image] : []);
    for (const u of arr) { const b = dataUrlToBytes(u); if (b) out.push(b); }
  }
  return out;
}

async function compress(input: ImgIn, maxEdge = 1600, quality = 80): Promise<ImgIn> {
  try {
    const img = await decode(input.bytes);
    if (!(img instanceof Image)) return input;
    const w0 = img.width, h0 = img.height;
    const scale = Math.min(1, maxEdge / Math.max(w0, h0));
    if (scale < 1) img.resize(Math.round(w0 * scale), Math.round(h0 * scale));
    const out = await img.encodeJPEG(quality);
    if (out.byteLength >= input.bytes.byteLength && /jpe?g/i.test(input.type)) return input;
    return { bytes: out, type: "image/jpeg", name: input.name.replace(/\.\w+$/, "") + ".jpg" };
  } catch (e) {
    console.warn("compress failed", e);
    return input;
  }
}

async function parseSlip(LOVABLE_API_KEY: string, img: ImgIn) {
  const dataUrl = `data:${img.type};base64,${bytesToBase64(img.bytes)}`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: [
          { type: "text", text: "Extract this slip. Default currency THB." },
          { type: "image_url", image_url: { url: dataUrl } },
        ]},
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_slip",
          description: "Return parsed slip",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["income", "expense"] },
              amount: { type: "number" },
              currency: { type: "string" },
              expense_date: { type: "string" },
              merchant: { type: "string" },
              description: { type: "string" },
              suggested_category: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["type", "amount", "currency", "expense_date", "merchant", "description", "suggested_category", "confidence"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_slip" } },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI ${resp.status}: ${t.slice(0, 200)}`);
  }
  const j = await resp.json();
  const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : null;
}

async function getUsdThbRate(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    const rate = j?.rates?.THB;
    return typeof rate === "number" ? rate : FALLBACK_USD_THB;
  } catch { return FALLBACK_USD_THB; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  try {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return new Response(JSON.stringify({ error: "Missing Bearer token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const tokenHash = await sha256Hex(token);
    const { data: tokRow, error: tokErr } = await admin
      .from("shortcut_tokens").select("id, user_id, wallet_id").eq("token_hash", tokenHash).maybeSingle();
    if (tokErr || !tokRow) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const imgs = await readImages(req);
    if (!imgs.length) {
      return new Response(JSON.stringify({ error: "No image found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const usdThb = await getUsdThbRate();
    const results: any[] = [];

    for (const original of imgs) {
      try {
        const compressed = await compress(original);
        const slip = await parseSlip(LOVABLE_API_KEY, compressed);
        if (!slip) { results.push({ ok: false, error: "parse_failed" }); continue; }

        const rawAmount = Number(slip.amount) || 0;
        const cur = String(slip.currency || "THB").toUpperCase();
        // Store in USD base (matches Expenses.handleAdd behavior)
        const amountUsd = cur === "THB" ? rawAmount / usdThb : rawAmount;

        const { data: inserted, error: insErr } = await admin.from("expenses").insert({
          user_id: tokRow.user_id,
          type: slip.type === "income" ? "income" : "expense",
          amount: amountUsd,
          category: slip.suggested_category || "Other",
          description: slip.description || slip.merchant || null,
          expense_date: new Date(slip.expense_date || Date.now()).toISOString(),
          ...(tokRow.wallet_id ? { wallet_id: tokRow.wallet_id } : {}),
        }).select("id").single();
        if (insErr || !inserted) { results.push({ ok: false, error: insErr?.message || "insert_failed" }); continue; }

        const ext = "jpg";
        const key = `${tokRow.user_id}/expense/${inserted.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await admin.storage.from("transaction-images").upload(key, compressed.bytes, { contentType: compressed.type, upsert: false });
        if (!up.error) await admin.from("expenses").update({ image_urls: [key] }).eq("id", inserted.id);

        results.push({ ok: true, id: inserted.id, slip, original_bytes: original.bytes.byteLength, compressed_bytes: compressed.bytes.byteLength, amount_usd: amountUsd, raw_amount: rawAmount, currency: cur });
      } catch (e) {
        console.error("slip error", e);
        results.push({ ok: false, error: e instanceof Error ? e.message : "unknown" });
      }
    }

    await admin.from("shortcut_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokRow.id);

    const okCount = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ ok: okCount > 0, count: imgs.length, ok_count: okCount, usd_thb: usdThb, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-slip error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
