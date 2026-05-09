import { useState } from "react";
import { Wallet as WalletIcon, Plus, Pencil, Trash2, Check, ChevronsUpDown, Layers } from "lucide-react";
import { useWallets, ALL_WALLETS, Wallet } from "@/hooks/useWallets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShortcutTokenManager } from "@/components/ShortcutTokenManager";

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

export function WalletSwitcher({ compact = false }: { compact?: boolean }) {
  const { wallets, activeId, setActiveId, active, create, update, remove } = useWallets();
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

  const triggerLabel = active?.name ?? "All Wallets";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className={`justify-between gap-2 ${compact ? "h-8 px-2 text-xs max-w-[160px]" : "w-full"}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {active ? (
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: active.color }} />
              ) : (
                <WalletIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-medium">{triggerLabel}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="p-2 border-b border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Wallets</p>
            <button
              onClick={() => { setActiveId(ALL_WALLETS); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-secondary/60 transition ${activeId === ALL_WALLETS ? "bg-secondary/40" : ""}`}
            >
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left font-medium">All Wallets</span>
              {activeId === ALL_WALLETS && <Check className="h-4 w-4 text-primary" />}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
            {wallets.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 px-2">
                No wallets yet. Create your first one.
              </p>
            )}
            {wallets.map((w) => (
              <div key={w.id}
                className={`group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition ${activeId === w.id ? "bg-secondary/40" : ""}`}>
                <button onClick={() => { setActiveId(w.id); setOpen(false); }}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: w.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{w.name}</p>
                    <p className="text-[10px] text-muted-foreground">{w.currency}</p>
                  </div>
                  {activeId === w.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditing(w); setOpen(false); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition" aria-label="Edit">
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmDel(w); setOpen(false); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition" aria-label="Delete">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-border/60 space-y-1">
            <Button size="sm" variant="ghost" className="w-full justify-start gap-2"
              onClick={() => { setCreateOpen(true); setOpen(false); }}>
              <Plus className="h-4 w-4" /> New Wallet
            </Button>
            <div onClick={() => setOpen(false)}>
              <ShortcutTokenManager />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><WalletIcon className="h-4 w-4" /> New Wallet</DialogTitle></DialogHeader>
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
