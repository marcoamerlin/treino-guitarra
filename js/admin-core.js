// Cadastro de usuários por um administrador (pedido do usuário, 2026-10-22).
// Não depende do navegador: recebe o client do Supabase já autenticado (ver admin.js), no mesmo
// espírito de teacher-core.js, e é testado com um client de mentira (tests/admin.test.mjs).
//
// Criar usuário no Supabase exige a chave secreta (service_role), que NUNCA pode ficar no app.
// Por isso quem cria é a Edge Function `create-user` (supabase/functions/create-user/index.ts),
// que roda no servidor, confere se quem pediu está na tabela `admins` e só então cria a conta.
// Aqui ficam só as partes do lado do app: validar antes de enviar, gerar a senha temporária,
// saber se a pessoa é admin (pra mostrar ou esconder a tela) e traduzir os erros.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite do bcrypt, que o Supabase usa nas senhas
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sem 0/O, 1/l/I: a senha vai ser lida e digitada por outra pessoa.
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

// Inteiro aleatório em [0, max) por sorteio criptográfico, sem viés (descarta o resto da divisão).
function secureInt(max) {
  const cap = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let n;
  do { globalThis.crypto.getRandomValues(buf); n = buf[0]; } while (n >= cap);
  return n % max;
}

// `randomInt(max)` injetável pra testar. Garante ao menos 1 maiúscula, 1 minúscula e 1 número.
export function generatePassword(length = 12, randomInt = secureInt) {
  const pick = (chars) => chars[randomInt(chars.length)];
  const upper = PASSWORD_CHARS.replace(/[^A-Z]/g, '');
  const lower = PASSWORD_CHARS.replace(/[^a-z]/g, '');
  const digits = PASSWORD_CHARS.replace(/[^0-9]/g, '');
  const out = [pick(upper), pick(lower), pick(digits)];
  while (out.length < length) out.push(pick(PASSWORD_CHARS));
  for (let i = out.length - 1; i > 0; i--) { // embaralha (Fisher-Yates) pra os 3 garantidos não ficarem no começo
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

export function validatePassword(password) {
  const p = String(password ?? '');
  if (p.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (p.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

// Confere os dois campos antes de gastar uma chamada de rede. O e-mail vira minúsculo e sem espaços
// nas pontas (o Supabase trata e-mail sem diferenciar maiúsculas; assim o aluno entra digitando como quiser).
export function validateNewUser({ email, password } = {}) {
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > EMAIL_MAX || !EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'Digite um e-mail válido.' };
  }
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };
  return { ok: true, value: { email: cleanEmail, password: String(password) } };
}

// A pessoa logada é administradora? Qualquer falha (tabela ainda não criada, sem rede) vira "não":
// o pior caso é a tela de cadastro não aparecer, nunca aparecer pra quem não deve (e a função no
// servidor confere de novo, então esconder a tela é só conforto, não é a trava).
export async function isAdmin(client, userId) {
  if (!client || !userId) return false;
  try {
    const { data, error } = await client.from('admins').select('user_id').eq('user_id', userId).maybeSingle();
    return !error && Boolean(data);
  } catch (e) {
    return false;
  }
}

const MESSAGES = {
  not_authenticated: 'Entre na sua conta primeiro.',
  not_admin: 'Só administradores podem cadastrar usuários.',
  email_exists: 'Já existe um usuário com esse e-mail.',
  invalid_email: 'Digite um e-mail válido.',
  invalid_password: `A senha precisa ter de ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres.`,
  weak_password: 'O Supabase achou essa senha fraca demais. Use a opção de gerar senha.',
};

// O client do Supabase devolve o erro da função com a resposta HTTP dentro (error.context);
// o código que a função mandou ({ error: 'not_admin' }) está no corpo dela.
async function errorCode(error) {
  try { return (await error.context.json()).error || null; } catch (e) { return null; }
}

async function friendlyError(error) {
  const code = await errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  const status = error && error.context && error.context.status;
  if (status === 404) {
    return 'A função de cadastro ainda não foi publicada no Supabase (veja docs/setup.md).';
  }
  if (error && /fetch|network|failed to send/i.test(String(error.message))) {
    return 'Sem conexão. Tente de novo com internet.';
  }
  return 'Não consegui cadastrar agora. Tente de novo.';
}

// Cadastra o usuário (a conta já nasce confirmada, com a senha informada). Devolve { id, email };
// lança Error com mensagem em português pra tela mostrar direto.
export async function createUser(client, fields) {
  const checked = validateNewUser(fields);
  if (!checked.ok) throw new Error(checked.error);
  const { data, error } = await client.functions.invoke('create-user', { body: checked.value });
  if (error) throw new Error(await friendlyError(error));
  if (!data || !data.id) throw new Error('Não consegui cadastrar agora. Tente de novo.');
  return { id: data.id, email: data.email || checked.value.email };
}
