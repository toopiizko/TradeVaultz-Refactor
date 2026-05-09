import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency-context";
import { useCategorizeRules } from "@/hooks/useCategorizeRules";
import { useWallets, ALL_WALLETS } from "@/hooks/useWallets";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { compressImageBlob } from "@/lib/imageCompress";

// Receives images shared from other apps via PWA Web Share Target.
// SW stashes blobs in cache under /__share/<id>; this page reads them, runs OCR,
// and saves to the active wallet automatically (with a quick confirmation toast).
export default function Share() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rate, currency } = useCurrency();
  const { apply: applyRules } = useCategorizeRules();
  const { activeId } = useWallets();
  const [status, setStatus] = useState("Reading shared files…");

  useEffect(() => {
    const ids = (params.get("ids") || "").split(",").filter(Boolean);
    if (!ids.length) { setStatus("No shared files."); return; }
    (async () => {
      try {
        const cache = await caches.open("share-target-v1");
        const blobs: Blob[] = [];
        for (const id of ids) {
          const res = await cache.match(`/__share/${id}`);
          if (res) blobs.push(await res.blob());
          await cache.delete(`/__share/${id}`);
        }
        if (!blobs.length) { setStatus("Files expired. Try again."); return; }
        setStatus(`AI analyzing ${blobs.length} slip(s)…`);
        const dataUrls = await Promise.all(blobs.map(toDataUrl));
        const { data, error } = await supabase.functions.invoke("parse-slip", {
          body: { images: dataUrls, currencyHint: currency },
        });
        if (error) throw error;
        const slips = (data?.slips ?? []) as any[];
        const rows = slips.map((s) => {
          const cat = applyRules(s.description || s.merchant || "", s.type) || s.suggested_category || "Other";
          const amountUsd = (s.currency || "").toUpperCase() === "THB" ? s.amount / rate : s.amount;
          return {
            user_id: user!.id,
            type: s.type,
            amount: amountUsd,
            category: cat,
            description: s.description || s.merchant || null,
            expense_date: new Date(s.expense_date).toISOString(),
            ...(activeId !== ALL_WALLETS ? { wallet_id: activeId } as any : {}),
          };
        });
        const { data: inserted, error: insErr } = await supabase.from("expenses").insert(rows as any).select("id");
        if (insErr) throw insErr;
        // Compress + attach the shared image to each saved row
        for (let i = 0; i < blobs.length; i++) {
          const row = inserted?.[i];
          const blob = blobs[i];
          if (!row || !blob) continue;
          const { blob: small, ext } = await compressImageBlob(blob);
          const key = `${user!.id}/expense/${row.id}/${Date.now()}-slip.${ext}`;
          const up = await supabase.storage.from("transaction-images").upload(key, small, { contentType: small.type });
          if (!up.error) {
            await supabase.from("expenses").update({ image_urls: [key] } as any).eq("id", row.id);
          }
        }
        toast.success(`Saved ${rows.length} slip(s) from share`);
        navigate("/expenses", { replace: true });
      } catch (e: any) {
        setStatus(e?.message || "Failed to process shared files");
      }
    })();
  }, [params, user, currency, rate, activeId, applyRules, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-3 text-center">
      <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
        <Receipt className="h-6 w-6 text-primary-foreground" />
      </div>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground max-w-xs">{status}</p>
      <Button variant="ghost" size="sm" onClick={() => navigate("/expenses")}>Go to Expenses</Button>
    </div>
  );
}

function toDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}
