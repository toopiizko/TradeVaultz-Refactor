import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Plus, Pencil, Trash2, Check, ChevronsUpDown, Layers, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePortfolio, ALL_PORTFOLIOS, Portfolio } from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "THB", symbol: "฿" },
  { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" },
  { code: "CHF", symbol: "Fr" },
  { code: "SGD", symbol: "S$" },
  { code: "HKD", symbol: "HK$" },
];

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function PortfolioForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Partial<Portfolio>;
  onSubmit: (data: { name: string; currency: string; initial_balance: number; color: string; description: string | null }) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [initialBalance, setInitialBalance] = useState(String(initial?.initial_balance ?? 0));
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error("Name is required");
        onSubmit({
          name: name.trim(),
          currency,
          initial_balance: parseFloat(initialBalance) || 0,
          color,
          description: description.trim() || null,
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label>Portfolio Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main, Prop Firm, Demo" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.code} — {c.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Initial Balance</Label>
          <Input type="number" step="any" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Notes about this portfolio…" />
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PortfolioSwitcher({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { portfolios, activeId, setActiveId, activePortfolio, refresh } = usePortfolio();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [confirmDel, setConfirmDel] = useState<Portfolio | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (data: any) => {
    if (!user) return;
    setSubmitting(true);
    const { data: created, error } = await supabase
      .from("portfolios")
      .insert({ ...data, user_id: user.id })
      .select()
      .single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Portfolio "${data.name}" created`);
    await refresh();
    if (created) setActiveId((created as Portfolio).id);
    setCreateOpen(false);
  };

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    setSubmitting(true);
    const { error } = await supabase.from("portfolios").update(data).eq("id", editing.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Portfolio updated");
    await refresh();
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setSubmitting(true);
    const { error } = await supabase.from("portfolios").delete().eq("id", confirmDel.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted "${confirmDel.name}"`);
    if (activeId === confirmDel.id) setActiveId(ALL_PORTFOLIOS);
    await refresh();
    setConfirmDel(null);
  };

  const triggerLabel = activePortfolio?.name ?? "All Portfolios";
  const triggerColor = activePortfolio?.color;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className={`justify-between gap-2 ${compact ? "h-8 px-2 text-xs max-w-[140px]" : "w-full"}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {triggerColor ? (
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: triggerColor }} />
              ) : (
                <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-medium">{triggerLabel}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0">
          <div className="p-2 border-b border-border/60">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">Portfolios</p>
            <button
              onClick={() => { setActiveId(ALL_PORTFOLIOS); setPopoverOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-secondary/60 transition-colors ${activeId === ALL_PORTFOLIOS ? "bg-secondary/40" : ""}`}
            >
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left font-medium">All Portfolios</span>
              {activeId === ALL_PORTFOLIOS && <Check className="h-4 w-4 text-primary" />}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
            {portfolios.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 px-2">
                No portfolios yet. Create your first one to organize trades.
              </p>
            )}
            {portfolios.map((p) => (
              <div
                key={p.id}
                className={`group flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors ${activeId === p.id ? "bg-secondary/40" : ""}`}
              >
                <button
                  onClick={() => { setActiveId(p.id); setPopoverOpen(false); }}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.currency}</p>
                  </div>
                  {activeId === p.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(p); setPopoverOpen(false); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                  aria-label="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(p); setPopoverOpen(false); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-border/60 space-y-1">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => { setCreateOpen(true); setPopoverOpen(false); }}
            >
              <Plus className="h-4 w-4" /> New Portfolio
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start gap-2"
              asChild
              onClick={() => setPopoverOpen(false)}
            >
              <Link to="/portfolios"><Settings className="h-4 w-4" /> Manage portfolios</Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> New Portfolio
            </DialogTitle>
          </DialogHeader>
          <PortfolioForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} submitting={submitting} />
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Portfolio</DialogTitle>
          </DialogHeader>
          {editing && (
            <PortfolioForm
              initial={editing}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && !submitting && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete portfolio "{confirmDel?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The portfolio will be removed. Trades inside it will not be deleted but will be moved to "Unassigned" (no portfolio).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
