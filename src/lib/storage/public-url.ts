import { RAFFLE_IMAGES_BUCKET } from "@/config/storage";

/*
 * URL pública de la foto del premio.
 *
 * Sin "server-only" a propósito: también se usa desde componentes de
 * cliente. Por eso lee NEXT_PUBLIC_SUPABASE_URL de forma estática, que es
 * como Next.js la incrusta en el bundle del navegador.
 */
export function raffleImageUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!base) {
    return null;
  }

  return `${base}/storage/v1/object/public/${RAFFLE_IMAGES_BUCKET}/${path}`;
}
