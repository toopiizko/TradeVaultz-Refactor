import { useMemo, useState } from "react";
import { useTrades } from "@/hooks/useTrades";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend, PieChart, Pie, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Target, DollarSign, Activity, AlertTriangle } from "lucide-react";
import { format, subDays } from "date-fns";
import type { LucideIcon } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Period = "7d" | "30d" | "90d" | "all";
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "all": "All time",
};

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accent?: string;
  sub?: string;
}

// ─── StatCard with proper types (no more `any`) ────────────────────────────────
function StatCard({ label, value, icon: Icon, accent, sub }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${accent ?? ""}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="h-9 w-9 rounded-lg bg-secondary/80 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
    </div>
  );
}

const ASSET_COLORS = [
  "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--destructive))",
  "hsl(var(--accent))", "hsl(220 70% 60%)", "hsl(280 65% 60%)",
  "hsl(35 90% 55%)", "hsl(160 60% 50%)", "hsl(330 70% 60%)", "hsl(200 80% 55%)",
];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { trades: allTrades, loading } = useTrades();
  const [period, setPeriod] = useState<Period>("30d");

  const trades = useMemo(() => {
    if (period === "all") return allTrades;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = subDays(new Date(), days);
    return allTrades.filter((t) => new Date(t.trade_date) >= cutoff);
  }, [allTrades, period]);

  // ── Single-pass analytics (replaces 3 separate useMemos) ───────────────────
  const analytics = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    let cumPnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let grossWin = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;

    const strategyMap = new Map<string, { strategy: string; pnl: number; count: number; wins: number }>();
    const assetMap = new Map<string, { asset: string; count: number; wins: number; pnl: number }>();

    const equityCurve = sorted.map((t) => {
      const pnl = Number(t.pnl);
      cumPnL += pnl;

      // Drawdown
      if (cumPnL > peak) peak = cumPnL;
      const dd = peak > 0 ? ((peak - cumPnL) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;

      // Win / Loss
      if (pnl > 0) { grossWin += pnl; wins++; }
      else if (pnl < 0) { grossLoss += Math.abs(pnl); losses++; }

      // Strategy bucket
      const sk = t.strategy || "Unspecified";
      const sc = strategyMap.get(sk) ?? { strategy: sk, pnl: 0, count: 0, wins: 0 };
      sc.pnl += pnl; sc.count += 1; if (pnl > 0) sc.wins += 1;
      strategyMap.set(sk, sc);

      // Asset bucket
      const ak = t.asset || "Unknown";
      const ac = assetMap.get(ak) ?? { asset: ak, count: 0, wins: 0, pnl: 0 };
      ac.count += 1; ac.pnl += pnl; if (pnl > 0) ac.wins += 1;
      assetMap.set(ak, ac);

      return {
        date: format(new Date(t.trade_date), "MMM dd"),
        equity: Number(cumPnL.toFixed(2)),
        drawdown: Number((-dd).toFixed(2)),
      };
    });

    const totalTrades = trades.length;
    const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
    const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const avgWin = wins ? grossWin / wins : 0;
    const avgLoss = losses ? grossLoss / losses : 0;

    const strategyData = Array.from(strategyMap.values()).map((s) => ({
      ...s,
      pnl: Number(s.pnl.toFixed(2)),
      winRate: Math.round((s.wins / s.count) * 100),
    }));

    const total = totalTrades || 1;
    const assetData = Array.from(assetMap.values())
      .map((a) => ({
        ...a,
        pct: Number(((a.count / total) * 100).toFixed(1)),
        winRate: Math.round((a.wins / a.count) * 100),
        pnl: Number(a.pnl.toFixed(2)),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      stats: { totalPnL: cumPnL, winRate, profitFactor, totalTrades, wins, losses, avgWin, avgLoss, maxDrawdown },
      equityCurve,
      strategyData,
      assetData,
    };
  }, [trades]);

  const { stats, equityCurve, strategyData, assetData } = analytics;
  const noData = !loading && equityCurve.length === 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header + Period Filter */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Performance · {PERIOD_LABELS[period]}</p>
        </div>
        <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
          {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "All" : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="Total P&L"
          value={`$${stats.totalPnL.toFixed(2)}`}
          icon={DollarSign}
          accent={stats.totalPnL >= 0 ? "text-success" : "text-destructive"}
          sub={`${stats.totalTrades} trades`}
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          icon={Target}
          accent="text-primary"
          sub={`${stats.wins}W / ${stats.losses}L`}
        />
        <StatCard
          label="Profit Factor"
          value={isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"}
          icon={Activity}
          accent={stats.profitFactor >= 1 ? "text-success" : "text-destructive"}
        />
        <StatCard
          label="Avg Win / Loss"
          value={`$${stats.avgWin.toFixed(0)} / $${stats.avgLoss.toFixed(0)}`}
          icon={stats.avgWin >= stats.avgLoss ? TrendingUp : TrendingDown}
        />
      </div>

      {/* Max Drawdown Alert */}
      {stats.maxDrawdown > 10 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-destructive/90">
            Max drawdown is <strong>{stats.maxDrawdown.toFixed(1)}%</strong>. Consider reviewing your risk management.
          </p>
        </div>
      )}

      {/* Equity Curve */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Equity Curve</h2>
          <span className="text-xs text-muted-foreground">Cumulative P&L over time</span>
        </div>
        <div className="h-72">
          {noData ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No trades in this period</div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="equity" name="Equity ($)" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Drawdown Chart — NEW */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Drawdown</h2>
          <span className="text-xs text-muted-foreground">
            Max: <span className="text-destructive font-medium">{stats.maxDrawdown.toFixed(1)}%</span>
          </span>
        </div>
        <div className="h-48">
          {noData ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${Math.abs(v)}%`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${Math.abs(v).toFixed(2)}%`, "Drawdown"]} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Line type="monotone" dataKey="drawdown" name="Drawdown (%)" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Strategy Performance */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Strategy Performance</h2>
          <span className="text-xs text-muted-foreground">P&L by strategy</span>
        </div>
        <div className="h-72">
          {noData ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={strategyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="strategy" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="pnl" name="P&L ($)" radius={[6, 6, 0, 0]}>
                  {strategyData.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Asset Allocation */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Asset Allocation</h2>
          <p className="text-xs text-muted-foreground">Trade distribution & win rate per asset</p>
        </div>
        {noData ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={assetData}
                    dataKey="count"
                    nameKey="asset"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                  >
                    {assetData.map((_, i) => (
                      <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(value: number, _: string, p: any) => [
                      `${value} trades (${p.payload.pct}%)`,
                      p.payload.asset,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {assetData.map((a, i) => (
                <div key={a.asset} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 border border-border/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{a.asset}</p>
                      <p className="text-[11px] text-muted-foreground">{a.count} trades · {a.pct}%</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${a.winRate >= 50 ? "text-success" : "text-destructive"}`}>{a.winRate}% WR</p>
                    <p className={`text-[11px] ${a.pnl >= 0 ? "text-success" : "text-destructive"}`}>${a.pnl.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
