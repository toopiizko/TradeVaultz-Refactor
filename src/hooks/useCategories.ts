import { useEffect, useState, useCallback } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/types";

const KEY = "tv_custom_categories_v1";

type Store = { income: string[]; expense: string[] };

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { income: [], expense: [] };
    const parsed = JSON.parse(raw);
    return {
      income: Array.isArray(parsed.income) ? parsed.income : [],
      expense: Array.isArray(parsed.expense) ? parsed.expense : [],
    };
  } catch {
    return { income: [], expense: [] };
  }
}

function writeStore(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("tv_categories_changed"));
}

export function useCategories() {
  const [custom, setCustom] = useState<Store>(() => readStore());

  useEffect(() => {
    const onChange = () => setCustom(readStore());
    window.addEventListener("tv_categories_changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("tv_categories_changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const allIncome = [...EXPENSE_CATEGORIES.income.filter((c) => c !== "Other"), ...custom.income, "Other"];
  const allExpense = [...EXPENSE_CATEGORIES.expense.filter((c) => c !== "Other"), ...custom.expense, "Other"];

  const add = useCallback((type: "income" | "expense", name: string) => {
    const n = name.trim();
    if (!n) return false;
    const current = readStore();
    const defaults = EXPENSE_CATEGORIES[type] as readonly string[];
    const existing = [...defaults, ...current[type]].map((s) => s.toLowerCase());
    if (existing.includes(n.toLowerCase())) return false;
    const next = { ...current, [type]: [...current[type], n] };
    writeStore(next);
    return true;
  }, []);

  const remove = useCallback((type: "income" | "expense", name: string) => {
    const current = readStore();
    const next = { ...current, [type]: current[type].filter((c) => c !== name) };
    writeStore(next);
  }, []);

  const isCustom = useCallback((type: "income" | "expense", name: string) => {
    return custom[type].includes(name);
  }, [custom]);

  return { income: allIncome, expense: allExpense, add, remove, isCustom, custom };
}
