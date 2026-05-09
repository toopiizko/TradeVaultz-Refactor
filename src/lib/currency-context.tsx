import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getUsdThbRate } from "@/lib/currency";

type Currency = "USD" | "THB";
type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rate: number;
};

const STORAGE_KEY = "tv:currency";
const CurrencyCtx = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    if (typeof window === "undefined") return "USD";
    return (localStorage.getItem(STORAGE_KEY) as Currency) ?? "USD";
  });
  const [rate, setRate] = useState(36);

  useEffect(() => { getUsdThbRate().then(setRate); }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  return (
    <CurrencyCtx.Provider value={{ currency, setCurrency, rate }}>
      {children}
    </CurrencyCtx.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyCtx);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
