import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Expense } from "@/lib/types";

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // BUG FIX 1: wrap refresh in useCallback so it's stable across renders
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });
    if (!error && data) setExpenses(data as Expense[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;

    // BUG FIX 2: use stable channel name (same as useTrades fix)
    const channel = supabase
      .channel(`expenses-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refresh]);

  return { expenses, loading, refresh };
}
