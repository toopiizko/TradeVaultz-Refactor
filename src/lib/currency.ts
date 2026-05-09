// Live exchange rate fetcher with localStorage cache
const CACHE_KEY = "fx_usd_thb";
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6h

export async function getUsdThbRate(): Promise<number> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { rate, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL) return rate;
    }
    // Free, no-key API
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    const rate = data?.rates?.THB;
    if (typeof rate === "number") {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
      return rate;
    }
  } catch (e) {
    console.warn("FX fetch failed", e);
  }
  return 36; // fallback
}

export function formatMoney(amount: number, currency: "USD" | "THB"): string {
  return new Intl.NumberFormat(currency === "THB" ? "th-TH" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
