import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCategoriesDB } from "@/hooks/useCategoriesDB";
import { useWallets, ALL_WALLETS } from "@/hooks/useWallets";
import { useCategorizeRules } from "@/hooks/useCategorizeRules";
import { useCurrency } from "@/lib/currency-context";
import { compressDataUrl } from "@/lib/imageCompress";

const MAX_SLIPS = 10; // BUG FIX 4: was hard-coded to 5, now clearly defined

type Slip = {
  type: "income" | "expense";
  amount: number;
  currency: string;
  expense_date: string;
  merchant: string;
  description: string;
  suggested_category: string;
  confidence: number;
  _userChangedCategory?: boolean;
  _selected: boolean;
  _previewUrl: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export function SlipUploader({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const { expense: expenseCats, income: incomeCats } = useCategoriesDB();
  const { wallets, activeId: activeWalletId } = useWallets();
  const { rate, currency: appCurrency } = useCurrency();
  const { apply: applyRules, add: addRule } = useCategorizeRules();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [walletId, setWalletId] = useState<string>(
    activeWalletId !== ALL_WALLETS ? activeWalletId : ""
  );

  // BUG FIX 5: use a ref for the hidden input so it can be triggered programmatically
  // and reset properly between uploads
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_SLIPS);
    e.target.value = ""; // reset so same files can be re-selected
    if (!files.length) return;

    setOpen(true);
    setBusy(true);

    try {
      // BUG FIX 6: convert all files to data URLs in parallel
      const dataUrls = await Promise.all(files.map(fileToDataUrl));

      toast.info(`AI กำลังวิเคราะห์ ${files.length} สลิป…`);

      const { data, error } = await supabase.functions.invoke("parse-slip", {
        body: { images: dataUrls, currencyHint: appCurrency },
      });

      if (error) throw error;

      // BUG FIX 7: handle case where AI returns fewer results than uploaded files
      const parsed = (data?.slips ?? []) as Slip[];

      if (parsed.length === 0) {
        toast.warning("AI ไม่สามารถอ่านสลิปได้ กรุณาลองใหม่อีกครั้ง");
        setOpen(false);
        return;
      }

      if (parsed.length < files.length) {
        toast.warning(`อ่านได้ ${parsed.length} จาก ${files.length} สลิป`);
      }

      const enriched = parsed.map((s, i) => {
        const ruled = applyRules(s.description || s.merchant || "", s.type);
        return {
          ...s,
          // Ensure date is always valid
          expense_date: s.expense_date && !isNaN(new Date(s.expense_date).getTime())
            ? s.expense_date
            : new Date().toISOString().slice(0, 10),
          suggested_category: ruled || s.suggested_category || "Other",
          _selected: true,
          _previewUrl: dataUrls[i] ?? "",
        };
      });

      setSlips(enriched);
      toast.success(`อ่านสลิปสำเร็จ ${enriched.length} รายการ`);
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "ไม่สามารถอ่านสลิปได้");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Slip>) =>
    setSlips((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    if (!user) return;
    const picked = slips.filter((s) => s._selected);
    if (!picked.length) return toast.error("ไม่มีรายการที่เลือก");

    setBusy(true);
    try {
      const rows = picked.map((s) => {
        // BUG FIX 8: handle currency conversion properly — don't assume THB only
        const slipCurrency = (s.currency || "").toUpperCase();
        const amountUsd = slipCurrency === "THB" ? s.amount / rate : s.amount;
        return {
          user_id: user.id,
          type: s.type,
          amount: amountUsd,
          category: s.suggested_category,
          description: s.description || s.merchant || null,
          expense_date: new Date(s.expense_date).toISOString(),
          ...(walletId ? { wallet_id: walletId } as any : {}),
        };
      });

      const { data: inserted, error } = await supabase
        .from("expenses")
        .insert(rows as any)
        .select("id");
      if (error) throw error;

      // Upload compressed slip images in parallel (not sequentially)
      await Promise.all(
        picked.map(async (s, i) => {
          const row = inserted?.[i];
          if (!row || !s._previewUrl) return;
          try {
            const { blob, ext } = await compressDataUrl(s._previewUrl);
            const key = `${user.id}/expense/${row.id}/${Date.now()}-slip.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("transaction-images")
              .upload(key, blob, { contentType: blob.type, upsert: false });
            if (upErr) { console.warn("slip upload failed", upErr); return; }
            await supabase.from("expenses").update({ image_urls: [key] } as any).eq("id", row.id);
          } catch (e) { console.warn("slip image upload error", e); }
        })
      );

      // Auto-learn category rules from user corrections
      await Promise.all(
        picked.map(async (s) => {
          if (!s._userChangedCategory) return;
          const keyword = (s.merchant || "").trim().split(/\s+/).slice(0, 3).join(" ");
          if (keyword.length < 3) return;
          try {
            await addRule({
              match_type: "keyword",
              pattern: keyword,
              category: s.suggested_category,
              transaction_type: s.type,
              priority: 10,
            });
          } catch { /* ignore duplicate rules */ }
        })
      );

      toast.success(`บันทึกสำเร็จ ${rows.length} รายการ`);
      setSlips([]);
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = slips.filter((s) => s._selected).length;

  return (
    <>
      {trigger ?? (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 relative overflow-hidden"
          onClick={() => inputRef.current?.click()}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Slip</span>
        </Button>
      )}

      {/* Hidden file input — separate from button for reliable multi-file support */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePick}
        className="hidden"
        aria-label="Upload slip images"
      />

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o && !busy) { setOpen(false); setSlips([]); }
          else setOpen(o);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> ตรวจสอบสลิป
            </DialogTitle>
          </DialogHeader>

          {busy && slips.length === 0 && (
            <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">AI กำลังอ่านสลิป…</p>
            </div>
          )}

          {slips.length > 0 && (
            <div className="space-y-3">
              {/* Wallet selector */}
              <div>
                <Label>บันทึกเข้ากระเป๋า</Label>
                <Select value={walletId || "none"} onValueChange={(v) => setWalletId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="ไม่ระบุกระเป๋า" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ไม่ระบุกระเป๋า</SelectItem>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: w.color }} />
                          {w.name} ({w.currency})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Slip cards */}
              {slips.map((s, i) => {
                const cats = s.type === "income" ? incomeCats : expenseCats;
                return (
                  <div key={i} className="rounded-lg border border-border/60 p-3 space-y-2 bg-secondary/30">
                    <div className="flex items-start gap-3">
                      {s._previewUrl && (
                        <img
                          src={s._previewUrl}
                          alt="slip"
                          className="h-20 w-20 rounded object-cover border border-border shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={s._selected}
                              onChange={(e) => update(i, { _selected: e.target.checked })}
                              className="rounded"
                            />
                            <span className="text-sm font-semibold truncate">{s.merchant || "—"}</span>
                          </label>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {(s.confidence * 100).toFixed(0)}% conf
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px]">ประเภท</Label>
                        <Select value={s.type} onValueChange={(v: "income" | "expense") => update(i, { type: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="expense">รายจ่าย</SelectItem>
                            <SelectItem value="income">รายรับ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px]">จำนวน ({s.currency || "THB"})</Label>
                        <Input
                          className="h-8" type="number" step="any" value={s.amount}
                          onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">วันที่</Label>
                        <Input
                          className="h-8" type="date" value={s.expense_date.slice(0, 10)}
                          onChange={(e) => update(i, { expense_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">หมวดหมู่</Label>
                        <Select
                          value={s.suggested_category}
                          onValueChange={(v) => update(i, { suggested_category: v, _userChangedCategory: true })}
                        >
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-destructive"
                        onClick={() => setSlips((p) => p.filter((_, x) => x !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> ลบ
                      </Button>
                    </div>
                  </div>
                );
              })}

              <p className="text-[11px] text-muted-foreground">
                💡 ถ้าเปลี่ยนหมวดหมู่ ระบบจะจำอัตโนมัติสำหรับร้านนี้ในครั้งหน้า
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setSlips([]); }} disabled={busy}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={busy || selectedCount === 0}
              style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
            >
              {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />กำลังบันทึก…</> : `บันทึก ${selectedCount} รายการ`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
