import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type CategorizeRule = {
  id: string;
  user_id: string;
  match_type: "keyword" | "account";
  pattern: string;
  category: string;
  transaction_type: "income" | "expense";
  priority: number;
  created_at: string;
};

export function useCategorizeRules() {
  const { user } = useAuth();
  const [rules, setRules] = useState<CategorizeRule[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("categorize_rules" as any)
      .select("*")
      .order("priority", { ascending: false });
    setRules(((data ?? []) as unknown) as CategorizeRule[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase
      .channel(`categorize_rules-changes-${user.id}-${Math.random().toString(36).slice(2, 9)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "categorize_rules" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const add = useCallback(async (data: Omit<CategorizeRule, "id" | "user_id" | "created_at">) => {
    if (!user) return;
    const { error } = await supabase
      .from("categorize_rules" as any)
      .insert({ ...data, user_id: user.id } as any);
    if (error) throw error;
  }, [user]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("categorize_rules" as any).delete().eq("id", id);
  }, []);

  /** apply rules to a transaction; returns matched category or null */
  const apply = useCallback((description: string, type: "income" | "expense"): string | null => {
    const desc = (description || "").toLowerCase();
    const candidates = rules.filter((r) => r.transaction_type === type);
    for (const r of candidates) {
      const p = r.pattern.toLowerCase().trim();
      if (!p) continue;
      if (r.match_type === "keyword") {
        if (desc.includes(p)) return r.category;
      } else {
        // account: match digits/last-4
        const onlyDigits = desc.replace(/\D/g, "");
        const patDigits = p.replace(/\D/g, "");
        if (patDigits && onlyDigits.includes(patDigits)) return r.category;
        if (desc.includes(p)) return r.category;
      }
    }
    return null;
  }, [rules]);

  return { rules, loading, add, remove, apply, refresh };
}
