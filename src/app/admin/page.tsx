import Link from "next/link";
import { DeleteProofButton } from "@/app/admin/delete-proof-button";
import { PaymentProofButton } from "@/app/admin/payment-proof-button";
import { PurchaseRequestActions } from "@/app/admin/purchase-request-actions";
import { DOCUMENT_LABELS, isDocumentType } from "@/lib/validation/document";
import {
  AdminAlert,
  AdminPage,
  AdminPageHeader,
  Badge,
  EmptyState,
  type BadgeTone,
} from "@/components/admin/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import type { Database } from "@/types/database";

type PurchaseRequestStatus =
  Database["public"]["Enums"]["purchase_request_status"];

type AdminPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
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

const ADMIN_QUERY_PAGE_SIZE = 1_000;
const REQUESTS_PAGE_SIZE = 30;

function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type DashboardTicket = {
  id: string;
  raffle_id: string;
  purchase_request_id: string;
  ticket_status: Database["public"]["Enums"]["ticket_lifecycle_status"];
};

/*
 * Trae activos Y anulados (no congelados/reasignados: no ocurren en una
 * rifa activa). Se necesitan ambos para saber si una solicitud aprobada ya
 * está "completa" (activos + anulados == requested_quantity) o si todavía
 * está en preparación.
 */
async function loadApprovedDashboardTickets(
  adminClient: ReturnType<typeof createAdminClient>,
  purchaseRequestIds: string[],
): Promise<DashboardTicket[]> {
  const tickets: DashboardTicket[] = [];
  let rangeStart = 0;

  while (true) {
    const { data, error } = await adminClient
      .from("tickets")
      .select("id, raffle_id, purchase_request_id, ticket_status")
      .in("purchase_request_id", purchaseRequestIds)
      .in("ticket_status", ["active", "voided"])
      .order("id", { ascending: true })
      .range(rangeStart, rangeStart + ADMIN_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];
    tickets.push(...pageRows);

    if (pageRows.length < ADMIN_QUERY_PAGE_SIZE) {
      return tickets;
    }

    rangeStart += ADMIN_QUERY_PAGE_SIZE;
  }
}

async function loadDashboardPrintCounts(
  adminClient: ReturnType<typeof createAdminClient>,
  purchaseRequestIds: string[],
): Promise<Map<string, number>> {
  const printCountByTicketId = new Map<string, number>();
  let rangeStart = 0;

  while (true) {
    const { data, error } = await adminClient
      .from("ticket_prints")
      .select("ticket_id,tickets!inner(purchase_request_id)")
      .in("tickets.purchase_request_id", purchaseRequestIds)
      .order("printed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(rangeStart, rangeStart + ADMIN_QUERY_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const pageRows = data ?? [];

    for (const print of pageRows) {
      printCountByTicketId.set(
        print.ticket_id,
        (printCountByTicketId.get(print.ticket_id) ?? 0) + 1,
      );
    }

    if (pageRows.length < ADMIN_QUERY_PAGE_SIZE) {
      return printCountByTicketId;
    }

    rangeStart += ADMIN_QUERY_PAGE_SIZE;
  }
}

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
  await requireActiveAdminPage();

  const resolvedSearchParams = await searchParams;

  const selectedStatus = isPurchaseRequestStatus(resolvedSearchParams.status)
    ? resolvedSearchParams.status
    : undefined;

  const requestedPage = parsePageParam(resolvedSearchParams.page);

  const adminClient = createAdminClient();

  let countQuery = adminClient
    .from("purchase_requests")
    .select("id", { count: "exact", head: true });

  if (selectedStatus) {
    countQuery = countQuery.eq("status", selectedStatus);
  }

  const { count: totalCount, error: countError } = await countQuery;

  if (countError) {
    console.error("Error contando solicitudes:", countError);
  }

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount ?? 0) / REQUESTS_PAGE_SIZE),
  );
  const currentPage = Math.min(requestedPage, totalPages);
  const rangeStart = (currentPage - 1) * REQUESTS_PAGE_SIZE;
  const rangeEnd = rangeStart + REQUESTS_PAGE_SIZE - 1;

  let query = adminClient
    .from("purchase_requests")
    .select(
      `
        id,
        full_name,
        document_type,
        dni,
        phone,
        whatsapp,
        requested_quantity,
        status,
        tracking_code,
        created_at,
        expires_at,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        payment_proof_deleted_at
      `,
    )
    /*
     * Orden por recencia de aprobación: lo recién aprobado aparece primero,
     * aunque el cliente se haya registrado hace días (útil para imprimir para
     * las ánforas). Las solicitudes aún sin revisar (reviewed_at nulo:
     * pendientes) quedan arriba por su fecha de registro, para no perder de
     * vista lo que entra y necesita acción.
     */
    .order("reviewed_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (selectedStatus) {
    query = query.eq("status", selectedStatus);
  }

  const { data: purchaseRequests, error: purchaseRequestsError } = await query;

  if (purchaseRequestsError) {
    console.error("Error cargando solicitudes:", purchaseRequestsError);
  }

  const requests = purchaseRequests ?? [];
  const reviewerIds = Array.from(
    new Set(
      requests.flatMap((request) =>
        request.reviewed_by ? [request.reviewed_by] : [],
      ),
    ),
  );
  const reviewerNameById = new Map<string, string>();

  if (reviewerIds.length > 0) {
    const { data: reviewers, error: reviewersError } = await adminClient
      .from("admin_profiles")
      .select("user_id, display_name")
      .in("user_id", reviewerIds);

    if (reviewersError) {
      console.error("Error cargando administradores revisores:", reviewersError);
    } else {
      for (const reviewer of reviewers ?? []) {
        reviewerNameById.set(reviewer.user_id, reviewer.display_name);
      }
    }
  }

  const approvedRequestIds = requests
    .filter((request) => request.status === "approved")
    .map((request) => request.id);
  const approvedTicketsByRequestId = new Map<
    string,
    Array<{ id: string; raffleId: string; previousPrints: number }>
  >();
  const voidedCountByRequestId = new Map<string, number>();
  if (approvedRequestIds.length > 0) {
    try {
      const [tickets, printCountByTicketId] = await Promise.all([
        loadApprovedDashboardTickets(adminClient, approvedRequestIds),
        loadDashboardPrintCounts(adminClient, approvedRequestIds),
      ]);

      for (const ticket of tickets) {
        if (ticket.ticket_status === "voided") {
          voidedCountByRequestId.set(
            ticket.purchase_request_id,
            (voidedCountByRequestId.get(ticket.purchase_request_id) ?? 0) + 1,
          );
          continue;
        }

        const current = approvedTicketsByRequestId.get(
          ticket.purchase_request_id,
        ) ?? [];
        current.push({
          id: ticket.id,
          raffleId: ticket.raffle_id,
          previousPrints: printCountByTicketId.get(ticket.id) ?? 0,
        });
        approvedTicketsByRequestId.set(ticket.purchase_request_id, current);
      }
    } catch (printPreparationError) {
      console.error("No se pudieron preparar las impresiones del panel:", {
        error: printPreparationError,
      });
    }
  }

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Solicitudes de compra"
        description={
          (totalCount ?? 0) > 0
            ? `Página ${currentPage} de ${totalPages} · ${totalCount} solicitudes en total.`
            : "No hay solicitudes que coincidan con este filtro."
        }
      />

      <form
        action="/admin/search"
        className="mt-8 flex max-w-2xl flex-col gap-3 rounded-xl border border-line bg-ink-2 p-3 sm:flex-row"
      >
        <label htmlFor="dashboard-search" className="sr-only">
          Buscar por DNI, CUI o código de ticket
        </label>
        <input
          id="dashboard-search"
          name="q"
          minLength={2}
          maxLength={50}
          required
          placeholder="DNI, CUI o ticket PD-0001"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-4 py-3 text-sm text-cream outline-none transition-colors placeholder:text-muted/50 focus:border-gold [&:user-valid]:border-emerald-500 [&:user-valid]:bg-emerald-950/15"
        />
        <button
          type="submit"
          className="rounded-lg bg-gold px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-gold-soft"
        >
          Buscar
        </button>
      </form>

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

      {/* Móvil: tarjetas. Una tabla de 8 columnas no cabe en un teléfono. */}
      {requests.length > 0 ? (
        <div className="mt-8 space-y-3 lg:hidden">
          {requests.map((request, index) => (
            <RequestCard
              key={request.id}
              request={request}
              index={index}
              reviewerName={
                request.reviewed_by
                  ? reviewerNameById.get(request.reviewed_by) ?? "Administrador"
                  : null
              }
              approvedTickets={
                approvedTicketsByRequestId.get(request.id) ?? []
              }
              voidedTicketCount={voidedCountByRequestId.get(request.id) ?? 0}
            />
          ))}
        </div>
      ) : null}

      {/* Escritorio: tabla completa. */}
      {requests.length > 0 ? (
        <div className="mt-8 hidden overflow-x-auto rounded-xl border border-line lg:block">
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
                      {isDocumentType(request.document_type)
                        ? DOCUMENT_LABELS[request.document_type]
                        : "DNI"}
                      : {request.dni}
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

                    <ReviewMetadata
                      status={request.status}
                      reviewedAt={request.reviewed_at}
                      reviewerName={
                        request.reviewed_by
                          ? reviewerNameById.get(request.reviewed_by) ??
                            "Administrador"
                          : null
                      }
                    />
                  </td>

                  <td className="px-4 py-4 text-muted">
                    {getExpirationLabel(request.status, request.expires_at)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-muted">
                    {formatDate(request.created_at)}
                  </td>

                  <td className="px-4 py-4">
                    {request.payment_proof_deleted_at ? (
                      <p className="text-xs text-muted">Eliminado</p>
                    ) : (
                      <div className="flex flex-col items-start gap-2">
                        <PaymentProofButton
                          purchaseRequestId={request.id}
                          client={{
                            fullName: request.full_name,
                            documentTypeLabel: isDocumentType(
                              request.document_type,
                            )
                              ? DOCUMENT_LABELS[request.document_type]
                              : "DNI",
                            documentNumber: request.dni,
                            phone: request.phone,
                            whatsapp: request.whatsapp,
                            trackingCode: request.tracking_code,
                            requestedQuantity: request.requested_quantity,
                          }}
                        />

                        <DeleteProofButton purchaseRequestId={request.id} />
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <PurchaseRequestActions
                      purchaseRequestId={request.id}
                      requestedQuantity={request.requested_quantity}
                      status={request.status}
                      approvedTickets={
                        approvedTicketsByRequestId.get(request.id) ?? []
                      }
                      voidedTicketCount={
                        voidedCountByRequestId.get(request.id) ?? 0
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {requests.length > 0 ? (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          status={selectedStatus}
        />
      ) : null}
    </AdminPage>
  );
}

type RequestRow = {
  id: string;
  full_name: string;
  document_type: string;
  dni: string;
  phone: string;
  whatsapp: string;
  requested_quantity: number;
  status: PurchaseRequestStatus;
  tracking_code: string;
  created_at: string;
  expires_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  payment_proof_deleted_at: string | null;
};

function documentLabel(documentType: string): string {
  return isDocumentType(documentType)
    ? DOCUMENT_LABELS[documentType]
    : "DNI";
}

/*
 * Tarjeta de solicitud para móvil. Misma información que una fila de la
 * tabla, pero apilada y con acciones cómodas para el dedo.
 */
function RequestCard({
  request,
  index,
  reviewerName,
  approvedTickets,
  voidedTicketCount,
}: {
  request: RequestRow;
  index: number;
  reviewerName: string | null;
  approvedTickets: Array<{
    id: string;
    raffleId: string;
    previousPrints: number;
  }>;
  voidedTicketCount: number;
}) {
  return (
    <article
      className="rise-in rounded-xl border border-line bg-ink-2 p-4"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-cream">{request.full_name}</p>
          <p className="mt-1 text-xs text-muted">
            {documentLabel(request.document_type)}: {request.dni}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-gold-deep">
            {request.tracking_code}
          </p>
        </div>

        <Badge tone={statusTones[request.status]}>
          {statusLabels[request.status]}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Cell label="Teléfono" value={request.phone} />
        <Cell label="WhatsApp" value={request.whatsapp} />
        <Cell label="Cantidad" value={String(request.requested_quantity)} />
        <Cell
          label="Expira"
          value={getExpirationLabel(request.status, request.expires_at)}
        />
        <div className="col-span-2">
          <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
            Creada
          </dt>
          <dd className="mt-1 text-cream">{formatDate(request.created_at)}</dd>
        </div>
      </dl>

      {request.rejection_reason ? (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/20 p-2.5 text-xs text-red-300">
          {request.rejection_reason}
        </p>
      ) : null}

      <ReviewMetadata
        status={request.status}
        reviewedAt={request.reviewed_at}
        reviewerName={reviewerName}
      />

      <div className="mt-4 border-t border-line pt-4">
        {request.payment_proof_deleted_at ? (
          <p className="text-xs text-muted">Comprobante eliminado</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <PaymentProofButton
              purchaseRequestId={request.id}
              client={{
                fullName: request.full_name,
                documentTypeLabel: documentLabel(request.document_type),
                documentNumber: request.dni,
                phone: request.phone,
                whatsapp: request.whatsapp,
                trackingCode: request.tracking_code,
                requestedQuantity: request.requested_quantity,
              }}
            />
            <DeleteProofButton purchaseRequestId={request.id} />
          </div>
        )}
      </div>

      <PurchaseRequestActions
        purchaseRequestId={request.id}
        requestedQuantity={request.requested_quantity}
        status={request.status}
        approvedTickets={approvedTickets}
        voidedTicketCount={voidedTicketCount}
      />
    </article>
  );
}

function ReviewMetadata({
  status,
  reviewedAt,
  reviewerName,
}: {
  status: PurchaseRequestStatus;
  reviewedAt: string | null;
  reviewerName: string | null;
}) {
  if (
    (status !== "approved" && status !== "rejected") ||
    !reviewedAt ||
    !reviewerName
  ) {
    return null;
  }

  const label = status === "approved" ? "Aprobada" : "Rechazada";

  return (
    <p className="mt-2 text-xs text-muted">
      {label} por: <span className="text-cream">{reviewerName}</span>
      <br />
      {formatDate(reviewedAt)}
    </p>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-cream">{value}</dd>
    </div>
  );
}

function buildRequestsPageHref(
  status: PurchaseRequestStatus | undefined,
  page: number,
): string {
  const params = new URLSearchParams();

  if (status) {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/admin?${query}` : "/admin";
}

function PaginationControls({
  currentPage,
  totalPages,
  status,
}: {
  currentPage: number;
  totalPages: number;
  status: PurchaseRequestStatus | undefined;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Paginación de solicitudes"
      className="mt-6 flex items-center justify-between gap-4 print:hidden"
    >
      {hasPrevious ? (
        <Link
          href={buildRequestsPageHref(status, currentPage - 1)}
          className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
        >
          Anterior
        </Link>
      ) : (
        <span className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted/40">
          Anterior
        </span>
      )}

      <p className="text-xs text-muted">
        Página {currentPage} de {totalPages}
      </p>

      {hasNext ? (
        <Link
          href={buildRequestsPageHref(status, currentPage + 1)}
          className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted transition-colors duration-200 hover:border-gold hover:text-gold"
        >
          Siguiente
        </Link>
      ) : (
        <span className="rounded-lg border border-line px-3.5 py-2 text-sm text-muted/40">
          Siguiente
        </span>
      )}
    </nav>
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
