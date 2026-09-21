// Motor de sincronização com o Supabase. Não depende do navegador: store, configuração
// e carregamento do SDK são injetados (ver sync.js), o que permite testar em Node.
//
// Modelo: uma linha por usuário na tabela user_data, com todos os dados em jsonb e uma
// coluna rev. Cada sincronização faz: baixar → combinar (merge.js) → gravar só se rev não
// mudou (controle otimista). Se outro aparelho gravou antes, refaz a rodada.

import { mergeData, sameData } from './merge.js';

const DEBOUNCE_MS = 2500;
const MAX_ATTEMPTS = 4;

export function createSync({ store, config, loadSdk }) {
  const configured = Boolean(config.url && config.key);
  const listeners = new Set();
  let state = { status: configured ? 'signed-out' : 'disabled', email: null, lastSync: null, error: null };
  let client = null;
  let session = null;
  let timer = null;
  let running = false;
  let again = false;

  function setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn(state));
  }

  async function init() {
    if (!configured || client) return;
    try {
      const { createClient } = await loadSdk();
      client = createClient(config.url, config.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
    } catch (e) {
      setState({ status: 'offline', error: 'Não foi possível carregar o serviço de sincronização.' });
      return;
    }
    // Só atualiza variáveis aqui: chamar o Supabase dentro deste callback pode travar.
    client.auth.onAuthStateChange((_event, next) => {
      session = next;
      if (!next) setState({ status: 'signed-out', email: null });
    });
    const { data } = await client.auth.getSession();
    session = data.session;
    if (session) {
      setState({ email: session.user.email, status: 'idle', error: null });
      await syncNow();
    }
  }

  async function signIn(email, password) {
    await init();
    if (!client) throw new Error('Sem conexão para entrar. Tente de novo com internet.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    setState({ email: session.user.email, status: 'idle', error: null });
    await syncNow();
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    session = null;
    clearTimeout(timer);
    setState({ status: 'signed-out', email: null, error: null });
  }

  async function syncNow() {
    if (!configured) return;
    if (!client) { await init(); return; }
    if (!session) return;
    if (running) { again = true; return; }

    running = true;
    clearTimeout(timer);
    setState({ status: 'syncing', error: null });
    try {
      await round();
      setState({ status: 'ok', lastSync: Date.now() });
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setState({ status: offline ? 'offline' : 'error', error: e.message || String(e) });
    } finally {
      running = false;
      if (again) { again = false; syncNow(); }
    }
  }

  async function round() {
    const userId = session.user.id;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: row, error } = await client
        .from('user_data').select('data, rev').eq('user_id', userId).maybeSingle();
      if (error) throw error;

      const local = store.snapshot();
      if (!row) {
        const { error: insertError } = await client
          .from('user_data').insert({ user_id: userId, data: local, rev: 1 });
        if (!insertError) return;
        if (insertError.code === '23505') continue; // outro aparelho criou a linha agora: refaz
        throw insertError;
      }

      const remote = row.data || {};
      const merged = mergeData(local, remote);
      if (!sameData(merged, local)) store.applyRemote(merged);
      if (sameData(merged, remote)) return; // nada a enviar

      const { data: updated, error: updateError } = await client
        .from('user_data')
        .update({ data: merged, rev: row.rev + 1, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('rev', row.rev)
        .select('rev');
      if (updateError) throw updateError;
      if (updated && updated.length) return;
      // rev mudou: outro aparelho gravou entre a leitura e a escrita. Refaz.
    }
    throw new Error('Não consegui sincronizar agora (muitas alterações ao mesmo tempo). Tente de novo.');
  }

  // Agenda um envio em breve; várias alterações seguidas viram uma sincronização só.
  function schedule() {
    if (!session) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, DEBOUNCE_MS);
  }

  return {
    configured,
    init,
    signIn,
    signOut,
    syncNow,
    schedule,
    getState: () => state,
    onState(fn) { listeners.add(fn); },
  };
}
