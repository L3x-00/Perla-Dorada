import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentProofButton } from "@/app/admin/payment-proof-button";
import { PurchaseRequestActions } from "@/app/admin/purchase-request-actions";
import {
  AdminAlert,
  AdminPage,
  AdminPageHeader,
  Badge,
  EmptyState,
  type BadgeTone,
} from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PurchaseRequestStatus =
  Database["public"]["Enums"]["purchase_request_status"];

type AdminPageProps = {
  searchParams: Promise<{ status?: string }>;
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

const statusTones: Record<PurchaseRequestStatus, BadgeTone> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  expired: "expired",
};

function isPurchaseRequestStatus(
  value: string | undefined,
): value is PurchaseRequestStatus {
  return allowedStatuses.includes(value as PurchaseRequestStatus);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
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

  const remainingMilliseconds = new Date(expiresAt).getTime() - Date.now();

  if (remainingMilliseconds <= 0) {
    return "Vencida";
  }

  return `${Math.ceil(remainingMilliseconds / 60_000)} min`;
}

export default async function AdminHomePage({ searchParams }: AdminPageProps) {
  const sessionClient = await createClient();

  const { data: claimsData, error: claimsError } =
    await sessionClient.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    redirect("/admin/login");
  }

  const resolvedSearchParams = await searchParams;

  const selectedStatus = isPurchaseRequestStatus(resolvedSearchParams.status)
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

  const { data: purchaseRequests, error: purchaseRequestsError } = await query;

  if (purchaseRequestsError) {
    console.error("Error cargando solicitudes:", purchaseRequestsError);
  }

  const requests = purchaseRequests ?? [];

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Solicitudes de compra"
        description="Se muestran las 100 solicitudes más recientes."
      />

      <nav className="mt-8 flex flex-wrap gap-2">
        <FilterLink href="/admin" label="Todas" active={!selectedStatus} />

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
        <div className="mt-8">
          <AdminAlert>No se pudieron cargar las solicitudes.</AdminAlert>
        </div>
      ) : null}

      {!purchaseRequestsError && requests.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Sin solicitudes"
            description="No hay solicitudes que coincidan con este filtro."
          />
        </div>
      ) : null}

      {requests.length > 0 ? (
        <div className="mt-8 overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-ink-3 text-left">
              <tr className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                <th className="px-4 py-3.5 font-medium">Cliente</th>
                <th className="px-4 py-3.5 font-medium">Contacto</th>
                <th className="px-4 py-3.5 font-medium">Cant.</th>
                <th className="px-4 py-3.5 font-medium">Estado</th>
                <th className="px-4 py-3.5 font-medium">Expira</th>
                <th className="px-4 py-3.5 font-medium">Creada</th>
                <th className="px-4 py-3.5 font-medium">Comprobante</th>
                <th className="px-4 py-3.5 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line bg-ink-2">
              {requests.map((request) => (
                <tr key={request.id} className="align-top hover:bg-ink-3/60">
                  <td className="px-4 py-4">
                    <p className="font-medium text-cream">
                      {request.full_name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      DNI: {request.dni}
                    </p>
                    <p className="mt-1 font-mono text-xs text-gold-deep">
                      {request.tracking_code}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-muted">
                    <p className="text-cream">{request.phone}</p>
                    <p className="mt-1 text-xs">
                      WhatsApp: {request.whatsapp}
                    </p>
                  </td>

                  <td className="px-4 py-4 tabular-nums text-cream">
                    {request.requested_quantity}
                  </td>

                  <td className="px-4 py-4">
                    <Badge tone={statusTones[request.status]}>
                      {statusLabels[request.status]}
                    </Badge>

                    {request.rejection_reason ? (
                      <p className="mt-2 max-w-56 text-xs text-red-300">
                        {request.rejection_reason}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-4 text-muted">
                    {getExpirationLabel(request.status, request.expires_at)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-muted">
                    {formatDate(request.created_at)}
                  </td>

                  <td className="px-4 py-4">
                    <PaymentProofButton
                      purchaseRequestId={request.id}
                      disabled={Boolean(request.payment_proof_deleted_at)}
                    />

                    {request.payment_proof_deleted_at ? (
                      <p className="mt-2 text-xs text-muted">Eliminado</p>
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
    </AdminPage>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3.5 py-2 text-sm transition-colors duration-200 ${
        active
          ? "bg-gold text-ink"
          : "border border-line text-muted hover:border-gold hover:text-gold"
      }`}
    >
      {label}
    </Link>
  );
}
