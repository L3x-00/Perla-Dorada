import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readRequiredEnv } from "@/lib/env";

export async function createClient() {
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabasePublishableKey = readRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },

      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /*
           * Los Server Components no pueden modificar cookies.
           * El Proxy que crearemos después se encargará
           * de actualizar la sesión.
           */
        }
      },
    },
  });
}