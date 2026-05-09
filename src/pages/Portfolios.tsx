import { useMemo, useState } from "react";
import { Briefcase, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Hash, Target, Layers } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePortfolio, Portfolio, ALL_PORTFOLIOS } from "@/lib/portfolio";
import { useTrades } from "@/hooks/useTrades";
import { toast } from "sonner";

const CURRENCIES = [
  { code: "USD", symbol: "$" }, { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" }, { code: "THB", symbol: "฿" }, { code: "AUD", symbol: "A$" },
  { code: "CAD", symbol: "C$" }, { code: "CHF", symbol: "Fr" }, { code: "SGD", symbol: "S$" },
  { code: "HKD", symbol: "HK$" },
];

const PRESET_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

const currencySymbol = (code: string) =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

function formatMoney(amount: number, currency: string) {
  return `${currencySymbol(currency)}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function PortfolioForm({
  initial, onSubmit, onCancel, submitting,
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
              key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
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

export default function Portfolios() {
  const { user } = useAuth();
  const { portfolios, refresh, setActiveId, activeId } = usePortfolio();
  // Pull ALL trades for stats by temporarily reading via useTrades while ALL is selected.
  // To avoid coupling, we just compute per-portfolio from a single fetch.
  const { trades } = useTrades(); // respects current filter
  const [allTrades, setAllTrades] = useState<any[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Portfolio | null>(null);
  const [confirmDel, setConfirmDel] = useState<Portfolio | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Always fetch all trades for accurate per-portfolio stats
  useMemo(() => {
    if (!user) return;
    supabase.from("trades").select("portfolio_id,pnl").then(({ data }) => {
      setAllTrades(data ?? []);
    });
  }, [user, trades.length]);

  const stats = useMemo(() => {
    const source = allTrades ?? [];
    const map = new Map<string, { count: number; wins: number; pnl: number }>();
    let unassigned = { count: 0, wins: 0, pnl: 0 };
    for (const t of source) {
      const pnl = Number(t.pnl) || 0;
      const isWin = pnl > 0;
      if (!t.portfolio_id) {
        unassigned.count++;
        unassigned.pnl += pnl;
        if (isWin) unassigned.wins++;
        continue;
      }
      const cur = map.get(t.portfolio_id) ?? { count: 0, wins: 0, pnl: 0 };
      cur.count++;
      cur.pnl += pnl;
      if (isWin) cur.wins++;
      map.set(t.portfolio_id, cur);
    }
    return { map, unassigned };
  }, [allTrades]);

  const handleCreate = async (data: any) => {
    if (!user) return;
    setSubmitting(true);
    const { data: created, error } = await supabase
      .from("portfolios").insert({ ...data, user_id: user.id }).select().single();
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

  const totals = useMemo(() => {
    let count = 0, wins = 0, pnl = 0;
    for (const v of stats.map.values()) { count += v.count; wins += v.wins; pnl += v.pnl; }
    count += stats.unassigned.count; wins += stats.unassigned.wins; pnl += stats.unassigned.pnl;
    return { count, wins, pnl, wr: count ? (wins / count) * 100 : 0 };
  }, [stats]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" /> Portfolios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage trading accounts and view per-portfolio performance.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
            <Plus className="h-4 w-4 mr-1" /> New Portfolio
          </Button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Portfolios</div>
            <p className="text-2xl font-bold mt-1">{portfolios.length}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Hash className="h-3.5 w-3.5" /> Total Trades</div>
            <p className="text-2xl font-bold mt-1">{totals.count}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" /> Win Rate</div>
            <p className="text-2xl font-bold mt-1">{totals.wr.toFixed(1)}%</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {totals.pnl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} Total P&L
            </div>
            <p className={`text-2xl font-bold mt-1 ${totals.pnl >= 0 ? "text-success" : "text-destructive"}`}>
              {totals.pnl >= 0 ? "+" : ""}{totals.pnl.toFixed(2)}
            </p>
          </Card>
        </div>

        {/* Portfolio list */}
        {portfolios.length === 0 ? (
          <Card className="p-10 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No portfolios yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create your first portfolio to start organizing your trades.
            </p>
            <Button onClick={() => setCreateOpen(true)} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
              <Plus className="h-4 w-4 mr-1" /> Create portfolio
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {portfolios.map((p) => {
              const s = stats.map.get(p.id) ?? { count: 0, wins: 0, pnl: 0 };
              const wr = s.count ? (s.wins / s.count) * 100 : 0;
              return (
                <Card key={p.id} className="p-4 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-1" style={{ background: p.color }} />
                  <div className="flex items-start justify-between gap-2 pl-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider">{p.currency}</span>
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(p)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(p)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pl-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trades</p>
                      <p className="text-lg font-bold">{s.count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
                      <p className="text-lg font-bold">{wr.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">P&L</p>
                      <p className={`text-lg font-bold ${s.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                        {s.pnl >= 0 ? "+" : ""}{formatMoney(s.pnl, p.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pl-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Initial: {formatMoney(Number(p.initial_balance) || 0, p.currency)}</span>
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => setActiveId(p.id)}
                    >
                      {activeId === p.id ? "Active" : "Set active"}
                    </Button>
                  </div>
                </Card>
              );
            })}

            {stats.unassigned.count > 0 && (
              <Card className="p-4 relative overflow-hidden border-dashed">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Unassigned</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">No portfolio</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trades imported or created before you assigned a portfolio.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trades</p>
                    <p className="text-lg font-bold">{stats.unassigned.count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
                    <p className="text-lg font-bold">
                      {stats.unassigned.count ? ((stats.unassigned.wins / stats.unassigned.count) * 100).toFixed(1) : "0.0"}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">P&L</p>
                    <p className={`text-lg font-bold ${stats.unassigned.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                      {stats.unassigned.pnl >= 0 ? "+" : ""}{stats.unassigned.pnl.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> New Portfolio</DialogTitle>
          </DialogHeader>
          <PortfolioForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} submitting={submitting} />
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Portfolio</DialogTitle></DialogHeader>
          {editing && (
            <PortfolioForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} submitting={submitting} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && !submitting && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete portfolio "{confirmDel?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The portfolio will be removed. Trades inside it won't be deleted but will become "Unassigned".
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
    </AppLayout>
  );
}
