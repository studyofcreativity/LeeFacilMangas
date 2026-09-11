-- ============================================================
-- LeeMangasCross — Social: likes, dislikes, comentarios, leídos
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1) Tablas
create table if not exists public.chapter_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.capitulos(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);

create table if not exists public.chapter_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.capitulos(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.chapter_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.capitulos(id) on delete cascade,
  manga_id uuid null,
  completed_at timestamptz not null default now(),
  unique (user_id, chapter_id)
);

create index if not exists chapter_reactions_chapter_idx on public.chapter_reactions(chapter_id);
create index if not exists chapter_comments_chapter_idx on public.chapter_comments(chapter_id, created_at desc);
create index if not exists chapter_reads_user_idx on public.chapter_reads(user_id);
create index if not exists chapter_reads_chapter_idx on public.chapter_reads(chapter_id);

-- 2) RLS
alter table public.chapter_reactions enable row level security;
alter table public.chapter_comments enable row level security;
alter table public.chapter_reads enable row level security;

-- Reactions: todos pueden leer; cada usuario gestiona las suyas
drop policy if exists "reactions_select_all" on public.chapter_reactions;
create policy "reactions_select_all" on public.chapter_reactions
  for select to anon, authenticated using (true);

drop policy if exists "reactions_insert_own" on public.chapter_reactions;
create policy "reactions_insert_own" on public.chapter_reactions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reactions_update_own" on public.chapter_reactions;
create policy "reactions_update_own" on public.chapter_reactions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reactions_delete_own" on public.chapter_reactions;
create policy "reactions_delete_own" on public.chapter_reactions
  for delete to authenticated
  using (auth.uid() = user_id);

-- Comments
drop policy if exists "comments_select_all" on public.chapter_comments;
create policy "comments_select_all" on public.chapter_comments
  for select to anon, authenticated using (true);

drop policy if exists "comments_insert_own" on public.chapter_comments;
create policy "comments_insert_own" on public.chapter_comments
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.chapter_comments;
create policy "comments_delete_own" on public.chapter_comments
  for delete to authenticated
  using (auth.uid() = user_id);

-- Reads
drop policy if exists "reads_select_own" on public.chapter_reads;
create policy "reads_select_own" on public.chapter_reads
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reads_insert_own" on public.chapter_reads;
create policy "reads_insert_own" on public.chapter_reads
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reads_update_own" on public.chapter_reads;
create policy "reads_update_own" on public.chapter_reads
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Grants
grant select, insert, update, delete on public.chapter_reactions to authenticated;
grant select on public.chapter_reactions to anon;
grant select, insert, delete on public.chapter_comments to authenticated;
grant select on public.chapter_comments to anon;
grant select, insert, update on public.chapter_reads to authenticated;

-- ============================================================
-- TAMBIÉN EN EL DASHBOARD (manual):
-- Authentication → Providers → Anonymous Sign-Ins → Enable
-- ============================================================
