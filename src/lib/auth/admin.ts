import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/*
 * Portero de administrador para las rutas que NO pasan por un RPC.
 *
 * La mayoría de operaciones admin invocan funciones SECURITY DEFINER que ya
 * llaman a assert_active_admin dentro de PostgreSQL, así que la base rechaza
 * a quien no sea administrador activo. Pero unas pocas rutas tocan tablas o
 * Storage directamente con service_role (firmar un comprobante, escribir
 * app_settings, subir la foto del premio): ahí no hay RPC que valide nada, y
 * comprobar solo que exista sesión equipara "tener cuenta en Auth" con "ser
 * administrador". Este helper cierra esa brecha exigiendo pertenencia a
 * admin_profiles con is_active = true.
 *
 * Devuelve el user_id del administrador, o null si no lo es.
 */
export async function requireActiveAdmin(): Promise<string | null> {
  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") {
    return null;
  }

  const adminClient = createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("admin_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (profileError) {
    console.error("Error verificando administrador:", {
      code: profileError.code,
      message: profileError.message,
    });

    return null;
  }

  return profile ? userId : null;
}
