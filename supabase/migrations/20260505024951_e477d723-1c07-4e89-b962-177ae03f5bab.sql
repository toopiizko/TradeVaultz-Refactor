create table public.shortcut_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null default 'iOS Shortcut',
  token_hash text not null unique,
  wallet_id uuid,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index shortcut_tokens_user_idx on public.shortcut_tokens(user_id);

alter table public.shortcut_tokens enable row level security;

create policy "Users view own tokens" on public.shortcut_tokens
  for select using (auth.uid() = user_id);
create policy "Users insert own tokens" on public.shortcut_tokens
  for insert with check (auth.uid() = user_id);
create policy "Users update own tokens" on public.shortcut_tokens
  for update using (auth.uid() = user_id);
create policy "Users delete own tokens" on public.shortcut_tokens
  for delete using (auth.uid() = user_id);