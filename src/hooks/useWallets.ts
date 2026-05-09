import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useExpenses } from "@/hooks/useExpenses";

export type Wallet = {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  initial_balance: number;
  color: string;
  icon: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "tv:active-wallet";
export const ALL_WALLETS = "__all_wallets__";

export function useWallets() {
  const { user } = useAuth();
  const { expenses } = useExpenses();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string>(() => {
    if (typeof window === "undefined") return ALL_WALLETS;
    return localStorage.getItem(STORAGE_KEY) ?? ALL_WALLETS;
  });

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const refresh = useCallback(async () => {
    if (!user) { setWallets([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("wallets" as any)
      .select("*")
      .order("created_at", { ascending: true });
    setWallets(((data ?? []) as unknown) as Wallet[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    // BUG FIX 3: stable channel name for wallets
    const ch = supabase
      .channel(`wallets-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "wallets",
        filter: `user_id=eq.${user.id}`,
      }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, refresh]);

  const create = useCallback(async (
    data: Omit<Wallet, "id" | "user_id" | "created_at" | "updated_at" | "icon"> & { icon?: string | null }
  ) => {
    if (!user) return null;
    const { data: created, error } = await supabase
      .from("wallets" as any)
      .insert({ ...data, user_id: user.id } as any)
      .select()
      .single();
    if (error) throw error;
    return created as unknown as Wallet;
  }, [user]);

  const update = useCallback(async (id: string, patch: Partial<Wallet>) => {
    const { error } = await supabase.from("wallets" as any).update(patch as any).eq("id", id);
    if (error) throw error;
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from("wallets" as any).delete().eq("id", id);
    if (error) throw error;
    if (activeId === id) setActiveId(ALL_WALLETS);
  }, [activeId, setActiveId]);

  const balances = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of wallets) m.set(w.id, Number(w.initial_balance) || 0);
    for (const e of expenses) {
      const wid = (e as any).wallet_id as string | null | undefined;
      if (!wid) continue;
      const cur = m.get(wid);
      if (cur === undefined) continue;
      const amt = Number(e.amount) || 0;
      m.set(wid, e.type === "income" ? cur + amt : cur - amt);
    }
    return m;
  }, [wallets, expenses]);

  const balanceOf = useCallback((id: string) => balances.get(id) ?? 0, [balances]);
  const active = activeId === ALL_WALLETS ? null : wallets.find((w) => w.id === activeId) ?? null;

  return { wallets, loading, activeId, setActiveId, active, refresh, create, update, remove, balances, balanceOf };
}
