import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          service: "supabase",
          error: error.message,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      service: "supabase",
      connected: true,
      authenticated: Boolean(data.session),
      message: "Cliente SSR conectado correctamente con Supabase.",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        service: "supabase",
        error:
          error instanceof Error
            ? error.message
            : "No fue posible conectar con Supabase.",
      },
      { status: 502 },
    );
  }
}