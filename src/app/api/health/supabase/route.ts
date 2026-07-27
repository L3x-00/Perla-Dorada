import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("app_settings")
      .select("id", { head: true, count: "exact" })
      .eq("id", true);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          service: "supabase",
          error: "No fue posible verificar la base de datos.",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        service: "supabase",
        connected: true,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check de Supabase falló:", error);

    return NextResponse.json(
      {
        ok: false,
        service: "supabase",
        error: "No fue posible verificar la base de datos.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
