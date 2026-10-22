// Edge Function `create-user`: cadastra um usuário novo, só a pedido de um administrador.
//
// Por que existe: criar usuário exige a chave secreta (service_role) do Supabase, que nunca pode
// ficar dentro do app. Aqui, no servidor, ela fica guardada e só é usada depois de conferir que
// quem pediu está na tabela `admins` (ver supabase/schema.sql).
//
// Como publicar (sem instalar nada): painel do Supabase → Edge Functions → Deploy a new function →
// "Via Editor" → nome `create-user` → colar este arquivo → Deploy. Deixe "Verify JWT" LIGADO.
// As variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente
// da função; não precisa configurar nada.
//
// Chamada (feita pelo app, ver js/admin-core.js):  POST { email, password }  com o login do admin.
// Respostas: 201 { id, email } | 4xx { error: <código> } — os códigos são traduzidos no app.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*', // a trava é o login do admin (Bearer), não a origem
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401);

  // 1) Quem está pedindo? Cliente com o login da própria pessoa (a chave anon não vale como login).
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: who, error: whoError } = await asCaller.auth.getUser();
  if (whoError || !who?.user) return json({ error: 'not_authenticated' }, 401);

  // 2) É administrador? Lê a tabela com o login dela: o RLS só deixa ver a própria linha.
  const { data: adminRow, error: adminError } = await asCaller
    .from('admins').select('user_id').eq('user_id', who.user.id).maybeSingle();
  if (adminError) return json({ error: 'server_error' }, 500);
  if (!adminRow) return json({ error: 'not_admin' }, 403);

  // 3) Dados do novo usuário (mesmos limites do app, js/admin-core.js).
  let body: { email?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid_body' }, 400); }
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);
  if (password.length < 8 || password.length > 72) return json({ error: 'invalid_password' }, 400);

  // 4) Cria a conta, já confirmada (não depende de e-mail de confirmação). Só aqui entra a chave secreta.
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (error.code === 'email_exists' || /already|registered/i.test(error.message)) return json({ error: 'email_exists' }, 409);
    if (error.code === 'weak_password') return json({ error: 'weak_password' }, 422);
    return json({ error: 'create_failed' }, 400);
  }
  return json({ id: data.user.id, email: data.user.email }, 201);
});
