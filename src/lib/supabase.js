import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validação — detecta config ausente antes de criar o client
const isConfigured = !!(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseKey.includes('placeholder')
);

if (!isConfigured && typeof window !== 'undefined') {
  console.error(
    '[Supabase] ⚠️ VARIÁVEIS DE AMBIENTE NÃO CONFIGURADAS!\n' +
    'Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env\n' +
    `URL: ${supabaseUrl || '(vazio)'}\nKEY: ${supabaseKey ? '***' + supabaseKey.slice(-6) : '(vazio)'}`
  );
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }, // PWA offline — sem session storage
    })
  : null;

/**
 * Retorna true se o Supabase está configurado corretamente.
 * Usado pelo syncEngine para evitar tentativas inúteis.
 */
export function isSupabaseReady() {
  return isConfigured && supabase !== null;
}
