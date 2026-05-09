import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePortfolio, ALL_PORTFOLIOS } from "@/lib/portfolio";
import { Trade, STRATEGIES, EMOTIONS, calcPnL } from "@/lib/types";
import { format } from "date-fns";
import { toast } from "sonner";

export type TradeFormState = {
  asset: string;
  side: "buy" | "sell";
  entry_price: string;
  exit_price: string;
  volume: string;
  pnl: string;
  strategy: string;
  emotion: string;
  note: string;
  trade_date: string;
  portfolio_id: string;
};

const defaultForm = (): TradeFormState => ({
  asset: "",
  side: "buy",
  entry_price: "",
  exit_price: "",
  volume: "",
  pnl: "",
  strategy: STRATEGIES[0],
  emotion: EMOTIONS[0].value,
  note: "",
  trade_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  portfolio_id: "",
});

export function useTradeForm(onSuccess: () => void) {
  const { user } = useAuth();
  const { portfolios, activeId } = usePortfolio();
  const [form, setForm] = useState<TradeFormState>(defaultForm);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-fill portfolio from active selection
  useEffect(() => {
    if (form.portfolio_id) return;
    if (activeId !== ALL_PORTFOLIOS) {
      setForm((f) => ({ ...f, portfolio_id: activeId }));
    } else if (portfolios.length === 1) {
      setForm((f) => ({ ...f, portfolio_id: portfolios[0].id }));
    }
  }, [activeId, portfolios, form.portfolio_id]);

  // Open dialog when ?new=1 (from bottom-bar FAB)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Auto-calculate PnL when entry/exit/volume/side change
  useEffect(() => {
    const entry = parseFloat(form.entry_price);
    const exit = parseFloat(form.exit_price);
    const vol = parseFloat(form.volume);
    if (!isNaN(entry) && !isNaN(exit) && !isNaN(vol) && vol > 0) {
      const computed = calcPnL({ side: form.side, entry_price: entry, exit_price: exit, volume: vol });
      setForm((f) => ({ ...f, pnl: computed.toFixed(2) }));
    }
  }, [form.entry_price, form.exit_price, form.volume, form.side]);

  const setField = <K extends keyof TradeFormState>(key: K, value: TradeFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const resetForm = () => {
    setForm((f) => ({
      ...defaultForm(),
      portfolio_id: f.portfolio_id, // keep portfolio selection
      strategy: f.strategy,         // keep last strategy
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.portfolio_id) {
      return toast.error("Please select a portfolio (or create one first)");
    }
    const entry = parseFloat(form.entry_price);
    const exit = parseFloat(form.exit_price);
    const vol = parseFloat(form.volume);
    const pnl = parseFloat(form.pnl);
    if (isNaN(pnl)) return toast.error("Please enter P&L");

    setSubmitting(true);
    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
      portfolio_id: form.portfolio_id,
      asset: form.asset.toUpperCase(),
      side: form.side,
      entry_price: entry,
      exit_price: exit,
      volume: vol,
      strategy: form.strategy,
      emotion: form.emotion,
      note: form.note || null,
      trade_date: new Date(form.trade_date).toISOString(),
      pnl,
    });
    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success("Trade logged!");
    setOpen(false);
    resetForm();
    onSuccess();
  };

  return { form, setField, open, setOpen, submitting, handleSubmit, resetForm };
}
