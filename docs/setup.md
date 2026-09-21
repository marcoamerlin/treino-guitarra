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

## Testar localmente

- `npm start` (ou `node tools/serve.mjs`) → http://localhost:5173 no notebook.
- No celular, na mesma rede: `http://<IP do notebook>:5173`. Funciona layout, toque e som, mas
  instalar, modo offline e manter a tela acesa exigem HTTPS (só no GitHub Pages).
- `npm test` roda os testes da combinação de dados e da sincronização.
