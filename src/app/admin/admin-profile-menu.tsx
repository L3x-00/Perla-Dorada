"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/site/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export function AdminProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setIsAuthenticated(Boolean(data.user));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = Boolean(session?.user);
      setIsAuthenticated(hasSession);

      if (!hasSession) {
        setOpen(false);
        setIsSigningOut(false);
        setError(null);
      } else {
        setIsSigningOut(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (isSigningOut) return;

    setError(null);
    setIsSigningOut(true);

    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;

      setOpen(false);
      setIsAuthenticated(false);
      setIsSigningOut(false);
      router.replace("/admin/login");
      router.refresh();
    } catch (caughtError) {
      console.error("No se pudo cerrar la sesion administrativa:", caughtError);
      setError("No se pudo cerrar la sesion. Intentalo nuevamente.");
      setIsSigningOut(false);
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir opciones de perfil"
        title="Perfil"
        onClick={() => setOpen((current) => !current)}
        className="grid size-11 place-items-center rounded-full border border-line text-muted transition-colors hover:border-gold hover:text-gold"
      >
        <ProfileIcon />
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

function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-5"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20c.8-3.25 3.2-5 6.5-5s5.7 1.75 6.5 5" />
    </svg>
  );
}
