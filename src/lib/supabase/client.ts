import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  /*
   * Acceso estático a process.env: Next.js solo sustituye las variables
   * NEXT_PUBLIC_* en el bundle del navegador si se leen así (no con
   * acceso dinámico). El trim evita que un espacio o salto de línea
   * pegado por error en el panel de hosting rompa las peticiones.
   */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!supabasePublishableKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey
  );
}