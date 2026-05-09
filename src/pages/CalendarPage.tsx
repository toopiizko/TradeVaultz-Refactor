import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function CalendarPage() {
  const { trades } = useTrades();
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const dailyMap = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: typeof trades }>();
    trades.forEach((t) => {
      const k = format(new Date(t.trade_date), "yyyy-MM-dd");
      const cur = map.get(k) || { pnl: 0, trades: [] };
      cur.pnl += Number(t.pnl);
      cur.trades.push(t);
      map.set(k, cur);
    });
    return map;
  }, [trades]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthSummary = useMemo(() => {
    let pnl = 0, count = 0;
    dailyMap.forEach((v, k) => {
      if (isSameMonth(new Date(k), month)) { pnl += v.pnl; count += v.trades.length; }
    });
    return { pnl, count };
  }, [dailyMap, month]);

  const selectedData = selected ? dailyMap.get(format(selected, "yyyy-MM-dd")) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">P&L Calendar</h1>
        <p className="text-muted-foreground mt-1">Daily profit & loss heatmap</p>
      </div>

      <div className="glass-card rounded-xl p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-xl font-semibold min-w-[160px] text-center">{format(month, "MMMM yyyy")}</h2>
            <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Month P&L: </span>
              <span className={`font-bold ${monthSummary.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                {monthSummary.pnl >= 0 ? "+" : ""}${monthSummary.pnl.toFixed(2)}
              </span>
            </div>
            <div className="text-muted-foreground">{monthSummary.count} trades</div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const data = dailyMap.get(key);
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, new Date());
            return (
              <button
                key={key}
                onClick={() => data && setSelected(day)}
                disabled={!data}
                className={`min-h-[68px] lg:min-h-[96px] rounded-lg p-1.5 lg:p-2 text-left transition-all border flex flex-col ${
                  !inMonth ? "opacity-30" : ""
                } ${
                  data
                    ? data.pnl >= 0
                      ? "bg-success/15 border-success/30 hover:bg-success/25 hover:border-success/50 cursor-pointer"
                      : "bg-destructive/15 border-destructive/30 hover:bg-destructive/25 hover:border-destructive/50 cursor-pointer"
                    : "bg-secondary/30 border-border/30"
                } ${isToday ? "ring-2 ring-primary/50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] lg:text-xs font-medium">{format(day, "d")}</span>
                  {data && data.trades.length > 1 && (
                    <span className="text-[8px] lg:text-[9px] text-muted-foreground">×{data.trades.length}</span>
                  )}
                </div>
                {data && (
                  <div className="mt-auto space-y-0.5 overflow-hidden">
                    {data.trades.slice(0, 2).map((t) => {
                      const p = Number(t.pnl);
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-1 leading-tight">
                          <span className="text-[8px] lg:text-[10px] font-semibold truncate">{t.asset}</span>
                          <span className={`text-[8px] lg:text-[10px] font-bold tabular-nums shrink-0 ${p >= 0 ? "text-success" : "text-destructive"}`}>
                            {p >= 0 ? "+" : ""}{p.toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                    {data.trades.length > 2 && (
                      <div className="text-[8px] lg:text-[9px] text-muted-foreground text-right">+{data.trades.length - 2} more</div>
                    )}
                    <div className={`text-[9px] lg:text-[11px] font-bold text-right border-t border-border/30 pt-0.5 ${data.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                      {data.pnl >= 0 ? "+" : ""}{data.pnl.toFixed(0)}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected && format(selected, "EEEE, MMMM d, yyyy")}
              {selectedData && (
                <span className={`ml-3 ${selectedData.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                  {selectedData.pnl >= 0 ? "+" : ""}${selectedData.pnl.toFixed(2)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedData?.trades.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/40">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.emotion}</span>
                  <div>
                    <div className="font-semibold">{t.asset} <span className="text-xs text-muted-foreground ml-1">{t.side.toUpperCase()}</span></div>
                    <div className="text-xs text-muted-foreground">{t.strategy} · Vol {Number(t.volume)}</div>
                  </div>
                </div>
                <div className={`font-bold ${Number(t.pnl) >= 0 ? "text-success" : "text-destructive"}`}>
                  {Number(t.pnl) >= 0 ? "+" : ""}${Number(t.pnl).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
