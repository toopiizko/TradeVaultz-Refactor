ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS wallet_id UUID;
CREATE INDEX IF NOT EXISTS idx_expenses_wallet_id ON public.expenses(wallet_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);