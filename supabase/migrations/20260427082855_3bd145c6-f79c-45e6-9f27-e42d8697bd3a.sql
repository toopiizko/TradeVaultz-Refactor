-- Create portfolios table
CREATE TABLE public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own portfolios" ON public.portfolios
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own portfolios" ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own portfolios" ON public.portfolios
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own portfolios" ON public.portfolios
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add portfolio_id to trades (nullable so existing rows don't break)
ALTER TABLE public.trades
  ADD COLUMN portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL;

CREATE INDEX idx_trades_portfolio_id ON public.trades(portfolio_id);
CREATE INDEX idx_portfolios_user_id ON public.portfolios(user_id);