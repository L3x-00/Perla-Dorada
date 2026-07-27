export const PAYMENT_PROOFS_BUCKET = "payment-proofs";

/** Bucket PÚBLICO: aquí viven las fotos del premio que se muestran en la web. */
export const RAFFLE_IMAGES_BUCKET = "raffle-images";

export const PAYMENT_PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024;

/*
 * Límites del objeto que finalmente se guarda en Storage.
 *
 * Los 5 MB anteriores protegen la entrada antes de decodificarla; no son un
 * objetivo de almacenamiento. El navegador recomprime antes de enviar y el
 * servidor vuelve a imponer estos topes para que un cliente manipulado no
 * pueda llenar el bucket con originales pesados.
 */
export const PAYMENT_PROOF_STORAGE_MAX_SIZE_BYTES = 600 * 1024;
export const RAFFLE_IMAGE_STORAGE_MAX_SIZE_BYTES = 350 * 1024;

export const PAYMENT_PROOF_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PaymentProofMimeType =
  (typeof PAYMENT_PROOF_ALLOWED_MIME_TYPES)[number];
