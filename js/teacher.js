// Liga o motor de professor/aluno (teacher-core.js) à conexão já autenticada do sync.js.
// Só funciona com sincronização ligada e logado (precisa do client do Supabase).

import { sync } from './sync.js';
import * as core from './teacher-core.js';

function requireClient() {
  const client = sync.getClient();
  if (!client) throw new Error('Entre na sua conta primeiro (aba Conta e sincronização).');
  return client;
}

export const teacher = {
  available: () => Boolean(sync.getClient()),

  async myCode() {
    const client = requireClient();
    return core.myCode(client, sync.getUserId(), sync.getEmail());
  },
  async linkToTeacher(code) {
    const client = requireClient();
    return core.linkToTeacher(client, sync.getUserId(), sync.getEmail(), code);
  },
  async myTeacher() {
    const client = requireClient();
    return core.myTeacher(client, sync.getUserId());
  },
  async listStudents() {
    const client = requireClient();
    return core.listStudents(client, sync.getUserId());
  },
  async unlink(studentId) {
    const client = requireClient();
    return core.unlink(client, studentId);
  },
  async fetchStudentData(studentId) {
    const client = requireClient();
    return core.fetchStudentData(client, studentId);
  },
  async writeStudentPlan(studentId, dayKey, items) {
    const client = requireClient();
    return core.writeStudentPlan(client, studentId, dayKey, items);
  },
};
