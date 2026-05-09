import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePortfolio, ALL_PORTFOLIOS } from "@/lib/portfolio";
import { Trade } from "@/lib/types";

export function useTrades() {
  const { user } = useAuth();
  const { activeId } = usePortfolio();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("trades")
      .select("*")
      .order("trade_date", { ascending: false });

    if (activeId !== ALL_PORTFOLIOS) {
      query = query.eq("portfolio_id", activeId);
    }

    const { data, error } = await query;
    if (!error && data) setTrades(data as Trade[]);
    setLoading(false);
  }, [user, activeId]);

  useEffect(() => {
    refresh();
    if (!user) return;

    // Use stable channel name (userId + portfolioId) to avoid channel leaks on re-renders
    const channelName = `trades-${user.id}-${activeId}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => refresh())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, activeId, refresh]);

  return { trades, loading, refresh };
}
