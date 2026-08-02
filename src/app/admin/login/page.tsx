"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import {
  AdminAlert,
  adminInput,
  adminLabel,
  btnPrimary,
} from "@/components/admin/ui";
import { BrandLogo } from "@/components/site/brand-logo";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage("Correo o contraseña incorrectos.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[110px]"
        style={{
          background:
            "radial-gradient(circle, var(--color-gold) 0%, transparent 65%)",
        }}
      />

      <section className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <BrandLogo className="h-auto w-44 sm:w-52" />
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-ink-2 p-7">
          <p className="eyebrow text-gold">Acceso restringido</p>

          <h1 className="mt-3 font-display text-3xl font-light text-cream">
            Administración
          </h1>

          <p className="mt-2 text-sm text-muted">
            Ingresa con tu cuenta administrativa.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className={adminLabel}>
                Correo electrónico
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => {
                  if (email.trim().length > 0 && email.includes("@")) {
                    window.requestAnimationFrame(() => passwordRef.current?.focus());
                  }
                }}
                className={adminInput}
              />
            </div>

            <div>
              <label htmlFor="password" className={adminLabel}>
                Contraseña
              </label>

              <input
                id="password"
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={adminInput}
              />
            </div>

            {errorMessage ? (
              <AdminAlert>{errorMessage}</AdminAlert>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${btnPrimary} w-full py-3`}
            >
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-sm text-muted">
          <Link
            href="/"
            className="transition-colors hover:text-gold"
          >
            ← Volver al sitio
          </Link>
        </p>
      </section>
    </main>
  );
}
