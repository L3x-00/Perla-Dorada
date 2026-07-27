import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readRequiredEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateSession(request: NextRequest) {
  const supabaseUrl = readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabasePublishableKey = readRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );

  let response = NextResponse.next({ request });

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

          response = NextResponse.next({ request });

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
  const isProtectedAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/admin/");

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
