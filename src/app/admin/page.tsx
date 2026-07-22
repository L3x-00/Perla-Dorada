import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentProofButton } from "@/app/admin/payment-proof-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { PurchaseRequestActions } from "@/app/admin/purchase-request-actions";

type PurchaseRequestStatus =
  Database["public"]["Enums"]["purchase_request_status"];

type AdminPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

const allowedStatuses: PurchaseRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired",
];

const statusLabels: Record<PurchaseRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
};

function isPurchaseRequestStatus(
  value: string | undefined,
): value is PurchaseRequestStatus {
  return allowedStatuses.includes(
    value as PurchaseRequestStatus,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getExpirationLabel(
  status: PurchaseRequestStatus,
  expiresAt: string,
) {
  if (status !== "pending") {
    return "—";
  }

  const remainingMilliseconds =
    new Date(expiresAt).getTime() - Date.now();

  if (remainingMilliseconds <= 0) {
    return "Vencida";
  }

  const remainingMinutes = Math.ceil(
    remainingMilliseconds / 60_000,
  );

  return `${remainingMinutes} min`;
}

export default async function AdminPage({
  searchParams,
}: AdminPageProps) {
  const sessionClient = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await sessionClient.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = await searchParams;

  const selectedStatus = isPurchaseRequestStatus(
    resolvedSearchParams.status,
  )
    ? resolvedSearchParams.status
    : undefined;

  const adminClient = createAdminClient();

  let query = adminClient
    .from("purchase_requests")
    .select(
      `
        id,
        full_name,
        dni,
        phone,
        whatsapp,
        requested_quantity,
        status,
        tracking_code,
        created_at,
        expires_at,
        rejection_reason,
        payment_proof_deleted_at
      `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (selectedStatus) {
    query = query.eq("status", selectedStatus);
  }

  const {
    data: purchaseRequests,
    error: purchaseRequestsError,
  } = await query;

  if (purchaseRequestsError) {
    console.error(
      "Error cargando solicitudes:",
      purchaseRequestsError,
    );
  }

  const requests = purchaseRequests ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-sm font-medium text-amber-400">
            Joyería Perla Dorada
          </p>

          <h1 className="mt-1 text-3xl font-semibold">
            Solicitudes de compra
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            Mostrando hasta las 100 solicitudes más recientes.
          </p>
        </header>

        <nav className="mt-8 flex flex-wrap gap-2">
          <FilterLink
            href="/admin"
            label="Todas"
            active={!selectedStatus}
          />

          {allowedStatuses.map((status) => (
            <FilterLink
              key={status}
              href={`/admin?status=${status}`}
              label={statusLabels[status]}
              active={selectedStatus === status}
            />
          ))}
        </nav>

        {purchaseRequestsError ? (
          <div className="mt-8 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            No se pudieron cargar las solicitudes.
          </div>
        ) : null}

        {!purchaseRequestsError && requests.length === 0 ? (
          <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-400">
            No hay solicitudes para este filtro.
          </div>
        ) : null}

        {requests.length > 0 ? (
          <div className="mt-8 overflow-x-auto rounded-xl border border-neutral-800">
            <table className="min-w-full divide-y divide-neutral-800 text-sm">
              <thead className="bg-neutral-900 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Expira</th>
                  <th className="px-4 py-3">Creada</th>
                  <th className="px-4 py-3">Comprobante</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-800 bg-neutral-950">
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="align-top hover:bg-neutral-900/60"
                  >
                    <td className="px-4 py-4">
                      <p className="font-medium">
                        {request.full_name}
                      </p>

                      <p className="mt-1 text-xs text-neutral-400">
                        DNI: {request.dni}
                      </p>

                      <p className="mt-1 font-mono text-xs text-neutral-500">
                        {request.tracking_code}
                      </p>
                      
                    </td>

                    <td className="px-4 py-4">
                      <p>{request.phone}</p>
                      <p className="mt-1 text-xs text-neutral-400">
                        WhatsApp: {request.whatsapp}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {request.requested_quantity}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={request.status} />

                      {request.rejection_reason ? (
                        <p className="mt-2 max-w-56 text-xs text-red-300">
                          {request.rejection_reason}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-neutral-300">
                      {getExpirationLabel(
                        request.status,
                        request.expires_at,
                      )}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 text-neutral-300">
                      {formatDate(request.created_at)}
                    </td>

                    <td className="px-4 py-4">
                      <PaymentProofButton
                        purchaseRequestId={request.id}
                        disabled={Boolean(
                          request.payment_proof_deleted_at,
                        )}
                      />

                      {request.payment_proof_deleted_at ? (
                        <p className="mt-2 text-xs text-neutral-500">
                          Eliminado
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <PurchaseRequestActions
                        purchaseRequestId={request.id}
                        status={request.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </main>
  );
}

type FilterLinkProps = {
  href: string;
  label: string;
  active: boolean;
};

function FilterLink({
  href,
  label,
  active,
}: FilterLinkProps) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-white px-3 py-2 text-sm font-medium text-black"
          : "rounded-lg border border-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
      }
    >
      {label}
    </Link>
  );
}

function StatusBadge({
  status,
}: {
  status: PurchaseRequestStatus;
}) {
  const classes: Record<PurchaseRequestStatus, string> = {
    pending:
      "border-amber-800 bg-amber-950/50 text-amber-300",
    approved:
      "border-emerald-800 bg-emerald-950/50 text-emerald-300",
    rejected:
      "border-red-800 bg-red-950/50 text-red-300",
    expired:
      "border-neutral-700 bg-neutral-900 text-neutral-400",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${classes[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}