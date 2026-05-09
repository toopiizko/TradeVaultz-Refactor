import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useExpenses } from "@/hooks/useExpenses";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCategoriesDB } from "@/hooks/useCategoriesDB";
import { useWallets, ALL_WALLETS } from "@/hooks/useWallets";
import { useCategorizeRules } from "@/hooks/useCategorizeRules";
import { useCurrency } from "@/lib/currency-context";
import { CategoryManager } from "@/components/CategoryManager";
// WalletManager moved into the WalletSwitcher dropdown in the top bar
import { RulesManager } from "@/components/RulesManager";
import { ImageAttachments, ImageBadge } from "@/components/ImageAttachments";
import { NoteEditor } from "@/components/NoteEditor";
import { SlipUploader } from "@/components/SlipUploader";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet as WalletIcon, PieChart as PieIcon,
  Upload, Download, Sparkles, ChevronLeft, ChevronRight, Filter, Pencil, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfYear, endOfYear, subDays,
} from "date-fns";
import { extractStatementText, exportExpensesToExcel } from "@/lib/statementIO";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const CHART_COLORS = [
  "hsl(174 72% 50%)", "hsl(250 70% 60%)", "hsl(38 92% 55%)", "hsl(340 75% 55%)",
  "hsl(195 80% 55%)", "hsl(150 60% 50%)", "hsl(20 85% 55%)", "hsl(280 65% 60%)",
  "hsl(100 60% 45%)", "hsl(0 70% 55%)",
];

type PeriodKey = "this-month" | "last-month" | "this-week" | "last-7" | "this-year" | "all";
const PERIOD_LABELS: Record<PeriodKey, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "this-week": "This week",
  "last-7": "Last 7 days",
  "this-year": "This year",
  "all": "All time",
};

function rangeFor(key: PeriodKey, cursor: Date): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  switch (key) {
    case "this-month":  return { start: startOfMonth(cursor), end: endOfMonth(cursor), label: format(cursor, "MMMM yyyy") };
    case "last-month": { const d = subMonths(now, 1); return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMMM yyyy") }; }
    case "this-week":  return { start: startOfWeek(now), end: endOfWeek(now), label: "This week" };
    case "last-7":     return { start: subDays(now, 6), end: now, label: "Last 7 days" };
    case "this-year":  return { start: startOfYear(now), end: endOfYear(now), label: format(now, "yyyy") };
    case "all":        return { start: null, end: null, label: "All time" };
  }
}

export default function Expenses() {
  const { user } = useAuth();
  const { expenses, loading } = useExpenses();
  const categories = useCategoriesDB();
  const { wallets, activeId: activeWalletId } = useWallets();
  const { apply: applyRules } = useCategorizeRules();

  const [open, setOpen] = useState(false);
  const { currency, setCurrency, rate } = useCurrency();
  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [searchParams, setSearchParams] = useSearchParams();

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkWallet, setBulkWallet] = useState<string>("");
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Category filter (multi-select)
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [drillDownCategory, setDrillDownCategory] = useState<string | null>(null);

  // Open dialog when ?new=1 (from bottom-bar FAB)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    category: "Food",
    description: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    wallet_id: "" as string,
  });

  // Import state
  const [importing, setImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCurrencyOpen, setImportCurrencyOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importCurrency, setImportCurrency] = useState<"USD" | "THB">("USD");
  const [importRows, setImportRows] = useState<Array<{
    type: "income" | "expense"; amount: number; category: string; description: string; expense_date: string; _selected: boolean;
  }>>([]);
  const [importFileName, setImportFileName] = useState("");

  // Filter expenses by wallet + period (used for charts/totals)
  const range = useMemo(() => rangeFor(period, monthCursor), [period, monthCursor]);
  const filteredAll = useMemo(() => {
    return expenses.filter((e) => {
      if (activeWalletId !== ALL_WALLETS && (e as any).wallet_id !== activeWalletId) return false;
      if (range.start && range.end) {
        const d = new Date(e.expense_date);
        if (d < range.start || d > range.end) return false;
      }
      return true;
    });
  }, [expenses, activeWalletId, range]);

  // Apply category filter on top — used for the History list & breakdown only
  const filteredHistory = useMemo(() => {
    if (categoryFilter.size === 0) return filteredAll;
    return filteredAll.filter((e) => categoryFilter.has(e.category));
  }, [filteredAll, categoryFilter]);

  const totals = useMemo(() => {
    const income = filteredAll.filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
    const expense = filteredAll.filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);
    return { income, expense, net: income - expense };
  }, [filteredAll]);

  const convert = (usd: number) => (currency === "THB" ? usd * rate : usd);
  const display = (amount: number) => formatMoney(convert(amount), currency);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredAll
      .filter((e) => e.type === "expense")
      .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount)));
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(map.entries())
      .map(([name, valueUsd]) => ({
        name,
        value: Number(convert(valueUsd).toFixed(2)),
        valueUsd,
        pct: (valueUsd / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredAll, currency, rate]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expense: number }>();
    filteredAll.forEach((e) => {
      const key = format(startOfMonth(new Date(e.expense_date)), "yyyy-MM");
      const label = format(new Date(e.expense_date), "MMM yy");
      const cur = map.get(key) ?? { month: label, income: 0, expense: 0 };
      if (e.type === "income") cur.income += Number(e.amount);
      else cur.expense += Number(e.amount);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, v]) => ({
        month: v.month,
        Income: Number(convert(v.income).toFixed(2)),
        Expense: Number(convert(v.expense).toFixed(2)),
      }));
  }, [filteredAll, currency, rate]);

  const totalExpense = categoryData.reduce((s, c) => s + c.value, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const inputAmount = parseFloat(form.amount);
    if (Number.isNaN(inputAmount)) return toast.error("Invalid amount");
    const amountUsd = currency === "THB" ? inputAmount / rate : inputAmount;
    const { error } = await supabase.from("expenses").insert({
      user_id: user.id,
      type: form.type,
      amount: amountUsd,
      category: form.category,
      description: form.description || null,
      expense_date: new Date(form.expense_date).toISOString(),
      ...(form.wallet_id ? { wallet_id: form.wallet_id } as any : {}),
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Saved!");
    setOpen(false);
    setForm({ ...form, amount: "", description: "" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
  };

  const handleUpdateCategory = async (id: string, category: string) => {
    const { error } = await supabase.from("expenses").update({ category }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Category updated");
  };

  const handleUpdateWallet = async (id: string, wallet_id: string | null) => {
    const { error } = await supabase.from("expenses").update({ wallet_id } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Wallet updated");
  };

  const handleUpdateNote = async (id: string, description: string) => {
    const { error } = await supabase.from("expenses").update({ description: description || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Note updated");
  };

  // Bulk operations
  const toggleSelect = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (on: boolean) => {
    setSelectedIds(on ? new Set(filteredHistory.map((e) => e.id)) : new Set());
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const { error } = await supabase.from("expenses").delete().in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length}`);
    clearSelection();
    setConfirmBulkDelete(false);
  };

  const handleBulkEdit = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const patch: any = {};
    if (bulkCategory) patch.category = bulkCategory;
    if (bulkWallet) patch.wallet_id = bulkWallet === "none" ? null : bulkWallet;
    if (!Object.keys(patch).length) {
      setBulkEditOpen(false);
      return;
    }
    const { error } = await supabase.from("expenses").update(patch).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${ids.length}`);
    clearSelection();
    setBulkEditOpen(false);
    setBulkCategory("");
    setBulkWallet("");
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingFile(file);
    setImportCurrency(currency);
    setImportCurrencyOpen(true);
  };

  const runImport = async () => {
    if (!pendingFile) return;
    setImportCurrencyOpen(false);
    const file = pendingFile;
    setPendingFile(null);
    try {
      setImporting(true);
      toast.info("Reading file…");
      const text = await extractStatementText(file);
      if (!text.trim()) throw new Error("Could not read file content");
      toast.info("AI analyzing statement…");
      const { data, error } = await supabase.functions.invoke("analyze-statement", {
        body: { text, currencyHint: importCurrency },
      });
      if (error) throw error;
      const txns = (data?.transactions ?? []) as Array<any>;
      if (!txns.length) { toast.warning("No transactions detected"); return; }
      setImportRows(txns.map((t) => {
        const description = String(t.description || "");
        const type = (t.type === "income" ? "income" : "expense") as "income" | "expense";
        const ruled = applyRules(description, type);
        return {
          type,
          amount: Number(t.amount) || 0,
          category: ruled || t.category || "Other",
          description,
          expense_date: String(t.expense_date || format(new Date(), "yyyy-MM-dd")).slice(0, 10),
          _selected: true,
        };
      }));
      setImportFileName(file.name);
      setImportOpen(true);
      toast.success(`Found ${txns.length} transactions`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to analyze statement");
    } finally {
      setImporting(false);
    }
  };

  const handleImportSave = async () => {
    if (!user) return;
    const picked = importRows.filter((r) => r._selected);
    if (!picked.length) return toast.error("Nothing selected");
    const wallet_id = activeWalletId !== ALL_WALLETS ? activeWalletId : null;
    const rows = picked.map((r) => {
      const amountUsd = importCurrency === "THB" ? r.amount / rate : r.amount;
      return {
        user_id: user.id,
        type: r.type,
        amount: amountUsd,
        category: r.category,
        description: r.description || null,
        expense_date: new Date(r.expense_date).toISOString(),
        ...(wallet_id ? { wallet_id } as any : {}),
      };
    });
    const { error } = await supabase.from("expenses").insert(rows as any);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${rows.length} transactions`);
    setImportOpen(false);
    setImportRows([]);
  };

  const handleExport = () => {
    if (!filteredAll.length) return toast.error("Nothing to export");
    exportExpensesToExcel(filteredAll as any, `expenses-${currency}-${range.label.replace(/\s+/g, "-")}.xlsx`);
    toast.success(`Exported in ${currency}`);
  };

  const walletOf = (id: string | null | undefined) => wallets.find((w) => w.id === id);
  const activeWallet = activeWalletId === ALL_WALLETS ? null : wallets.find((w) => w.id === activeWalletId);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Expense Tracker</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1">
            {activeWallet ? <><span className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle" style={{ background: activeWallet.color }} />{activeWallet.name} · </> : "All wallets · "}
            1 USD ≈ {rate.toFixed(2)} THB
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
            {(["USD", "THB"] as const).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>{c}</button>
            ))}
          </div>
          <label className="relative">
            <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFilePick} disabled={importing}
              className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-wait" onChange={handleFilePick} />
            <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled={importing}>
              {importing ? <Sparkles className="h-3.5 w-3.5 animate-pulse" /> : <Upload className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{importing ? "Analyzing…" : "Import"}</span>
            </Button>
          </label>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">Export</span>
          </Button>
          <SlipUploader />
          <CategoryManager />
          <RulesManager />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 font-semibold" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: "income" | "expense") => setForm({ ...form, type: v, category: (v === "income" ? categories.income : categories.expense)[0] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Wallet</Label>
                    <Select value={form.wallet_id || "none"} onValueChange={(v) => setForm({ ...form, wallet_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount ({currency})</Label>
                    <Input type="number" step="0.01" required value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(form.type === "income" ? categories.income : categories.expense).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description / Note</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <Button type="submit" className="w-full font-semibold" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Period filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={period} onValueChange={(v: PeriodKey) => setPeriod(v)}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
              <SelectItem key={k} value={k}>{PERIOD_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {period === "this-month" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[110px] text-center">{format(monthCursor, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {period !== "this-month" && (
          <span className="text-xs text-muted-foreground">{range.label}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filteredAll.length} transactions</span>
      </div>

      {/* Category filter chips */}
      {categoryData.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> Category
          </span>
          <button
            onClick={() => setCategoryFilter(new Set())}
            className={`px-2.5 py-1 text-[11px] rounded-full border transition ${
              categoryFilter.size === 0 ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-foreground/30 text-muted-foreground"
            }`}
          >All</button>
          {categoryData.map((c, i) => {
            const on = categoryFilter.has(c.name);
            return (
              <button
                key={c.name}
                onClick={() => {
                  setCategoryFilter((prev) => {
                    const next = new Set(prev);
                    if (on) next.delete(c.name); else next.add(c.name);
                    return next;
                  });
                }}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition flex items-center gap-1.5 ${
                  on ? "bg-primary/15 border-primary text-primary" : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {c.name}
                <span className="text-muted-foreground">{c.pct.toFixed(0)}%</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="h-4 w-4 text-success" />
            <p className="text-[10px] lg:text-xs uppercase tracking-wider text-muted-foreground">Income</p>
          </div>
          <p className="text-lg lg:text-2xl font-bold text-success">{display(totals.income)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
            <p className="text-[10px] lg:text-xs uppercase tracking-wider text-muted-foreground">Expense</p>
          </div>
          <p className="text-lg lg:text-2xl font-bold text-destructive">{display(totals.expense)}</p>
        </div>
        <div className="stat-card border-primary/30" style={{ boxShadow: "var(--shadow-glow)" }}>
          <div className="flex items-center gap-2 mb-1">
            <WalletIcon className="h-4 w-4 text-primary" />
            <p className="text-[10px] lg:text-xs uppercase tracking-wider text-muted-foreground">Net</p>
          </div>
          <p className={`text-lg lg:text-2xl font-bold ${totals.net >= 0 ? "text-success" : "text-destructive"}`}>{display(totals.net)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm lg:text-base">Spending by Category</h2>
            </div>
            <span className="text-xs text-muted-foreground">{currency}</span>
          </div>
          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No expenses in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name"
                    innerRadius={50} outerRadius={90} paddingAngle={2}
                    stroke="hsl(var(--card))" strokeWidth={2}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--primary) / 0.4)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 4px 16px hsl(var(--primary) / 0.15)",
                    }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                    formatter={(v: any, _n: any, p: any) => [
                      `${formatMoney(Number(v), currency)} (${p.payload.pct.toFixed(1)}%)`,
                      p.payload.name,
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Top categories list with % */}
          {categoryData.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5 max-h-32 overflow-y-auto">
              {categoryData.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">{c.pct.toFixed(1)}%</span>
                    <span className="font-semibold">{formatMoney(c.value, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm lg:text-base">Monthly Trend</h2>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <div className="h-64">
            {monthlyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => formatMoney(v, currency)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="glass-card rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="text-sm font-medium">{selectedIds.size} selected</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setConfirmBulkDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={filteredHistory.length > 0 && selectedIds.size === filteredHistory.length}
              onCheckedChange={(c) => toggleSelectAll(!!c)}
              aria-label="Select all"
            />
            <h2 className="font-semibold text-sm">History</h2>
            {categoryFilter.size > 0 && (
              <span className="text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                {categoryFilter.size} category filter
                <button onClick={() => setCategoryFilter(new Set())}><X className="h-3 w-3" /></button>
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{filteredHistory.length} · {range.label}</span>
        </div>

        {/* Mobile compact list */}
        <ul className="lg:hidden divide-y divide-border/40">
          {loading && <li className="py-12 text-center text-muted-foreground text-sm">Loading…</li>}
          {!loading && filteredHistory.length === 0 && <li className="py-12 text-center text-muted-foreground text-sm">No transactions</li>}
          {filteredHistory.map((e) => {
            const w = walletOf((e as any).wallet_id);
            const imgs = (((e as any).image_urls ?? []) as string[]);
            const isSel = selectedIds.has(e.id);
            return (
              <li key={e.id} className={`px-3 py-2.5 flex items-center gap-2 ${isSel ? "bg-primary/5" : ""}`}>
                <Checkbox
                  checked={isSel}
                  onCheckedChange={(c) => toggleSelect(e.id, !!c)}
                  aria-label="Select"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex-1 flex items-center gap-2 text-left">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${e.type === "income" ? "bg-success" : "bg-destructive"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate flex items-center gap-1.5">
                          {e.description || <span className="text-muted-foreground italic">No note</span>}
                          <ImageBadge count={imgs.length} />
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(e.expense_date), "MMM dd, yyyy")}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                        {e.type === "income" ? "+" : "-"}{display(Number(e.amount))}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="end"
                    className="w-80 text-xs space-y-2 border-primary/30 shadow-[0_8px_24px_hsl(var(--primary)/0.15)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{format(new Date(e.expense_date), "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Category</span>
                      <Select value={e.category} onValueChange={(v) => handleUpdateCategory(e.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(e.type === "income" ? categories.income : categories.expense).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Wallet</span>
                      <Select value={(e as any).wallet_id ?? "none"} onValueChange={(v) => handleUpdateWallet(e.id, v === "none" ? null : v)}>
                        <SelectTrigger className="h-7 text-xs w-[140px]">
                          {w ? (
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: w.color }} />{w.name}</span>
                          ) : <span className="text-muted-foreground">None</span>}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {wallets.map((wx) => <SelectItem key={wx.id} value={wx.id}>{wx.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Note</p>
                      <NoteEditor value={e.description} onSave={async (v) => { await handleUpdateNote(e.id, v); }} />
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Attachments</p>
                      <ImageAttachments kind="expense" recordId={e.id} paths={imgs} compact />
                    </div>
                    <Button size="sm" variant="ghost" className="w-full text-destructive gap-2" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </PopoverContent>
                </Popover>
              </li>
            );
          })}
        </ul>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-b border-border/60">
              <tr className="text-left">
                <th className="px-3 py-2.5 w-10">
                  <Checkbox
                    checked={filteredHistory.length > 0 && selectedIds.size === filteredHistory.length}
                    onCheckedChange={(c) => toggleSelectAll(!!c)}
                    aria-label="Select all"
                  />
                </th>
                {["Date", "Type", "Category", "Wallet", "Description", "Files", "Amount", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && filteredHistory.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">No transactions</td></tr>}
              {filteredHistory.map((e) => {
                const w = walletOf((e as any).wallet_id);
                const imgs = (((e as any).image_urls ?? []) as string[]);
                const isSel = selectedIds.has(e.id);
                return (
                  <tr key={e.id} className={`border-b border-border/40 hover:bg-secondary/30 ${isSel ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2.5">
                      <Checkbox checked={isSel} onCheckedChange={(c) => toggleSelect(e.id, !!c)} aria-label="Select" />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(e.expense_date), "MMM dd, yyyy")}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.type === "income" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                        {e.type === "income" ? "IN" : "OUT"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <Select value={e.category} onValueChange={(v) => handleUpdateCategory(e.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-[120px] border-border/40 bg-transparent hover:bg-secondary/60"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(e.type === "income" ? categories.income : categories.expense).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <Select value={(e as any).wallet_id ?? "none"} onValueChange={(v) => handleUpdateWallet(e.id, v === "none" ? null : v)}>
                        <SelectTrigger className="h-7 text-xs w-[120px] border-border/40 bg-transparent hover:bg-secondary/60">
                          {w ? (
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: w.color }} />{w.name}</span>
                          ) : <span className="text-muted-foreground">None</span>}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs">
                      <NoteEditor value={e.description} onSave={async (v) => { await handleUpdateNote(e.id, v); }} className="min-h-[28px] py-1" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                            <ImageBadge count={imgs.length} />
                            {imgs.length === 0 && <Upload className="h-3.5 w-3.5" />}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <p className="text-xs font-medium mb-2">Attachments</p>
                          <ImageAttachments kind="expense" recordId={e.id} paths={imgs} />
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className={`px-3 py-2.5 font-bold ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                      {e.type === "income" ? "+" : "-"}{display(Number(e.amount))}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category breakdown panel — appears when filtering categories */}
      {categoryFilter.size > 0 && (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Breakdown · {categoryFilter.size} category</h3>
            <span className="text-xs text-muted-foreground">{filteredHistory.length} txns</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Array.from(categoryFilter).map((cat) => {
              const items = filteredHistory.filter((e) => e.category === cat);
              const total = items.reduce((s, e) => s + (e.type === "expense" ? Number(e.amount) : -Number(e.amount)), 0);
              return (
                <div key={cat} className="rounded-lg border border-border/40 p-3">
                  <p className="text-sm font-semibold">{cat}</p>
                  <p className="text-xs text-muted-foreground">{items.length} transactions</p>
                  <p className={`text-lg font-bold mt-1 ${total >= 0 ? "text-destructive" : "text-success"}`}>
                    {display(Math.abs(total))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk edit dialog */}
      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit {selectedIds.size} transactions</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Leave a field empty to keep its current value.</p>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={bulkCategory || "__keep"} onValueChange={(v) => setBulkCategory(v === "__keep" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep">— Keep existing —</SelectItem>
                  {categories.expense.map((c) => <SelectItem key={"e-" + c} value={c}>{c} (expense)</SelectItem>)}
                  {categories.income.map((c) => <SelectItem key={"i-" + c} value={c}>{c} (income)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Wallet</Label>
              <Select value={bulkWallet || "__keep"} onValueChange={(v) => setBulkWallet(v === "__keep" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep">— Keep existing —</SelectItem>
                  <SelectItem value="none">No wallet</SelectItem>
                  {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkEditOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkEdit} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
              Apply to {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} transactions?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import currency dialog */}
      <Dialog open={importCurrencyOpen} onOpenChange={(o) => { if (!o) { setPendingFile(null); } setImportCurrencyOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Statement currency</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">What currency are the amounts in <span className="font-medium text-foreground">{pendingFile?.name}</span>?</p>
          <div className="flex gap-2">
            {(["USD", "THB"] as const).map((c) => (
              <button key={c} onClick={() => setImportCurrency(c)}
                className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                  importCurrency === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border/80"
                }`}>{c}</button>
            ))}
          </div>
          <Button onClick={runImport} className="w-full" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
            Continue
          </Button>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Review imported transactions
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {importFileName} · {importRows.filter((r) => r._selected).length} of {importRows.length} selected · amounts in {importCurrency}
            {activeWallet ? <> · saving to <span className="font-medium text-foreground">{activeWallet.name}</span></> : ""}
          </p>
          <div className="max-h-[55vh] overflow-auto border border-border/40 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 sticky top-0">
                <tr className="text-left">
                  {["", "Date", "Type", "Category", "Description", "Amount"].map((h) => (
                    <th key={h} className="px-2 py-2 font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importRows.map((r, i) => (
                  <tr key={i} className="border-t border-border/30">
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={r._selected}
                        onChange={(e) => setImportRows((rs) => rs.map((x, j) => j === i ? { ...x, _selected: e.target.checked } : x))} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="date" value={r.expense_date} className="h-7 text-xs"
                        onChange={(e) => setImportRows((rs) => rs.map((x, j) => j === i ? { ...x, expense_date: e.target.value } : x))} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={r.type} onValueChange={(v: "income" | "expense") => setImportRows((rs) => rs.map((x, j) => j === i ? { ...x, type: v } : x))}>
                        <SelectTrigger className="h-7 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={r.category} onValueChange={(v) => setImportRows((rs) => rs.map((x, j) => j === i ? { ...x, category: v } : x))}>
                        <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(r.type === "income" ? categories.income : categories.expense).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={r.description} className="h-7 text-xs"
                        onChange={(e) => setImportRows((rs) => rs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" step="0.01" value={r.amount}
                        className={`h-7 text-xs w-[90px] font-semibold ${r.type === "income" ? "text-success" : "text-destructive"}`}
                        onChange={(e) => setImportRows((rs) => rs.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex gap-2 text-xs">
              <button className="underline text-muted-foreground hover:text-foreground" onClick={() => setImportRows((rs) => rs.map((r) => ({ ...r, _selected: true })))}>Select all</button>
              <button className="underline text-muted-foreground hover:text-foreground" onClick={() => setImportRows((rs) => rs.map((r) => ({ ...r, _selected: false })))}>Clear</button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={handleImportSave} style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
                Import {importRows.filter((r) => r._selected).length}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
