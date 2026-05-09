-- 1. Add image_urls array to trades + expenses
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';

-- 2. Create private storage bucket for transaction images
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-images', 'transaction-images', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects: user can only manage files under their own user_id folder
CREATE POLICY "Users view own transaction images"
ON storage.objects FOR SELECT
USING (bucket_id = 'transaction-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own transaction images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'transaction-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own transaction images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'transaction-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own transaction images"
ON storage.objects FOR DELETE
USING (bucket_id = 'transaction-images' AND auth.uid()::text = (storage.foldername(name))[1]);