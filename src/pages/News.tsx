import { Newspaper, TrendingUp, Clock } from "lucide-react";
import { format, addHours, subHours } from "date-fns";

type Impact = "low" | "medium" | "high";

const news: { time: Date; currency: string; event: string; impact: Impact; forecast?: string; previous?: string }[] = [
  { time: subHours(new Date(), 2), currency: "USD", event: "Non-Farm Payrolls", impact: "high", forecast: "200K", previous: "187K" },
  { time: subHours(new Date(), 1), currency: "EUR", event: "ECB Interest Rate Decision", impact: "high", forecast: "4.50%", previous: "4.50%" },
  { time: addHours(new Date(), 1), currency: "GBP", event: "GDP m/m", impact: "medium", forecast: "0.2%", previous: "0.1%" },
  { time: addHours(new Date(), 2), currency: "JPY", event: "BoJ Press Conference", impact: "high" },
  { time: addHours(new Date(), 3), currency: "USD", event: "Crude Oil Inventories", impact: "medium", forecast: "-1.2M", previous: "+0.8M" },
  { time: addHours(new Date(), 4), currency: "AUD", event: "Employment Change", impact: "medium", forecast: "25K", previous: "61K" },
  { time: addHours(new Date(), 5), currency: "CAD", event: "Building Permits", impact: "low", forecast: "1.5%", previous: "-2.1%" },
  { time: addHours(new Date(), 6), currency: "CHF", event: "Trade Balance", impact: "low", forecast: "5.20B", previous: "4.85B" },
  { time: addHours(new Date(), 8), currency: "USD", event: "FOMC Meeting Minutes", impact: "high" },
  { time: addHours(new Date(), 10), currency: "NZD", event: "CPI q/q", impact: "medium", forecast: "0.6%", previous: "1.8%" },
];

const impactStyles = {
  low: "bg-muted/40 text-muted-foreground border-muted",
  medium: "bg-warning/15 text-warning border-warning/40",
  high: "bg-destructive/15 text-destructive border-destructive/40",
};

export default function News() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
          <Newspaper className="h-5 w-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Economic News</h1>
          <p className="text-muted-foreground mt-1">Upcoming economic events (mock feed)</p>
        </div>
      </div>

      <div className="grid gap-3">
        {news.map((n, i) => (
          <div key={i} className="glass-card rounded-xl p-4 hover:border-primary/40 transition-all flex items-center gap-4">
            <div className="flex flex-col items-center justify-center min-w-[60px] text-center border-r border-border/60 pr-4">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mb-1" />
              <span className="text-sm font-bold">{format(n.time, "HH:mm")}</span>
              <span className="text-[10px] text-muted-foreground">{format(n.time, "MMM dd")}</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-secondary px-1.5 py-0.5 rounded">{n.currency}</span>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${impactStyles[n.impact]}`}>
                  {n.impact}
                </span>
              </div>
              <p className="font-medium text-sm truncate">{n.event}</p>
              {(n.forecast || n.previous) && (
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  {n.forecast && <span>Forecast: <span className="text-foreground font-medium">{n.forecast}</span></span>}
                  {n.previous && <span>Previous: <span className="text-foreground font-medium">{n.previous}</span></span>}
                </div>
              )}
            </div>

            <TrendingUp className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
