import { NextResponse } from "next/server";
import { z } from "zod";

import { PAYMENT_PROOFS_BUCKET } from "@/config/storage";
import { checkPurchaseRequestRateLimit } from
  "@/lib/security/purchase-request-rate-limit";
import {
  createPaymentProofPath,
  validatePaymentProof,
} from "@/lib/storage/payment-proofs";
import { createAdminClient } from "@/lib/supabase/admin";
import { purchaseRequestSchema } from
  "@/lib/validation/purchase-request";

export const runtime = "nodejs";

const MAX_MULTIPART_BODY_BYTES = 6 * 1024 * 1024;

type PublicDatabaseError = {
  message: string;
  status: number;
};

function errorResponse(
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function getPublicDatabaseError(
  code: string | undefined,
): PublicDatabaseError {
  switch (code) {
    case "23505":
      /*
       * Ya no existe el límite de una solicitud pendiente por documento.
       * Este código solo aparece al superar el tope antiabuso de
       * create_purchase_request.
       */
      return {
        message:
          "Tienes demasiadas solicitudes pendientes de revisión. Espera a que aprobemos las anteriores.",
        status: 409,
      };

    case "22023":
      return {
        message:
          "Los datos enviados no son válidos.",
        status: 400,
      };

    case "P0002":
      return {
        message:
          "Actualmente no existe una rifa activa.",
        status: 404,
      };

    case "P0001":
      return {
        message:
          "No hay suficientes boletos disponibles.",
        status: 409,
      };

    default:
      return {
        message:
          "No se pudo registrar la solicitud.",
        status: 422,
      };
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const contentType = request.headers.get("content-type");

  if (!contentType?.includes("multipart/form-data")) {
    return errorResponse(
      "El contenido debe enviarse como multipart/form-data.",
      415,
    );
  }

  const contentLengthHeader =
    request.headers.get("content-length");

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_MULTIPART_BODY_BYTES
    ) {
      return errorResponse(
        "El contenido enviado supera el límite permitido.",
        413,
      );
    }
  }

  try {
    const rateLimit =
      await checkPurchaseRequestRateLimit(request);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Has realizado demasiados intentos. Inténtalo nuevamente más tarde.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.retryAfterSeconds,
            ),
            "Cache-Control": "no-store",
          },
        },
      );
    }
  } catch (error) {
    console.error(
      "Error ejecutando protección antiabuso:",
      error,
    );

    return errorResponse(
      "El servicio no está disponible temporalmente.",
      503,
    );
  }

  try {
    const supabase = createAdminClient();

    /*
     * Enforcement de mantenimiento.
     *
     * Si el modo mantenimiento está activo, el portal deja de aceptar
     * solicitudes incluso ante envíos directos al endpoint (la landing
     * pública solo lo oculta visualmente).
     */
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("maintenance_mode")
      .eq("id", true)
      .maybeSingle();

    if (settingsError) {
      console.error(
        "Error consultando configuración:",
        settingsError,
      );

      return errorResponse(
        "El servicio no está disponible temporalmente.",
        503,
      );
    }

    if (settings?.maintenance_mode) {
      return errorResponse(
        "El portal está en mantenimiento. Vuelve a intentarlo más tarde.",
        503,
      );
    }

    const formData = await request.formData();

    const parsedInput = purchaseRequestSchema.parse({
      fullName: formData.get("fullName"),
      documentType: formData.get("documentType"),
      dni: formData.get("dni"),
      phone: formData.get("phone"),
      whatsapp: formData.get("whatsapp"),
      requestedQuantity: formData.get(
        "requestedQuantity",
      ),
    });

    const paymentProof = formData.get("paymentProof");

    if (!(paymentProof instanceof File)) {
      return errorResponse(
        "El comprobante de pago es obligatorio.",
        400,
      );
    }

    const validatedFile =
      await validatePaymentProof(paymentProof);

    /*
     * Esta consulta solo se utiliza para construir una ruta
     * organizada en Storage.
     *
     * La validación transaccional definitiva de la rifa activa
     * se realiza dentro de create_purchase_request().
     */
    const { data: raffle, error: raffleError } =
      await supabase
        .from("raffles")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

    if (raffleError) {
      console.error(
        "Error consultando rifa activa:",
        raffleError,
      );

      return errorResponse(
        "No se pudo consultar la rifa activa.",
        500,
      );
    }

    if (!raffle) {
      return errorResponse(
        "Actualmente no existe una rifa activa.",
        404,
      );
    }

    const requestId = crypto.randomUUID();

    const paymentProofPath = createPaymentProofPath(
      raffle.id,
      requestId,
      validatedFile.extension,
    );

    const { error: uploadError } =
      await supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .upload(
          paymentProofPath,
          validatedFile.buffer,
          {
            contentType: validatedFile.mimeType,
            cacheControl: "3600",
            upsert: false,
          },
        );

    if (uploadError) {
      console.error(
        "Error subiendo comprobante:",
        uploadError,
      );

      return errorResponse(
        "No se pudo subir el comprobante de pago.",
        500,
      );
    }

    const { data: createdRequest, error: createError } =
      await supabase
        .rpc("create_purchase_request", {
          p_request_id: requestId,
          p_full_name: parsedInput.fullName,
          p_document_type: parsedInput.documentType,
          p_dni: parsedInput.dni,
          p_phone: parsedInput.phone,
          p_whatsapp: parsedInput.whatsapp,
          p_requested_quantity:
            parsedInput.requestedQuantity,
          p_payment_proof_path: paymentProofPath,
        })
        .single();

    if (createError) {
      /*
       * Compensación:
       * si PostgreSQL rechaza la solicitud después de subir el
       * comprobante, eliminamos el objeto de Storage.
       */
      const { error: cleanupError } =
        await supabase.storage
          .from(PAYMENT_PROOFS_BUCKET)
          .remove([paymentProofPath]);

      if (cleanupError) {
        console.error(
          "No se pudo eliminar el archivo huérfano:",
          cleanupError,
        );
      }

      console.error(
        "Error creando solicitud:",
        createError,
      );

      const publicError =
        getPublicDatabaseError(createError.code);

      return errorResponse(
        publicError.message,
        publicError.status,
      );
    }

    if (!createdRequest) {
      console.error(
        "create_purchase_request no devolvió datos.",
      );

      const { error: cleanupError } =
        await supabase.storage
          .from(PAYMENT_PROOFS_BUCKET)
          .remove([paymentProofPath]);

      if (cleanupError) {
        console.error(
          "No se pudo eliminar el archivo huérfano:",
          cleanupError,
        );
      }

      return errorResponse(
        "No se pudo completar la solicitud.",
        500,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          requestId: createdRequest.request_id,
          trackingCode:
            createdRequest.tracking_code,
          expiresAt: createdRequest.expires_at,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Los datos enviados no son válidos.",
          fields: error.flatten().fieldErrors,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (error instanceof Error) {
      console.error(
        "Error procesando solicitud:",
        error,
      );

      /*
       * Solo se muestran mensajes controlados provenientes
       * de la validación local del archivo.
       */
      if (
        error.message ===
          "El comprobante está vacío." ||
        error.message ===
          "El comprobante no puede superar los 5 MB." ||
        error.message ===
          "El archivo no es una imagen JPG, PNG o WEBP válida."
      ) {
        return errorResponse(error.message, 400);
      }

      return errorResponse(
        "No se pudo procesar la solicitud.",
        500,
      );
    }

    console.error(
      "Error inesperado creando solicitud:",
      error,
    );

    return errorResponse(
      "Ocurrió un error inesperado.",
      500,
    );
  }
}