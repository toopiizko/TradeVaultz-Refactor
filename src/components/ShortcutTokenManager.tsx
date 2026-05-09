import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/hooks/useWallets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Trash2, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const INGEST_URL = `${SUPABASE_URL}/functions/v1/ingest-slip`;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "tvz_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Row = { id: string; label: string; wallet_id: string | null; created_at: string; last_used_at: string | null };

export function ShortcutTokenManager() {
  const { user } = useAuth();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [label, setLabel] = useState("iPhone Shortcut");
  const [walletId, setWalletId] = useState<string>("none");
  const [newToken, setNewToken] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shortcut_tokens")
      .select("id, label, wallet_id, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data || []) as Row[]);
  };

  useEffect(() => { if (open) load(); }, [open, user]);

  const create = async () => {
    if (!user) return;
    const token = generateToken();
    const token_hash = await sha256Hex(token);
    const { error } = await supabase.from("shortcut_tokens").insert({
      user_id: user.id,
      label: label || "iOS Shortcut",
      token_hash,
      wallet_id: walletId === "none" ? null : walletId,
    });
    if (error) { toast.error(error.message); return; }
    setNewToken(token);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("shortcut_tokens").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Token revoked");
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setNewToken(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Smartphone className="h-4 w-4" />
          iOS Shortcut
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>iOS Shortcut Tokens</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {newToken && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">บันทึก token นี้ตอนนี้ — จะไม่แสดงอีก</p>
              <div className="flex gap-1.5">
                <Input readOnly value={newToken} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={() => copy(newToken)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="iPhone Shortcut" />
              </div>
              <div>
                <Label className="text-xs">Wallet (optional)</Label>
                <Select value={walletId} onValueChange={setWalletId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Default —</SelectItem>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" className="w-full gap-1.5" onClick={create}>
              <Plus className="h-3.5 w-3.5" /> Generate new token
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Active tokens</p>
            {rows.length === 0 && <p className="text-xs text-muted-foreground">No tokens yet.</p>}
            {rows.map((r) => {
              const w = wallets.find((x) => x.id === r.wallet_id);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {w ? w.name : "Default wallet"} · {r.last_used_at ? `Used ${new Date(r.last_used_at).toLocaleDateString()}` : "Never used"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
            <p className="font-semibold">📱 ตั้งค่า iOS Shortcut (ทำตามลำดับ)</p>
            <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
              <li>เปิดแอป <b>Shortcuts</b> → กด <b>+</b> สร้างใหม่</li>
              <li>กดไอคอน <b>(i)</b> ด้านล่าง → เปิด <b>Show in Share Sheet</b></li>
              <li>ที่ "Receive" เลือก <b>Images</b> เท่านั้น</li>
              <li>เพิ่ม action <b>Get Contents of URL</b>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  <li>URL: <code className="break-all bg-background px-1 rounded">{INGEST_URL}</code>
                    <Button size="sm" variant="ghost" className="h-5 px-1 ml-1" onClick={() => copy(INGEST_URL)}><Copy className="h-3 w-3" /></Button>
                  </li>
                  <li>Method: <b>POST</b></li>
                  <li>Headers → <code>Authorization</code> = <code>Bearer YOUR_TOKEN</code></li>
                  <li>Request Body: <b>Form</b> → Add new field, Type <b>File</b>, Key = <code>files</code>, Value = <b>Shortcut Input</b></li>
                </ul>
              </li>
              <li><b>สำคัญ:</b> เพิ่ม action <b>Show Notification</b> ต่อท้าย → Body = <b>Contents of URL</b> (ไม่งั้น Shortcut จะปิดไปเงียบๆ ทำให้คิดว่ามันเด้ง)</li>
              <li>ตั้งชื่อ "Save Slip" → Done</li>
              <li>ใช้งาน: แอปธนาคาร → แชร์รูป → เลือก Shortcut → รอ notification ✨</li>
            </ol>
            <p className="pt-1 text-amber-500">⚠️ ถ้า Shortcut เปิดมาแล้วปิดเอง = รันเสร็จแล้วแต่ไม่มี action แสดงผล ให้เพิ่ม <b>Show Notification</b> ตามข้อ 5</p>
            <p className="pt-1 text-muted-foreground/80">💡 ทดสอบด้วย curl:
              <br /><code className="text-[10px] break-all">curl -X POST {INGEST_URL} -H "Authorization: Bearer TOKEN" -F "files=@slip.jpg"</code>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
