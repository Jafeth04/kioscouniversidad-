import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador (componentes "use client").
 * Usa la llave pública (segura para exponer en el frontend).
 */
// La URL y la llave pública (publishable) son seguras de exponer en el frontend.
// Se dejan como respaldo para que la web funcione en cualquier hosting aunque
// no se configuren variables de entorno.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://brplclozijifyhdcnsuk.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_aCJ_66bDYjmeJgnt_IMJcg_RwL_eZjE";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
