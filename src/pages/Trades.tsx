import { useRef, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { useTradeForm } from "@/hooks/useTradeForm";
import { supabase } from "@/integrations/supabase/client";
import { usePortfolio, ALL_PORTFOLIOS } from "@/lib/portfolio";
import { Trade, STRATEGIES, EMOTIONS, POPULAR_ASSETS } from "@/lib/types";
import { parseTradesFile, exportTradesToExcel } from "@/lib/tradeIO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ChevronRight, Upload, Download, Image as ImageIcon } from "lucide-react";
import { ImageAttachments, ImageBadge } from "@/components/ImageAttachments";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Trades() {
  const { portfolios, activeId, activePortfolio } = usePortfolio();
  const { trades, loading, refresh } = useTrades();

  // ── useTradeForm replaces all inline form state ─────────────────────────────
  const { form, setField, open, setOpen, submitting, handleSubmit } = useTradeForm(refresh);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Trade>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const requestDelete = (ids: string[]) => { if (ids.length) setConfirmDelete({ ids }); };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await supabase.from("trades").delete().in("id", confirmDelete.ids);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${confirmDelete.ids.length} trade${confirmDelete.ids.length > 1 ? "s" : ""}`);
    setSelected((prev) => {
      const next = new Set(prev);
      confirmDelete.ids.forEach((id) => next.delete(id));
      return next;
    });
    setConfirmDelete(null);
    refresh();
  };

  // ── Selection ───────────────────────────────────────────────────────────────
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n; });
  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(trades.map((t) => t.id)) : new Set());

  // ── Import / Export ─────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!trades.length) return toast.error("No trades to export");
    exportTradesToExcel(trades);
    toast.success(`Exported ${trades.length} trades`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseTradesFile(file);
      if (!rows.length) { toast.error("No valid trades found in file"); return; }
      const targetPortfolioId = activeId !== ALL_PORTFOLIOS ? activeId : portfolios[0]?.id ?? null;
      if (!targetPortfolioId) { toast.error("Create a portfolio first, then import trades into it"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload = rows.map((r) => ({ ...r, user_id: user.id, portfolio_id: targetPortfolioId }));
      const { error } = await supabase.from("trades").insert(payload);
      if (error) throw error;
      toast.success(`Imported ${rows.length} trades into "${activePortfolio?.name ?? portfolios[0]?.name}"`);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to import file");
    } finally {
      setImporting(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const startEdit = (t: Trade) => { setEditingId(t.id); setEditDraft({ ...t }); };

  const saveEdit = async () => {
    if (!editingId || !editDraft) return;
    const { error } = await supabase.from("trades").update({
      asset: editDraft.asset,
      side: (editDraft.side as "buy" | "sell") ?? "buy",
      entry_price: Number(editDraft.entry_price),
      exit_price: Number(editDraft.exit_price),
      volume: Number(editDraft.volume),
      strategy: editDraft.strategy,
      emotion: editDraft.emotion,
      note: editDraft.note,
      pnl: Number(editDraft.pnl),
    }).eq("id", editingId);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    setEditingId(null);
    refresh();
  };

  // ── Shared cell helpers ─────────────────────────────────────────────────────
  const pnlClass = (v: number) => v >= 0 ? "text-success" : "text-destructive";
  const sideChip = (side: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${side === "buy" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
      {side.toUpperCase()}
    </span>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Trade History</h1>
          <p className="text-muted-foreground mt-1 text-sm">{trades.length} trades recorded</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2">
            <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>

          {/* New Trade Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-semibold hidden lg:inline-flex" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                <Plus className="h-4 w-4" /> New Trade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Log New Trade</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Portfolio */}
                  <div className="col-span-2">
                    <Label>Portfolio</Label>
                    {portfolios.length === 0 ? (
                      <p className="text-xs text-destructive py-2">No portfolios yet. Create one from the portfolio menu in the top bar.</p>
                    ) : (
                      <Select value={form.portfolio_id || undefined} onValueChange={(v) => setField("portfolio_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Select portfolio" /></SelectTrigger>
                        <SelectContent>
                          {portfolios.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                                {p.name} <span className="text-xs text-muted-foreground">({p.currency})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Asset */}
                  <div className="col-span-2">
                    <Label>Asset</Label>
                    <div className="flex gap-2">
                      <Select
                        value={POPULAR_ASSETS.includes(form.asset.toUpperCase()) ? form.asset.toUpperCase() : "__custom"}
                        onValueChange={(v) => setField("asset", v === "__custom" ? "" : v)}
                      >
                        <SelectTrigger className="w-40"><SelectValue placeholder="Pick" /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {POPULAR_ASSETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                          <SelectItem value="__custom">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        required
                        value={form.asset}
                        onChange={(e) => setField("asset", e.target.value.toUpperCase())}
                        placeholder="Type symbol (e.g. EURUSD)"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {/* Side */}
                  <div>
                    <Label>Side</Label>
                    <Select value={form.side} onValueChange={(v: "buy" | "sell") => setField("side", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy / Long</SelectItem>
                        <SelectItem value="sell">Sell / Short</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Entry */}
                  <div>
                    <Label>Entry Price</Label>
                    <Input type="number" step="any" required value={form.entry_price} onChange={(e) => setField("entry_price", e.target.value)} />
                  </div>

                  {/* Exit */}
                  <div>
                    <Label>Exit Price</Label>
                    <Input type="number" step="any" required value={form.exit_price} onChange={(e) => setField("exit_price", e.target.value)} />
                  </div>

                  {/* Volume */}
                  <div>
                    <Label>Volume</Label>
                    <Input type="number" step="any" required value={form.volume} onChange={(e) => setField("volume", e.target.value)} />
                  </div>

                  {/* PnL — auto-calculated but editable */}
                  <div>
                    <Label>P&L ($) <span className="text-[10px] text-muted-foreground ml-1">auto-calc</span></Label>
                    <Input
                      type="number"
                      step="any"
                      required
                      value={form.pnl}
                      onChange={(e) => setField("pnl", e.target.value)}
                      placeholder="e.g. 125.50 or -40"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <Label>Date</Label>
                    <Input type="datetime-local" required value={form.trade_date} onChange={(e) => setField("trade_date", e.target.value)} />
                  </div>

                  {/* Strategy */}
                  <div>
                    <Label>Strategy</Label>
                    <Select value={form.strategy} onValueChange={(v) => setField("strategy", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* Emotion */}
                  <div className="col-span-2">
                    <Label>Emotion</Label>
                    <Select value={form.emotion} onValueChange={(v) => setField("emotion", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EMOTIONS.map((e) => <SelectItem key={e.value} value={e.value}>{e.value} {e.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <Label>Note</Label>
                  <Textarea value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="What happened?" rows={3} />
                </div>

                <Button type="submit" disabled={submitting} className="w-full font-semibold" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                  {submitting ? "Saving…" : "Save Trade"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="glass-card rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="text-sm font-medium">{selected.size} selected</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => requestDelete(Array.from(selected))}>
              <Trash2 className="h-3.5 w-3.5" /> Delete selected
            </Button>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/60">
              <tr className="text-left">
                <th className="px-3 py-2.5 w-10">
                  <Checkbox checked={trades.length > 0 && selected.size === trades.length} onCheckedChange={(c) => toggleAll(!!c)} aria-label="Select all" />
                </th>
                {["Date", "Asset", "Side", "Entry", "Exit", "Vol", "Strategy", "🎭", "P&L", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="py-12 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && trades.length === 0 && <tr><td colSpan={11} className="py-12 text-center text-muted-foreground">No trades yet. Click "New Trade" above.</td></tr>}
              {trades.map((t) => {
                const isEdit = editingId === t.id;
                const isSelected = selected.has(t.id);
                return (
                  <tr key={t.id} className={`border-b border-border/40 hover:bg-secondary/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2">
                      <Checkbox checked={isSelected} onCheckedChange={(c) => toggleOne(t.id, !!c)} aria-label={`Select ${t.asset}`} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{format(new Date(t.trade_date), "MMM dd, HH:mm")}</td>
                    <td className="px-3 py-2 font-semibold">
                      {isEdit
                        ? <Input className="h-8 w-24" value={editDraft.asset ?? ""} onChange={(e) => setEditDraft({ ...editDraft, asset: e.target.value })} />
                        : <span className="inline-flex items-center gap-1.5">{t.asset}<ImageBadge count={((t as any).image_urls ?? []).length} /></span>
                      }
                    </td>
                    <td className="px-3 py-2">
                      {isEdit ? (
                        <Select value={editDraft.side as string} onValueChange={(v: "buy" | "sell") => setEditDraft({ ...editDraft, side: v })}>
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent>
                        </Select>
                      ) : sideChip(t.side)}
                    </td>
                    <td className="px-3 py-2">{isEdit ? <Input className="h-8 w-20" type="number" step="any" value={editDraft.entry_price as any} onChange={(e) => setEditDraft({ ...editDraft, entry_price: parseFloat(e.target.value) })} /> : Number(t.entry_price).toFixed(2)}</td>
                    <td className="px-3 py-2">{isEdit ? <Input className="h-8 w-20" type="number" step="any" value={editDraft.exit_price as any} onChange={(e) => setEditDraft({ ...editDraft, exit_price: parseFloat(e.target.value) })} /> : Number(t.exit_price).toFixed(2)}</td>
                    <td className="px-3 py-2">{isEdit ? <Input className="h-8 w-16" type="number" step="any" value={editDraft.volume as any} onChange={(e) => setEditDraft({ ...editDraft, volume: parseFloat(e.target.value) })} /> : Number(t.volume)}</td>
                    <td className="px-3 py-2 text-xs">
                      {isEdit ? (
                        <Select value={editDraft.strategy as string} onValueChange={(v) => setEditDraft({ ...editDraft, strategy: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : t.strategy}
                    </td>
                    <td className="px-3 py-2 text-lg">{t.emotion}</td>
                    <td className={`px-3 py-2 font-bold ${pnlClass(Number(t.pnl))}`}>
                      {isEdit
                        ? <Input className="h-8 w-24" type="number" step="any" value={editDraft.pnl as any} onChange={(e) => setEditDraft({ ...editDraft, pnl: parseFloat(e.target.value) })} />
                        : <>{Number(t.pnl) >= 0 ? "+" : ""}{Number(t.pnl).toFixed(2)}</>
                      }
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        {isEdit ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => requestDelete([t.id])}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile list */}
      <div className="md:hidden glass-card rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 py-2.5 bg-secondary/40 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground font-medium items-center">
          <Checkbox checked={trades.length > 0 && selected.size === trades.length} onCheckedChange={(c) => toggleAll(!!c)} aria-label="Select all" />
          <span>Asset</span>
          <span className="text-right">Vol</span>
          <span className="text-right">P&L</span>
        </div>
        {loading && <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>}
        {!loading && trades.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">No trades yet. Tap the + button below.</div>}
        {trades.map((t) => {
          const isOpen = expandedId === t.id;
          const pnlNum = Number(t.pnl);
          const isSelected = selected.has(t.id);
          return (
            <div key={t.id} className={`border-b border-border/40 last:border-b-0 ${isSelected ? "bg-primary/5" : ""}`}>
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 py-3">
                <Checkbox checked={isSelected} onCheckedChange={(c) => toggleOne(t.id, !!c)} aria-label={`Select ${t.asset}`} />
                <button onClick={() => setExpandedId(isOpen ? null : t.id)} className="flex items-center gap-2 min-w-0 text-left">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                      {t.asset}<ImageBadge count={((t as any).image_urls ?? []).length} />
                    </div>
                    <div className="text-[10px] text-muted-foreground">{format(new Date(t.trade_date), "MMM dd, HH:mm")}</div>
                  </div>
                </button>
                <span className="text-sm tabular-nums text-right" onClick={() => setExpandedId(isOpen ? null : t.id)}>{Number(t.volume)}</span>
                <span className={`font-bold tabular-nums text-right text-sm ${pnlClass(pnlNum)}`} onClick={() => setExpandedId(isOpen ? null : t.id)}>
                  {pnlNum >= 0 ? "+" : ""}{pnlNum.toFixed(2)}
                </span>
              </div>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs bg-secondary/20">
                  <div className="text-muted-foreground">Side</div>
                  <div className="text-right">{sideChip(t.side)}</div>
                  <div className="text-muted-foreground">Entry</div>
                  <div className="text-right tabular-nums">{Number(t.entry_price).toFixed(2)}</div>
                  <div className="text-muted-foreground">Exit</div>
                  <div className="text-right tabular-nums">{Number(t.exit_price).toFixed(2)}</div>
                  <div className="text-muted-foreground">Strategy</div>
                  <div className="text-right truncate">{t.strategy ?? "—"}</div>
                  <div className="text-muted-foreground">Emotion</div>
                  <div className="text-right text-base">{t.emotion ?? "—"}</div>
                  {t.note && (
                    <>
                      <div className="text-muted-foreground col-span-2 mt-1">Note</div>
                      <div className="col-span-2 text-foreground/80">{t.note}</div>
                    </>
                  )}
                  <div className="col-span-2 mt-2">
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> Images
                    </div>
                    <ImageAttachments
                      kind="trade" recordId={t.id}
                      paths={(t as any).image_urls ?? []}
                      onChange={async (next) => {
                        await supabase.from("trades").update({ image_urls: next } as any).eq("id", t.id);
                        refresh();
                      }}
                      compact
                    />
                  </div>
                  <div className="col-span-2 flex justify-end gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => startEdit(t)}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
                    <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30" onClick={() => requestDelete([t.id])}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile edit dialog */}
      <Dialog open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto md:hidden">
          <DialogHeader><DialogTitle>Edit Trade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Asset</Label><Input value={editDraft.asset ?? ""} onChange={(e) => setEditDraft({ ...editDraft, asset: e.target.value })} /></div>
              <div>
                <Label>Side</Label>
                <Select value={editDraft.side as string} onValueChange={(v: "buy" | "sell") => setEditDraft({ ...editDraft, side: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="buy">Buy</SelectItem><SelectItem value="sell">Sell</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Entry</Label><Input type="number" step="any" value={editDraft.entry_price as any} onChange={(e) => setEditDraft({ ...editDraft, entry_price: parseFloat(e.target.value) })} /></div>
              <div><Label>Exit</Label><Input type="number" step="any" value={editDraft.exit_price as any} onChange={(e) => setEditDraft({ ...editDraft, exit_price: parseFloat(e.target.value) })} /></div>
              <div><Label>Volume</Label><Input type="number" step="any" value={editDraft.volume as any} onChange={(e) => setEditDraft({ ...editDraft, volume: parseFloat(e.target.value) })} /></div>
              <div><Label>P&L</Label><Input type="number" step="any" value={editDraft.pnl as any} onChange={(e) => setEditDraft({ ...editDraft, pnl: parseFloat(e.target.value) })} /></div>
              <div className="col-span-2">
                <Label>Strategy</Label>
                <Select value={editDraft.strategy as string} onValueChange={(v) => setEditDraft({ ...editDraft, strategy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Note</Label><Textarea value={editDraft.note ?? ""} onChange={(e) => setEditDraft({ ...editDraft, note: e.target.value })} rows={3} /></div>
            {editingId && (
              <div>
                <Label className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Images</Label>
                <ImageAttachments
                  kind="trade" recordId={editingId}
                  paths={(editDraft as any).image_urls ?? []}
                  onChange={async (next) => {
                    setEditDraft({ ...editDraft, image_urls: next } as any);
                    await supabase.from("trades").update({ image_urls: next } as any).eq("id", editingId);
                    refresh();
                  }}
                />
              </div>
            )}
            <Button onClick={saveEdit} className="w-full font-semibold" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.ids.length} trade{(confirmDelete?.ids.length ?? 0) > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The selected trades will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); performDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
