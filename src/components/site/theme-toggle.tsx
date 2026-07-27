"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "@/components/site/icons";

const THEME_STORAGE_KEY = "perla-dorada-theme";
const THEME_CHANGE_EVENT = "perla-dorada-theme-change";

type Theme = "dark" | "light";
type ThemeToggleProps = {
  /** Sobre el hero el botón conserva contraste aunque el tema sea claro. */
  variant?: "default" | "on-image";
};

function isTheme(value: string | undefined): value is Theme {
  return value === "dark" || value === "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function getThemeSnapshot(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }

  const theme = document.documentElement.dataset.theme;
  return isTheme(theme) ? theme : "dark";
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}

export function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => "dark",
  );

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const label =
    nextTheme === "light" ? "Activar tema claro" : "Activar tema oscuro";

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(nextTheme);

        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
          /* El tema sigue funcionando aunque el navegador bloquee storage. */
        }

        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }}
      aria-label={label}
      aria-pressed={theme === "light"}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        variant === "on-image"
          ? "border-white/35 bg-black/20 text-white hover:border-gold-soft hover:text-gold-soft"
          : "border-line bg-ink-2/80 text-muted hover:border-gold hover:text-gold"
      }`}
    >
      {theme === "dark" ? (
        <SunIcon className="h-[18px] w-[18px]" aria-hidden />
      ) : (
        <MoonIcon className="h-[18px] w-[18px]" aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
