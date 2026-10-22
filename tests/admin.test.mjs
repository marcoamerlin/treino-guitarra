import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSWORD_MIN, PASSWORD_MAX, generatePassword, validatePassword, validateNewUser, isAdmin, createUser,
} from '../js/admin-core.js';

// ---- senha temporária -------------------------------------------------------------------

test('generatePassword: tamanho certo, só caracteres sem ambiguidade, com maiúscula, minúscula e número', () => {
  for (let i = 0; i < 200; i++) {
    const p = generatePassword();
    assert.equal(p.length, 12);
    assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/);   // sem 0 O 1 l I
    assert.match(p, /[A-Z]/);
    assert.match(p, /[a-z]/);
    assert.match(p, /[0-9]/);
    assert.equal(validatePassword(p), null);
  }
});

test('generatePassword: sai diferente a cada vez e respeita o tamanho pedido', () => {
  const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
  assert.equal(seen.size, 50);
  assert.equal(generatePassword(20).length, 20);
});

test('generatePassword: o sorteio é injetável (determinístico nos testes)', () => {
  const zero = () => 0;
  assert.equal(generatePassword(12, zero), generatePassword(12, zero));
});

// ---- validação --------------------------------------------------------------------------

test('validatePassword: de 8 a 72 caracteres', () => {
  assert.equal(validatePassword('a'.repeat(PASSWORD_MIN - 1)) !== null, true);
  assert.equal(validatePassword('a'.repeat(PASSWORD_MIN)), null);
  assert.equal(validatePassword('a'.repeat(PASSWORD_MAX)), null);
  assert.equal(validatePassword('a'.repeat(PASSWORD_MAX + 1)) !== null, true);
  assert.notEqual(validatePassword(undefined), null);
  assert.notEqual(validatePassword(''), null);
});

test('validateNewUser: e-mail vira minúsculo e sem espaços nas pontas; a senha fica como veio', () => {
  const r = validateNewUser({ email: '  Aluno@Exemplo.COM ', password: ' Senha Com Espaço 9 ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { email: 'aluno@exemplo.com', password: ' Senha Com Espaço 9 ' });
});

test('validateNewUser: recusa e-mail inválido e senha fora da faixa, com mensagem em português', () => {
  for (const email of ['', '   ', 'sem-arroba', 'a@b', 'a b@c.com', '@c.com', `${'x'.repeat(250)}@c.com`, undefined]) {
    const r = validateNewUser({ email, password: 'senha-boa-123' });
    assert.equal(r.ok, false, `deveria recusar: ${email}`);
    assert.match(r.error, /e-mail/i);
  }
  const short = validateNewUser({ email: 'a@b.com', password: '1234567' });
  assert.equal(short.ok, false);
  assert.match(short.error, /pelo menos 8/);
  assert.equal(validateNewUser().ok, false);
});

// ---- é administrador? -------------------------------------------------------------------

const adminsClient = ({ row = null, error = null, throws = false } = {}) => ({
  from(table) {
    assert.equal(table, 'admins');
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (throws) throw new Error('rede caiu');
            return { data: row && row.user_id === val ? row : null, error };
          },
        }),
      }),
    };
  },
});

test('isAdmin: verdadeiro só quando a própria linha existe em admins', async () => {
  assert.equal(await isAdmin(adminsClient({ row: { user_id: 'u1' } }), 'u1'), true);
  assert.equal(await isAdmin(adminsClient({ row: { user_id: 'u1' } }), 'u2'), false);
  assert.equal(await isAdmin(adminsClient({ row: null }), 'u1'), false);
});

test('isAdmin: qualquer falha (tabela inexistente, rede, sem sessão) vira falso, nunca lança', async () => {
  assert.equal(await isAdmin(adminsClient({ error: { code: '42P01', message: 'relation "admins" does not exist' } }), 'u1'), false);
  assert.equal(await isAdmin(adminsClient({ throws: true }), 'u1'), false);
  assert.equal(await isAdmin(null, 'u1'), false);
  assert.equal(await isAdmin(adminsClient(), null), false);
});

// ---- cadastrar --------------------------------------------------------------------------

// Erro como o supabase-js devolve quando a função responde com status de erro.
const httpError = (status, body) => ({
  message: 'Edge Function returned a non-2xx status code',
  context: { status, json: async () => body },
});

const functionsClient = (reply) => {
  const calls = [];
  return {
    calls,
    functions: { invoke: async (name, options) => { calls.push({ name, options }); return reply(options); } },
  };
};

test('createUser: manda e-mail normalizado e senha pra função create-user e devolve o usuário criado', async () => {
  const client = functionsClient((o) => ({ data: { id: 'novo-id', email: o.body.email }, error: null }));
  const made = await createUser(client, { email: ' Novo@Exemplo.com ', password: 'Senha-Boa-123' });
  assert.deepEqual(made, { id: 'novo-id', email: 'novo@exemplo.com' });
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].name, 'create-user');
  assert.deepEqual(client.calls[0].options.body, { email: 'novo@exemplo.com', password: 'Senha-Boa-123' });
});

test('createUser: dado inválido nem chega à rede', async () => {
  const client = functionsClient(() => { throw new Error('não devia chamar'); });
  await assert.rejects(() => createUser(client, { email: 'ruim', password: 'Senha-Boa-123' }), /e-mail válido/);
  await assert.rejects(() => createUser(client, { email: 'a@b.com', password: 'curta' }), /pelo menos 8/);
  assert.equal(client.calls.length, 0);
});

test('createUser: traduz os códigos de erro da função', async () => {
  const cases = [
    [403, 'not_admin', /Só administradores/],
    [409, 'email_exists', /Já existe um usuário/],
    [401, 'not_authenticated', /Entre na sua conta/],
    [422, 'weak_password', /fraca demais/],
    [400, 'invalid_email', /e-mail válido/],
    [400, 'invalid_password', /de 8 a 72/],
  ];
  for (const [status, code, expected] of cases) {
    const client = functionsClient(() => ({ data: null, error: httpError(status, { error: code }) }));
    await assert.rejects(() => createUser(client, { email: 'a@b.com', password: 'Senha-Boa-123' }), expected, code);
  }
});

test('createUser: função não publicada (404), sem rede e erro desconhecido dão mensagem útil', async () => {
  const run = (error) => createUser(functionsClient(() => ({ data: null, error })), { email: 'a@b.com', password: 'Senha-Boa-123' });
  await assert.rejects(() => run({ message: 'x', context: { status: 404, json: async () => { throw new Error('sem corpo'); } } }), /ainda não foi publicada/);
  await assert.rejects(() => run({ message: 'Failed to send a request to the Edge Function' }), /Sem conexão/);
  await assert.rejects(() => run(httpError(500, { error: 'server_error' })), /Não consegui cadastrar agora/);
  await assert.rejects(() => run({ message: 'estranho' }), /Não consegui cadastrar agora/);
});

test('createUser: resposta de sucesso sem id é tratada como falha (nunca finge que criou)', async () => {
  const client = functionsClient(() => ({ data: {}, error: null }));
  await assert.rejects(() => createUser(client, { email: 'a@b.com', password: 'Senha-Boa-123' }), /Não consegui cadastrar agora/);
});
