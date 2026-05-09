-- Trades table
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'buy',
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  volume NUMERIC NOT NULL,
  strategy TEXT,
  emotion TEXT,
  note TEXT,
  pnl NUMERIC NOT NULL DEFAULT 0,
  trade_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_trades_user_date ON public.trades(user_id, trade_date DESC);

-- Expenses table
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_trades_updated_at BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();