-- LOVERS GARAGE v1.1 — comments migration
-- Run this ONCE in Supabase SQL Editor.
-- This does not delete or modify existing media, accounts, reactions, or storage files.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(body) between 1 and 500)
);

create index if not exists comments_media_idx on public.comments(media_id, created_at);
create index if not exists comments_user_idx on public.comments(user_id);

alter table public.comments enable row level security;

drop policy if exists "comments_public_read" on public.comments;
create policy "comments_public_read" on public.comments
for select using (true);

drop policy if exists "comments_authenticated_insert" on public.comments;
create policy "comments_authenticated_insert" on public.comments
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "comments_owner_update" on public.comments;
create policy "comments_owner_update" on public.comments
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "comments_owner_delete" on public.comments;
create policy "comments_owner_delete" on public.comments
for delete to authenticated
using (auth.uid() = user_id);
