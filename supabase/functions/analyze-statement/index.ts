// Analyze bank statement text with Lovable AI and return structured expense rows
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a financial statement parser specialized in Thai bank statements (SCB, KBank, BBL, Krungsri, TTB, GSB) and generic CSV/Excel transaction exports.

From the raw statement text, extract every individual transaction as a JSON row.

Rules:
- type: "income" if money received (deposit/credit/transfer-in/salary/refund), otherwise "expense".
- amount: positive number in the statement's currency (do not negate).
- category: choose ONE from this list based on description/memo.
  Income: ["Salary","Trading Profit","Investment","Freelance","Other"]
  Expense: ["Food","Transport","Housing","Bills","Shopping","Entertainment","Health","Education","Other"]
  If you are not sure, use "Other".
- description: short human readable memo derived from the row (merchant/counterparty/reference).
- expense_date: ISO date (YYYY-MM-DD). If only DD/MM is given, assume the year from context.
- Skip opening/closing balance rows, summaries, page headers.
- Do not invent transactions. If nothing found, return empty array.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, currencyHint } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Missing text" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Trim very large inputs to keep latency/cost reasonable
    const trimmed = text.length > 60000 ? text.slice(0, 60000) : text;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Currency hint: ${currencyHint ?? "unknown"}\n\nStatement:\n${trimmed}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_transactions",
          description: "Return extracted transactions",
          parameters: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["income", "expense"] },
                    amount: { type: "number" },
                    category: { type: "string" },
                    description: { type: "string" },
                    expense_date: { type: "string" },
                  },
                  required: ["type", "amount", "category", "description", "expense_date"],
                  additionalProperties: false,
                },
              },
            },
            required: ["transactions"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_transactions" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : { transactions: [] };
    return new Response(JSON.stringify({ transactions: args.transactions ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-statement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
