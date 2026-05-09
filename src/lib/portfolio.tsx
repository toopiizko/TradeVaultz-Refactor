import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Portfolio = {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  initial_balance: number;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

// Sentinel value for "All portfolios" view
export const ALL_PORTFOLIOS = "__all__";
export type PortfolioFilter = string; // portfolio.id OR ALL_PORTFOLIOS

type PortfolioContextValue = {
  portfolios: Portfolio[];
  activeId: PortfolioFilter;
  setActiveId: (id: PortfolioFilter) => void;
  activePortfolio: Portfolio | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

const STORAGE_KEY = "tv:active-portfolio";

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<PortfolioFilter>(() => {
    if (typeof window === "undefined") return ALL_PORTFOLIOS;
    return localStorage.getItem(STORAGE_KEY) ?? ALL_PORTFOLIOS;
  });

  const setActiveId = useCallback((id: PortfolioFilter) => {
    setActiveIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setPortfolios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("portfolios")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setPortfolios(data as Portfolio[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const channel = supabase
      .channel("portfolios-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolios" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refresh]);

  // If active portfolio was deleted, fall back to All
  useEffect(() => {
    if (activeId === ALL_PORTFOLIOS) return;
    if (!loading && portfolios.length && !portfolios.find((p) => p.id === activeId)) {
      setActiveId(ALL_PORTFOLIOS);
    }
  }, [portfolios, activeId, loading, setActiveId]);

  const activePortfolio =
    activeId === ALL_PORTFOLIOS ? null : portfolios.find((p) => p.id === activeId) ?? null;

  return (
    <PortfolioContext.Provider value={{ portfolios, activeId, setActiveId, activePortfolio, loading, refresh }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
