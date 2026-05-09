import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator as CalcIcon, AlertTriangle, TrendingDown } from "lucide-react";

// ─── Risk of Ruin ─────────────────────────────────────────────────────────────
// Uses the closed-form formula: RoR = ((1 - edge) / (1 + edge))^(capital / riskAmount)
// where edge = (winRate * avgWin - (1-winRate) * avgLoss) / avgLoss  (simplified Kelly edge)
function calcRiskOfRuin(winRate: number, avgWin: number, avgLoss: number, riskPct: number): number {
  if (!winRate || !avgWin || !avgLoss || !riskPct) return NaN;
  const w = winRate / 100;
  const expectancy = w * avgWin - (1 - w) * avgLoss;
  if (expectancy <= 0) return 100; // negative edge → ruin is certain
  // edge per unit risked
  const edge = expectancy / avgLoss;
  const base = (1 - edge) / (1 + edge);
  if (base <= 0) return 0;
  const units = 100 / riskPct; // number of risk units in account
  return Math.min(100, Math.pow(base, units) * 100);
}

export default function Calculator() {
  // Position size inputs
  const [balance, setBalance] = useState("10000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [contractSize, setContractSize] = useState("100000");
  const [unit, setUnit] = useState<"units" | "lots">("lots");

  // Risk of Ruin inputs
  const [rorWinRate, setRorWinRate] = useState("55");
  const [rorAvgWin, setRorAvgWin] = useState("150");
  const [rorAvgLoss, setRorAvgLoss] = useState("100");

  const result = useMemo(() => {
    const bal = parseFloat(balance);
    const risk = parseFloat(riskPct);
    const e = parseFloat(entry);
    const s = parseFloat(stop);
    const cs = parseFloat(contractSize);
    if (!bal || !risk || !e || !s || e === s) return null;
    const riskAmount = (bal * risk) / 100;
    const distance = Math.abs(e - s);
    const positionUnits = riskAmount / distance;
    const lots = positionUnits / cs;
    const direction = e > s ? 1 : -1;
    return {
      riskAmount,
      distance,
      positionUnits,
      lots,
      rrTargets: [1, 2, 3].map((r) => ({
        ratio: r,
        target: e + direction * distance * r,
        profit: riskAmount * r,
      })),
    };
  }, [balance, riskPct, entry, stop, contractSize]);

  const ror = useMemo(() => {
    const ww = parseFloat(rorWinRate);
    const aw = parseFloat(rorAvgWin);
    const al = parseFloat(rorAvgLoss);
    const rp = parseFloat(riskPct);
    return calcRiskOfRuin(ww, aw, al, rp);
  }, [rorWinRate, rorAvgWin, rorAvgLoss, riskPct]);

  const rorColor = isNaN(ror)
    ? "text-muted-foreground"
    : ror >= 20 ? "text-destructive" : ror >= 5 ? "text-warning" : "text-success";

  const rorLabel = isNaN(ror)
    ? "—"
    : ror >= 100 ? "100% (Certain Ruin)"
    : ror < 0.01 ? "< 0.01%"
    : `${ror.toFixed(2)}%`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calculator</h1>
        <p className="text-muted-foreground mt-1">Position sizing & risk analysis</p>
      </div>

      {/* ── Position Size ─────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <CalcIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <h2 className="font-semibold">Position Size</h2>
          </div>
          <div>
            <Label>Account Balance ($)</Label>
            <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>
          <div>
            <Label>Risk per Trade (%)</Label>
            <Input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">Also used in Risk of Ruin below</p>
          </div>
          <div>
            <Label>Entry Price</Label>
            <Input type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="e.g. 1.0850" />
          </div>
          <div>
            <Label>Stop Loss</Label>
            <Input type="number" step="any" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="e.g. 1.0820" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contract Size</Label>
              <Input type="number" value={contractSize} onChange={(e) => setContractSize(e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">FX std lot = 100,000</p>
            </div>
            <div>
              <Label>Display</Label>
              <Select value={unit} onValueChange={(v: "units" | "lots") => setUnit(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lots">Lots</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl p-5 border border-primary/30" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-glow)" }}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Position Size</p>
            <p className="text-4xl font-bold gradient-text mt-2">
              {result ? (unit === "lots" ? result.lots.toFixed(3) : result.positionUnits.toFixed(0)) : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{unit === "lots" ? "Lots" : "Units"}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">Risk Amount</p>
              <p className="text-xl font-bold text-destructive mt-1">${result?.riskAmount.toFixed(2) ?? "—"}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-muted-foreground">SL Distance</p>
              <p className="text-xl font-bold mt-1">{result?.distance.toFixed(4) ?? "—"}</p>
            </div>
          </div>

          {result && (
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Profit Targets (R:R)</p>
              <div className="space-y-2">
                {result.rrTargets.map((rr) => (
                  <div key={rr.ratio} className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                    <span className="font-medium">1:{rr.ratio} R</span>
                    <span className="text-muted-foreground text-xs">@ {rr.target.toFixed(4)}</span>
                    <span className="font-bold text-success">+${rr.profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parseFloat(riskPct) > 2 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-destructive/90">Risking more than 2% per trade is aggressive. Consider lowering it.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Risk of Ruin ──────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-destructive/20">
            <TrendingDown className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold">Risk of Ruin</h2>
            <p className="text-xs text-muted-foreground">Probability of blowing up your account</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Win Rate (%)</Label>
            <Input type="number" step="1" min="1" max="99" value={rorWinRate} onChange={(e) => setRorWinRate(e.target.value)} placeholder="e.g. 55" />
          </div>
          <div>
            <Label>Avg Win ($)</Label>
            <Input type="number" step="any" value={rorAvgWin} onChange={(e) => setRorAvgWin(e.target.value)} placeholder="e.g. 150" />
          </div>
          <div>
            <Label>Avg Loss ($)</Label>
            <Input type="number" step="any" value={rorAvgLoss} onChange={(e) => setRorAvgLoss(e.target.value)} placeholder="e.g. 100" />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Risk of Ruin</p>
            <p className={`text-3xl font-bold mt-1 ${rorColor}`}>{rorLabel}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Based on {riskPct}% risk/trade · {rorWinRate}% WR · ${rorAvgWin} avg win · ${rorAvgLoss} avg loss
            </p>
          </div>
          {!isNaN(ror) && (
            <div className="shrink-0">
              <div className="relative h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={ror >= 20 ? "hsl(var(--destructive))" : ror >= 5 ? "hsl(40 95% 55%)" : "hsl(var(--success))"}
                    strokeWidth="3"
                    strokeDasharray={`${Math.min(ror, 100)} ${100 - Math.min(ror, 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${rorColor}`}>
                  {ror >= 100 ? "100%" : `${Math.round(ror)}%`}
                </span>
              </div>
            </div>
          )}
        </div>

        {!isNaN(ror) && ror >= 5 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive/90">
              {ror >= 20
                ? "High risk of ruin! Reduce your risk per trade or improve your win rate."
                : "Moderate risk of ruin. Consider tightening risk parameters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
