// Liga o cadastro por administrador (admin-core.js) à conexão já autenticada do sync.js.
// Só funciona com sincronização ligada e logado (precisa do client do Supabase).

import { sync } from './sync.js';
import * as core from './admin-core.js';

export const admin = {
  async isAdmin() {
    return core.isAdmin(sync.getClient(), sync.getUserId());
  },
  async createUser(fields) {
    const client = sync.getClient();
    if (!client) throw new Error('Entre na sua conta primeiro.');
    return core.createUser(client, fields);
  },
};
