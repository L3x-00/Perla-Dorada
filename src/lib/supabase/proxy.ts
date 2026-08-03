import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readRequiredEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
) {
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabasePublishableKey = readRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request: { headers: requestHeaders },
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims?.sub);

  const pathname = request.nextUrl.pathname;
  const isAdminLogin = pathname === "/admin/login";
  const isAdminApiRoute = pathname.startsWith("/api/admin/");
  const isProtectedAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    isAdminApiRoute;

  /*
   * El proxy no es la única defensa (cada mutación también valida en la
   * ruta o RPC), pero sí evita que una cuenta de Auth sin perfil activo vea
   * las páginas administrativas de solo lectura, que contienen PII.
   */
  let isActiveAdmin = false;

  if (isAuthenticated && isProtectedAdminRoute) {
    const userId = data?.claims?.sub;
    if (typeof userId === "string") {
      const adminClient = createAdminClient();
      const { data: profile, error: profileError } = await adminClient
        .from("admin_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (profileError) {
        console.error("No se pudo verificar el perfil administrativo:", {
          code: profileError.code,
          message: profileError.message,
        });
      } else {
        isActiveAdmin = profile !== null;
      }
    }
  }

  if (isProtectedAdminRoute && !isAdminLogin && !isActiveAdmin) {
    /*
     * Los formularios administrativos consumen JSON. Redirigir una llamada
     * fetch a /admin/login transforma un 401 controlado en HTML y acaba como
     * un error genérico en la interfaz. Las páginas siguen redirigiendo; las
     * APIs conservan su contrato HTTP.
     */
    if (isAdminApiRoute) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  if (isAdminLogin && isActiveAdmin) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = "/admin";
    adminUrl.search = "";

    return NextResponse.redirect(adminUrl);
  }

  return response;
}
