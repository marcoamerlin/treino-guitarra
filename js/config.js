// Configuração do Supabase. A chave "anon"/"publishable" é PÚBLICA por desenho: quem protege
// os dados é a política de acesso por linha (RLS) de supabase/schema.sql. Nunca coloque aqui
// a chave "service_role" / "secret".
//
// Enquanto estiver vazio, o app funciona normalmente, só que sem sincronizar.

export const SUPABASE_URL = '';
export const SUPABASE_KEY = '';
