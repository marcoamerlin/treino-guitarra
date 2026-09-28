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

-- Permissões da API. Ao criar o projeto, "Automatically expose new tables" deve ficar DESMARCADO
-- (nenhuma tabela nova nasce acessível). Aqui liberamos só o necessário, só para quem está logado.
-- Funciona igual se a opção tiver ficado marcada: o revoke tira o acesso do papel anônimo.
revoke all on public.user_data from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.user_data to authenticated;

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

-- ---------------------------------------------------------------------------------------------
-- Professor/aluno: um professor acompanha e edita o plano de alunos vinculados a ele.
-- O vínculo nasce do lado do ALUNO (ele digita o código do professor) — autosserviço, sem o
-- professor precisar saber o e-mail/id do aluno de antemão. Continua exigindo que a conta do
-- aluno já exista (criada à mão no painel, já que o cadastro público está desligado).
-- ---------------------------------------------------------------------------------------------

-- Um código por professor (ele mesmo cria/gera o próprio código, ver js/teacher-core.js).
create table if not exists public.teacher_codes (
  teacher_id    uuid primary key references auth.users (id) on delete cascade,
  code          text        not null unique,
  teacher_email text        not null,
  created_at    timestamptz not null default now()
);

-- O vínculo em si. student_id é chave primária: um aluno tem no máximo 1 professor por vez
-- (vincular de novo troca o professor). teacher_email/student_email ficam copiados aqui na hora
-- do vínculo só para exibir nome na tela sem precisar de acesso a auth.users (que o RLS não libera).
create table if not exists public.teacher_links (
  student_id    uuid primary key references auth.users (id) on delete cascade,
  teacher_id    uuid        not null references auth.users (id) on delete cascade,
  student_email text        not null,
  teacher_email text        not null,
  created_at    timestamptz not null default now()
);

alter table public.teacher_codes enable row level security;
alter table public.teacher_links enable row level security;

revoke all on public.teacher_codes from anon;
revoke all on public.teacher_links from anon;
grant select, insert, update on public.teacher_codes to authenticated;
-- update também é preciso aqui: o "Vincular" faz um upsert, que por baixo é um insert com
-- "on conflict do update" (vincular de novo troca de professor) — sem o grant, dava
-- "permission denied for table teacher_links" mesmo com a policy certa (achado testando, 2026-09-28).
grant select, insert, update, delete on public.teacher_links to authenticated;

drop policy if exists "teacher_codes_select_any" on public.teacher_codes;
drop policy if exists "teacher_codes_upsert_own" on public.teacher_codes;
drop policy if exists "teacher_codes_update_own" on public.teacher_codes;

-- Qualquer pessoa logada pode "resolver" um código (precisa disso para o aluno achar o
-- teacher_id a partir do código); o código sozinho não dá acesso a dado nenhum.
create policy "teacher_codes_select_any" on public.teacher_codes
  for select to authenticated using (true);

create policy "teacher_codes_upsert_own" on public.teacher_codes
  for insert to authenticated with check ((select auth.uid()) = teacher_id);

create policy "teacher_codes_update_own" on public.teacher_codes
  for update to authenticated
  using ((select auth.uid()) = teacher_id)
  with check ((select auth.uid()) = teacher_id);

drop policy if exists "teacher_links_select_related" on public.teacher_links;
drop policy if exists "teacher_links_insert_self" on public.teacher_links;
drop policy if exists "teacher_links_update_self" on public.teacher_links;
drop policy if exists "teacher_links_delete_related" on public.teacher_links;

-- Professor e aluno enxergam o próprio vínculo (o professor vê todos os alunos dele).
create policy "teacher_links_select_related" on public.teacher_links
  for select to authenticated
  using ((select auth.uid()) = teacher_id or (select auth.uid()) = student_id);

-- Só o próprio aluno cria o vínculo (linka a si mesmo a um professor).
create policy "teacher_links_insert_self" on public.teacher_links
  for insert to authenticated with check ((select auth.uid()) = student_id);

-- Idem para atualizar (o "Vincular" é um upsert: se o aluno já tinha vínculo, isto troca de
-- professor em vez de inserir de novo).
create policy "teacher_links_update_self" on public.teacher_links
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

-- Qualquer um dos dois lados pode desfazer o vínculo.
create policy "teacher_links_delete_related" on public.teacher_links
  for delete to authenticated
  using ((select auth.uid()) = teacher_id or (select auth.uid()) = student_id);

-- Estende o acesso a user_data: um professor também lê e grava a linha dos alunos vinculados a
-- ele. Confiança do tamanho do grupo (poucos professores conhecidos): a policy libera a LINHA
-- inteira, não só o campo "plans" — o app (js/teacher.js) só edita plans, nunca logs/speeds, mas
-- pelo banco um professor mal-intencionado tecnicamente poderia. Reavaliar se o app crescer além
-- de professores de confiança pessoal do dono do projeto.
drop policy if exists "user_data_select_teacher" on public.user_data;
drop policy if exists "user_data_update_teacher" on public.user_data;

create policy "user_data_select_teacher" on public.user_data
  for select to authenticated
  using (exists (
    select 1 from public.teacher_links tl
    where tl.student_id = user_data.user_id and tl.teacher_id = (select auth.uid())
  ));

create policy "user_data_update_teacher" on public.user_data
  for update to authenticated
  using (exists (
    select 1 from public.teacher_links tl
    where tl.student_id = user_data.user_id and tl.teacher_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.teacher_links tl
    where tl.student_id = user_data.user_id and tl.teacher_id = (select auth.uid())
  ));
