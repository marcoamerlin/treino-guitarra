# Publicar e sincronizar

Duas partes independentes: **GitHub Pages** publica o app (HTTPS, necessário para instalar no
celular) e **Supabase** guarda o treino para sincronizar entre aparelhos.

## 1. GitHub Pages

1. Em https://github.com/new: nome `treino-guitarra`, **Public**, sem README/.gitignore/licença.
   (GitHub Pages gratuito exige repositório público. O repositório só tem código e conteúdo de treino.)
2. `git remote add origin https://github.com/marcoamerlin/treino-guitarra.git` e `git push -u origin main`.
3. No repositório: Settings → Pages → Build and deployment → Source: **Deploy from a branch** →
   Branch: `main`, pasta `/ (root)` → Save.
4. Em ~1 minuto o app fica em https://marcoamerlin.github.io/treino-guitarra/.
   Cada `git push` republica sozinho.

No celular, abrir o endereço no Chrome (Android) ou Safari (iPhone) e usar
"Instalar app" / "Adicionar à Tela de Início".

## 2. Supabase

1. Em https://supabase.com: New project (nome `treino-guitarra`, região **South America (São Paulo)**
   ou "Americas", guarde a senha do banco). Plano gratuito. Em **Security**: deixar **Enable Data API**
   marcado, **desmarcar** "Automatically expose new tables" e **marcar** "Enable automatic RLS".
2. **SQL Editor** → colar todo o conteúdo de `supabase/schema.sql` → Run.
3. **Authentication → Users → Add user → Create new user**: e-mail e senha, marcando
   **Auto Confirm User**. Esta é a sua conta.
4. **Authentication → Sign In / Providers**: desligar **Allow new users to sign up**
   (só a sua conta existe; ninguém mais consegue criar).
5. **Project Settings → API**: copiar **Project URL** e a chave **anon / publishable**
   para `js/config.js`. Essas duas são públicas por desenho: a proteção dos dados é o RLS do
   `schema.sql`. **Nunca** colocar a chave `service_role` / `secret` no app.
6. Abrir o app → botão de conta (canto do cabeçalho) → entrar com o e-mail e a senha do passo 3.
   Repetir em cada aparelho.

Observação: projetos gratuitos do Supabase são pausados após 7 dias sem uso. Usando o app
diariamente isso não acontece; se pausar, basta reativar no painel.

## 3. Atualizar o schema (professor/aluno)

Sempre que `supabase/schema.sql` mudar (por exemplo, a função de professor acompanhar aluno):
**SQL Editor** → colar todo o conteúdo do arquivo de novo → Run. É seguro rodar de novo mesmo já
tendo dados: as tabelas e políticas existentes não são apagadas, só criadas as que faltam.

Depois de rodar, qualquer usuário pode: em **Conta e sincronização**, abrir "▸ Sou professor de
alguém" para gerar um código e ver a lista de alunos vinculados; ou, para ser aluno de alguém,
digitar o código dele no campo "Vincular a um professor". Continua sendo preciso criar a conta de
cada pessoa manualmente (passo 3 acima) — o código só cria o vínculo, não a conta.

## 4. Cadastro de usuários por um administrador

Em vez de criar cada conta à mão no painel (passo 3 da seção 2), um **administrador** cadastra pelo
próprio app: **Conta e sincronização → ▸ Cadastrar usuário (administrador)** → e-mail + senha
temporária (o botão "Gerar senha" cria uma boa) → Cadastrar. O app mostra os dados prontos para
copiar e mandar à pessoa; ela entra e troca a senha em **▸ Trocar minha senha**.

Por que precisa de uma função no servidor: criar usuário exige a chave secreta (`service_role`) do
Supabase, que **nunca** pode ficar dentro do app. Ela fica numa *Edge Function* (código que roda
no Supabase) que só cria a conta depois de conferir que quem pediu está na tabela `admins`. O
cadastro público continua **desligado**.

Configuração, uma vez só (nada para instalar no computador):

1. **SQL Editor** → colar `supabase/schema.sql` de novo → Run (cria a tabela `admins`; é seguro
   rodar de novo, como na seção 3).
2. **Edge Functions → Deploy a new function → Via Editor**. Nome: `create-user` (exatamente).
   Colar todo o conteúdo de `supabase/functions/create-user/index.ts` → **Deploy**. Deixe
   **Verify JWT** ligado. Não é preciso configurar variáveis: `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente da função.
3. Tornar a primeira pessoa administradora: **SQL Editor** → trocar o e-mail pelo da conta que vai
   administrar (ela precisa já existir, criada no passo 3 da seção 2) → Run:

   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'seu-email@exemplo.com';
   ```

   Para ver quem é admin: `select * from public.admins;`. Para tirar: `delete from public.admins
   where email = '...';`. Não há como virar admin pelo app, de propósito.
4. Abrir o app, entrar com essa conta (feche e abra o app se acabou de publicar): a opção
   "Cadastrar usuário (administrador)" aparece em **Conta e sincronização**.

Se aparecer "A função de cadastro ainda não foi publicada", o passo 2 não foi feito (ou o nome
não é exatamente `create-user`). Se aparecer "Só administradores podem cadastrar usuários", o
passo 3 não pegou: confira o e-mail e rode `select * from public.admins;`.

Segurança: a função confere o login de quem pediu e a tabela `admins` a cada cadastro (esconder a
tela no app é só conforto, não é a trava); a senha temporária só aparece na tela do admin e não é
guardada em lugar nenhum; cada admin pode cadastrar qualquer pessoa, então só dê esse poder a quem
é de confiança.

## Testar localmente

- `npm start` (ou `node tools/serve.mjs`) → http://localhost:5173 no notebook.
- No celular, na mesma rede: `http://<IP do notebook>:5173`. Funciona layout, toque e som, mas
  instalar, modo offline e manter a tela acesa exigem HTTPS (só no GitHub Pages).
- `npm test` roda os testes da combinação de dados e da sincronização.
