-- LOVERS GARAGE shared backend
-- Run this entire script in Supabase SQL Editor.
-- Then create TWO PUBLIC buckets named: media and avatars.
-- Auth > Providers: enable Email provider and turn OFF email confirmation.
-- This project intentionally uses a synthetic internal email from the username-only UI.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  description text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  constraint profiles_description_length check (char_length(description) <= 100),
  constraint profiles_username_unique unique (username_lower)
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint media_name_length check (char_length(name) between 1 and 150),
  constraint media_type_allowed check (mime_type in ('image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','video/quicktime')),
  constraint media_size_limit check (size > 0 and size <= 52428800)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','dislike')),
  created_at timestamptz not null default now(),
  unique(media_id,user_id)
);

create index if not exists media_created_at_idx on public.media(created_at desc);
create index if not exists media_owner_idx on public.media(owner_id);
create index if not exists reactions_media_idx on public.reactions(media_id);

alter table public.profiles enable row level security;
alter table public.media enable row level security;
alter table public.reactions enable row level security;

-- Profiles: public read; users can edit only their own profile.
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);
drop policy if exists "profiles_owner_insert" on public.profiles;
create policy "profiles_owner_insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Media: public read; authenticated users insert; owners edit/delete.
drop policy if exists "media_public_read" on public.media;
create policy "media_public_read" on public.media for select using (true);
drop policy if exists "media_authenticated_insert" on public.media;
create policy "media_authenticated_insert" on public.media for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "media_owner_update" on public.media;
create policy "media_owner_update" on public.media for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "media_owner_delete" on public.media;
create policy "media_owner_delete" on public.media for delete to authenticated using (auth.uid() = owner_id);

-- Reactions: public read; users can only change their own reaction.
drop policy if exists "reactions_public_read" on public.reactions;
create policy "reactions_public_read" on public.reactions for select using (true);
drop policy if exists "reactions_owner_insert" on public.reactions;
create policy "reactions_owner_insert" on public.reactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "reactions_owner_update" on public.reactions;
create policy "reactions_owner_update" on public.reactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reactions_owner_delete" on public.reactions;
create policy "reactions_owner_delete" on public.reactions for delete to authenticated using (auth.uid() = user_id);

-- Automatically create the profile after Supabase Auth creates the account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage RLS. The two buckets themselves should be created as PUBLIC in the Storage UI.
-- These policies stop one user from uploading into another user's folder or deleting another user's files.
drop policy if exists "media_bucket_public_read" on storage.objects;
create policy "media_bucket_public_read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media_bucket_owner_insert" on storage.objects;
create policy "media_bucket_owner_insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "media_bucket_owner_delete" on storage.objects;
create policy "media_bucket_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_bucket_public_read" on storage.objects;
create policy "avatar_bucket_public_read" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "avatar_bucket_owner_insert" on storage.objects;
create policy "avatar_bucket_owner_insert" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar_bucket_owner_delete" on storage.objects;
create policy "avatar_bucket_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
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
