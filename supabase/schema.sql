-- Treino de Guitarra: banco no Supabase.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
--
-- Uma linha por usuário guarda todos os dados do treino (jsonb). A coluna rev serve para o
-- controle otimista: um aparelho só grava se ninguém gravou antes (ver js/sync-core.js).

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  rev        bigint      not null default 0,
  updated_at timestamptz not null default now()
);

-- Segurança por linha: cada usuário só enxerga e altera a própria linha.
alter table public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;

create policy "user_data_select_own" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "user_data_insert_own" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "user_data_update_own" on public.user_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sem policy de delete: ninguém apaga a linha pelo app.
