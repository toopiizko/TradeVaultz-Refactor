-- Wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#10b981',
  icon TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallets" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wallets" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wallets" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own wallets" ON public.wallets FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

-- Expense categories table (custom user categories)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, type, name)
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own categories" ON public.expense_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own categories" ON public.expense_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own categories" ON public.expense_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own categories" ON public.expense_categories FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON public.expense_categories(user_id);

-- Categorize rules table
CREATE TABLE IF NOT EXISTS public.categorize_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('keyword','account')),
  pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income','expense')),
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categorize_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own rules" ON public.categorize_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rules" ON public.categorize_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rules" ON public.categorize_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rules" ON public.categorize_rules FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_categorize_rules_user ON public.categorize_rules(user_id);

-- Ensure wallet_id column on expenses exists
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS wallet_id UUID;
CREATE INDEX IF NOT EXISTS idx_expenses_wallet_id ON public.expenses(wallet_id);