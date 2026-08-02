"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ThemeToggle } from "@/components/site/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export function AdminProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    if (isSigningOut) return;

    setError(null);
    setIsSigningOut(true);

    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;

      router.replace("/admin/login");
      router.refresh();
    } catch (caughtError) {
      console.error("No se pudo cerrar la sesion administrativa:", caughtError);
      setError("No se pudo cerrar la sesion. Intentalo nuevamente.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted transition-colors hover:border-gold hover:text-gold"
      >
        Perfil
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Opciones de perfil"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-64 rounded-xl border border-line bg-ink-2 p-2 shadow-2xl"
        >
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-ink-3 hover:text-cream"
          >
            Volver al sitio web
          </Link>

          <div className="mt-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted">
            <span>Tema</span>
            <ThemeToggle />
          </div>

          <div className="my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            disabled={isSigningOut}
            onClick={() => void signOut()}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-red-300 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigningOut ? "Cerrando sesion..." : "Cerrar sesion"}
          </button>

          {error ? (
            <p role="alert" className="px-3 pb-2 pt-1 text-xs text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
