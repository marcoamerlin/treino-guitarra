// Liga o motor de sincronização (sync-core.js) ao app: store, configuração e eventos do navegador.

import { createSync } from './sync-core.js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { store } from './store.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const sync = createSync({
  store,
  config: { url: SUPABASE_URL, key: SUPABASE_KEY },
  loadSdk: () => import(SDK_URL),
});

// Alterou algo neste aparelho → envia em instantes.
store.onChange(() => sync.schedule());

// Voltou para o app ou a internet voltou → busca o que outro aparelho fez.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sync.syncNow();
});
window.addEventListener('online', () => sync.syncNow());
