import { z } from "zod";

/*
 * Lectura segura de variables de entorno del servidor.
 *
 * Recorta espacios y rechaza valores con espacios internos o saltos de
 * línea. El error típico al configurar el hosting es pegar DOS variables
 * en un mismo campo; eso producía un fallo críptico
 * ("Headers.set ... is an invalid header value") y, peor aún, filtraba el
 * secreto completo en los logs porque la excepción incluía el valor.
 *
 * Este mensaje de error NUNCA incluye el valor de la variable.
 *
 * Nota: usa acceso dinámico a process.env, por lo que solo debe llamarse
 * desde código de servidor (Next.js solo inyecta las NEXT_PUBLIC_* en el
 * bundle del navegador cuando se accede de forma estática).
 */
export function readRequiredEnv(name: string): string {
  const raw = process.env[name];

  if (raw === undefined || raw.trim().length === 0) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  const value = raw.trim();

  if (/\s/.test(value)) {
    throw new Error(
      `La variable de entorno ${name} contiene espacios o saltos de línea. ` +
        "Suele ocurrir al pegar dos variables en el mismo campo del panel de hosting.",
    );
  }

  return value;
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
