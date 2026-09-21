// Configuração do Supabase. A chave "publishable" (antiga "anon") é PÚBLICA por desenho: quem
// protege os dados é a política de acesso por linha (RLS) de supabase/schema.sql. Nunca coloque
// aqui a chave "secret" / "service_role".
//
// Se ficar vazio, o app funciona normalmente, só que sem sincronizar.

export const SUPABASE_URL = 'https://tajewxwwhqqgaptdvbln.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_MuRjS28GczrlOQXzObgwjQ_sHNoceC5';
