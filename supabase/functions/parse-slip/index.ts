// Parse bank transfer slip images with Lovable AI (Gemini Vision)
// Accepts: { images: string[] (data URLs or base64), currencyHint?: "USD"|"THB" }
// Returns: { slips: ParsedSlip[] }
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a bank transfer slip / receipt parser specialized in Thai banks (SCB, KBank, BBL, Krungsri, TTB, GSB, KTB, TrueMoney, PromptPay) and generic receipts.

From each slip image, extract these fields:

- type: "expense" if money LEAVES the user's account (transfer-out, payment, withdraw, purchase). "income" if money ENTERS (transfer-in, deposit, refund, salary).
  When ambiguous (a transfer slip without clear direction), assume "expense".
- amount: positive number, the transaction amount in the slip's currency.
- currency: "THB" or "USD" (or detected currency code). Default "THB" for Thai bank slips.
- expense_date: ISO date YYYY-MM-DD. If only DD/MM, use the year from context (assume current year if missing).
- merchant: the counterparty name (recipient for expense, sender for income). Short human readable.
- description: brief memo combining merchant + reference/note from the slip.
- suggested_category: choose ONE based on merchant/description.
  Expense: "Food","Transport","Housing","Bills","Shopping","Entertainment","Health","Education","Other"
  Income: "Salary","Trading Profit","Investment","Freelance","Other"
- confidence: 0..1 — how sure you are this is a real slip.

If the image is NOT a bank slip/receipt, set confidence < 0.3 and best-effort fill the rest.
Return one entry per image.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { images, currencyHint } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "images[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (images.length > 5) {
      return new Response(JSON.stringify({ error: "max 5 images per request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build multimodal user message with all images
    const userContent: any[] = [
      { type: "text", text: `Currency hint: ${currencyHint ?? "THB"}\nExtract one slip per image. Return via the tool.` },
      ...images.map((img: string) => ({
        type: "image_url",
        image_url: { url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}` },
      })),
    ];

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_slips",
          description: "Return parsed slip data, one entry per input image.",
          parameters: {
            type: "object",
            properties: {
              slips: {
                type: "array",
                items: {
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
            },
            required: ["slips"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_slips" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { slips: [] };
    return new Response(JSON.stringify({ slips: args.slips ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-slip error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
