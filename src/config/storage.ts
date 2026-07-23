export const PAYMENT_PROOFS_BUCKET = "payment-proofs";

/** Bucket PÚBLICO: aquí viven las fotos del premio que se muestran en la web. */
export const RAFFLE_IMAGES_BUCKET = "raffle-images";

export const PAYMENT_PROOF_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const PAYMENT_PROOF_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PaymentProofMimeType =
  (typeof PAYMENT_PROOF_ALLOWED_MIME_TYPES)[number];