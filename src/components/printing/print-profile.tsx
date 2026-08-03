"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PrintProfile = "thermal-72" | "adaptive";
export type ThermalFontDensity = "font-a" | "font-b";

type PrintProfileContextValue = {
  profile: PrintProfile;
  setProfile: (profile: PrintProfile) => void;
  thermalFont: ThermalFontDensity;
  setThermalFont: (font: ThermalFontDensity) => void;
};

const PrintProfileContext = createContext<PrintProfileContextValue | null>(
  null,
);

const PRINT_PROFILE_STORAGE_KEY = "pd:print-profile";
const THERMAL_FONT_STORAGE_KEY = "pd:thermal-font";

export function PrintProfileScope({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  /* Térmica conserva el comportamiento que ya usaba el sistema. */
  const [profile, setProfileState] = useState<PrintProfile>("thermal-72");
  const [thermalFont, setThermalFontState] =
    useState<ThermalFontDensity>("font-a");

  useEffect(() => {
    /*
     * Se difiere la lectura para mantener idéntico el primer render del
     * servidor y el navegador. localStorage puede estar bloqueado, por eso
     * una preferencia no debe impedir abrir ni imprimir el documento.
     */
    const loadPreference = window.setTimeout(() => {
      try {
        const storedProfile = window.localStorage.getItem(
          PRINT_PROFILE_STORAGE_KEY,
        );
        const storedFont = window.localStorage.getItem(
          THERMAL_FONT_STORAGE_KEY,
        );

        if (storedProfile === "thermal-72" || storedProfile === "adaptive") {
          setProfileState(storedProfile);
        }

        if (storedFont === "font-a" || storedFont === "font-b") {
          setThermalFontState(storedFont);
        }
      } catch {
        /* La selección predeterminada continúa disponible. */
      }
    }, 0);

    return () => window.clearTimeout(loadPreference);
  }, []);

  const setProfile = useCallback((nextProfile: PrintProfile) => {
    setProfileState(nextProfile);

    try {
      window.localStorage.setItem(PRINT_PROFILE_STORAGE_KEY, nextProfile);
    } catch {
      /* El perfil sigue activo en la ventana actual. */
    }
  }, []);

  const setThermalFont = useCallback((nextFont: ThermalFontDensity) => {
    setThermalFontState(nextFont);

    try {
      window.localStorage.setItem(THERMAL_FONT_STORAGE_KEY, nextFont);
    } catch {
      /* La densidad sigue activa en la ventana actual. */
    }
  }, []);

  const contextValue = useMemo(
    () => ({ profile, setProfile, thermalFont, setThermalFont }),
    [profile, setProfile, thermalFont, setThermalFont],
  );

  return (
    <PrintProfileContext.Provider value={contextValue}>
      <div
        className={className}
        data-print-profile={profile}
        data-thermal-font={thermalFont}
      >
        {children}
      </div>
    </PrintProfileContext.Provider>
  );
}

export function PrintProfileSelector({ className }: { className?: string }) {
  const context = useContext(PrintProfileContext);

  if (!context) {
    throw new Error(
      "PrintProfileSelector debe usarse dentro de PrintProfileScope.",
    );
  }

  const { profile, setProfile, thermalFont, setThermalFont } = context;
  const isThermal = profile === "thermal-72";

  return (
    <fieldset
      className={`rounded-xl border border-line bg-ink-2 p-4 text-cream print:hidden ${
        className ?? ""
      }`}
    >
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
        Formato de impresión
      </legend>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted">
          Tipo de impresora
          <select
            value={profile}
            onChange={(event) =>
              setProfile(event.target.value as PrintProfile)
            }
            className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-cream outline-none focus:border-gold"
          >
            <option value="thermal-72">Térmica · hasta 72 mm</option>
            <option value="adaptive">General · adaptable</option>
          </select>
        </label>

        {isThermal ? (
          <label className="space-y-1 text-xs font-medium text-muted">
            Densidad de texto
            <select
              value={thermalFont}
              onChange={(event) =>
                setThermalFont(event.target.value as ThermalFontDensity)
              }
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-cream outline-none focus:border-gold"
            >
              <option value="font-a">A · mayor legibilidad</option>
              <option value="font-b">B · más compacta</option>
            </select>
          </label>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted" aria-live="polite">
        {isThermal
          ? "Compatible con cabezales de 576 o 512 puntos. Usa escala 100 %, sin márgenes ni encabezados; el driver controla los puntos y la fuente física."
          : "Se adapta al papel configurado por el navegador, como A4, Carta, impresoras de tinta o láser."}
      </p>
    </fieldset>
  );
}
