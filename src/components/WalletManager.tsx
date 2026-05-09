import { useState } from "react";
import { useWallets, Wallet, ALL_WALLETS } from "@/hooks/useWallets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Wallet as WalletIcon, Check } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
const CURRENCIES = ["USD", "THB", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "SGD", "HKD"];

function WalletForm({
  initial, onSubmit, onCancel, busy,
}: {
  initial?: Partial<Wallet>;
  onSubmit: (data: Omit<Wallet, "id" | "user_id" | "created_at" | "updated_at" | "icon">) => Promise<void> | void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [initBal, setInitBal] = useState(String(initial?.initial_balance ?? 0));
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Name required");
        onSubmit({
          name: name.trim(),
          currency,
          initial_balance: parseFloat(initBal) || 0,
          color,
          description: description.trim() || null,
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label>Wallet Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cash, Bank, Credit Card" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Initial Balance</Label>
          <Input type="number" step="any" value={initBal} onChange={(e) => setInitBal(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <div>
        <Label>Notes (optional)</Label>
        <Input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WalletManager({ trigger }: { trigger?: React.ReactNode }) {
  const { wallets, create, update, remove, activeId, setActiveId, balanceOf } = useWallets();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [confirmDel, setConfirmDel] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async (data: any) => {
    setBusy(true);
    try { await create(data); toast.success("Wallet created"); setCreateOpen(false); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };
  const handleUpdate = async (data: any) => {
    if (!editing) return;
    setBusy(true);
    try { await update(editing.id, data); toast.success("Updated"); setEditing(null); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!confirmDel) return;
    setBusy(true);
    try { await remove(confirmDel.id); toast.success("Deleted"); setConfirmDel(null); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" className="gap-2">
              <WalletIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Wallets</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WalletIcon className="h-4 w-4 text-primary" /> Manage Wallets
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            <button
              onClick={() => setActiveId(ALL_WALLETS)}
              className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-lg border transition ${
                activeId === ALL_WALLETS ? "border-primary bg-primary/10" : "border-border/40 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                <span className="font-medium text-sm">All Wallets</span>
              </div>
              {activeId === ALL_WALLETS && <Check className="h-4 w-4 text-primary" />}
            </button>

            {wallets.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">No wallets yet. Create one below.</p>
            )}

            {wallets.map((w) => (
              <div key={w.id} className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                activeId === w.id ? "border-primary bg-primary/10" : "border-border/40"
              }`}>
                <button onClick={() => setActiveId(w.id)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: w.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{w.name}</p>
                      <p className={`text-sm font-bold tabular-nums shrink-0 ${balanceOf(w.id) >= 0 ? "text-success" : "text-destructive"}`}>
                        {balanceOf(w.id).toLocaleString(undefined, { maximumFractionDigits: 2 })} {w.currency}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Initial {Number(w.initial_balance).toLocaleString()}
                      {w.description ? ` · ${w.description}` : ""}
                    </p>
                  </div>
                  {activeId === w.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(w)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(w)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setCreateOpen(true)} className="w-full gap-2" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
              <Plus className="h-4 w-4" /> New Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Wallet</DialogTitle></DialogHeader>
          <WalletForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} busy={busy} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Wallet</DialogTitle></DialogHeader>
          {editing && <WalletForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} busy={busy} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && !busy && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete wallet "{confirmDel?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Transactions inside this wallet will remain but become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
