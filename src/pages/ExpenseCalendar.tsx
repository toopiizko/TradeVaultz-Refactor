import { useMemo, useState } from "react";
import { useExpenses } from "@/hooks/useExpenses";
import { formatMoney } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-context";
import { ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from "date-fns";

export default function ExpenseCalendar() {
  const { expenses, loading } = useExpenses();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(new Date());
  const { currency, setCurrency, rate } = useCurrency();

  const conv = (usd: number) => currency === "THB" ? usd * rate : usd;
  const fmt = (usd: number) => formatMoney(conv(usd), currency);

  // aggregate by YYYY-MM-DD
  const byDay = useMemo(() => {
    const m = new Map<string, { income: number; expense: number; items: typeof expenses }>();
    expenses.forEach((e) => {
      const k = format(new Date(e.expense_date), "yyyy-MM-dd");
      const cur = m.get(k) ?? { income: 0, expense: 0, items: [] as typeof expenses };
      if (e.type === "income") cur.income += Number(e.amount);
      else cur.expense += Number(e.amount);
      cur.items.push(e);
      m.set(k, cur);
    });
    return m;
  }, [expenses]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const monthTotals = useMemo(() => {
    let income = 0, expense = 0;
    expenses.forEach((e) => {
      const d = new Date(e.expense_date);
      if (isSameMonth(d, cursor)) {
        if (e.type === "income") income += Number(e.amount);
        else expense += Number(e.amount);
      }
    });
    return { income, expense, net: income - expense };
  }, [expenses, cursor]);

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : "";
  const selectedData = selected ? byDay.get(selectedKey) : null;

  // heatmap intensity (optional light shading for expense days)
  const maxExpense = useMemo(() => {
    let max = 0;
    byDay.forEach((v) => { if (v.expense > max) max = v.expense; });
    return max || 1;
  }, [byDay]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">Daily income & spending overview</p>
        </div>
        <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
          {(["USD", "THB"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpCircle className="h-4 w-4 text-success" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Income</p>
          </div>
          <p className="text-lg lg:text-xl font-bold text-success">{fmt(monthTotals.income)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Expense</p>
          </div>
          <p className="text-lg lg:text-xl font-bold text-destructive">{fmt(monthTotals.expense)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Net</p>
          <p className={`text-lg lg:text-xl font-bold ${monthTotals.net >= 0 ? "text-success" : "text-destructive"}`}>{fmt(monthTotals.net)}</p>
        </div>
      </div>

      {/* Calendar */}
      <div className="glass-card rounded-xl p-4 lg:p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-semibold">{format(cursor, "MMMM yyyy")}</h2>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="px-1 py-1 text-center">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const data = byDay.get(key);
            const inMonth = isSameMonth(day, cursor);
            const isSel = selected && isSameDay(day, selected);
            const intensity = data ? Math.min(1, data.expense / maxExpense) : 0;
            return (
              <button
                key={key}
                onClick={() => setSelected(day)}
                className={`relative flex flex-col items-stretch min-h-[58px] lg:min-h-[78px] rounded-lg p-1.5 text-left border transition ${
                  isSel ? "border-primary bg-primary/10" : "border-border/40 hover:border-border"
                } ${inMonth ? "" : "opacity-40"}`}
                style={!isSel && intensity > 0 ? { background: `hsl(var(--destructive) / ${0.06 + intensity * 0.14})` } : undefined}
              >
                <span className={`text-[11px] font-medium ${isSel ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
                {data && (
                  <div className="mt-auto space-y-0.5">
                    {data.income > 0 && <div className="text-[9px] lg:text-[10px] font-semibold text-success truncate">+{fmt(data.income)}</div>}
                    {data.expense > 0 && <div className="text-[9px] lg:text-[10px] font-semibold text-destructive truncate">-{fmt(data.expense)}</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day details */}
      <div className="glass-card rounded-xl p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">
            {selected ? format(selected, "EEEE, MMM d, yyyy") : "Select a day"}
          </h3>
          {selectedData && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-success">+{fmt(selectedData.income)}</span>
              <span className="text-destructive">-{fmt(selectedData.expense)}</span>
            </div>
          )}
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && (!selectedData || selectedData.items.length === 0) && (
          <p className="text-sm text-muted-foreground">No transactions this day.</p>
        )}
        {selectedData && selectedData.items.length > 0 && (
          <ul className="divide-y divide-border/40">
            {selectedData.items.map((e) => (
              <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{e.category}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.description || "—"}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                  {e.type === "income" ? "+" : "-"}{fmt(Number(e.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
