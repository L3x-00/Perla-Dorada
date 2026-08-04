import Link from "next/link";
import { redirect } from "next/navigation";

import { PurchaseRequestPrintAction } from "@/app/admin/purchase-request-print-action";
import { TicketPrintAction } from "@/app/admin/ticket-print-action";
import { TicketReassignAction } from "@/app/admin/ticket-reassign-action";
import {
  AdminAlert,
  AdminPage,
  AdminPageHeader,
  Badge,
  EmptyState,
  adminCard,
  adminInput,
  adminLabel,
  btnGhost,
  btnPrimary,
  type BadgeTone,
} from "@/components/admin/ui";
import { requireActiveAdminPage } from "@/lib/auth/admin-page";
import { formatDateTime } from "@/lib/format";
import { formatTicketCode, parseTicketCode } from "@/lib/tickets/code";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type RaffleStatus = Database["public"]["Enums"]["raffle_status"];
type PurchaseRequestStatus =
  Database["public"]["Enums"]["purchase_request_status"];
type TicketLifecycleStatus =
  Database["public"]["Enums"]["ticket_lifecycle_status"];
type SearchParamValue = string | string[] | undefined;

type AdminTicketsPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

type TicketGroupPeriod = "all" | "current" | "past";
type TicketStatusFilter = "all" | TicketLifecycleStatus;

type TicketGroupFunction =
  Database["public"]["Functions"]["admin_list_ticket_groups"];
type TicketGroupRow = TicketGroupFunction["Returns"][number];

type TicketDetail = {
  id: string;
  raffle_id: string;
  purchase_request_id: string;
  ticket_number: number;
  ticket_status: TicketLifecycleStatus;
  origin_ticket_id: string | null;
  assigned_at: string;
};

type RaffleOption = {
  id: string;
  name: string;
  status: RaffleStatus;
};

type PurchaseRequestQuantity = {
  id: string;
  requested_quantity: number;
};

type TicketGroupFilters = {
  q: string;
  raffleId: string | null;
  period: TicketGroupPeriod;
  status: TicketStatusFilter;
  from: string | null;
  to: string | null;
};

const PAGE_SIZE = 20;
const MAX_PAGE = 10_000;
const PRINT_QUERY_CHUNK_SIZE = 75;
const PRINT_QUERY_PAGE_SIZE = 1_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TICKET_CODE_QUERY_PATTERN = /^PD-\d+$/i;
const NUMERIC_TICKET_NUMBER_PATTERN = /^\d+$/;

const PERIOD_OPTIONS: Array<{ value: TicketGroupPeriod; label: string }> = [
  { value: "all", label: "Todos los sorteos" },
  { value: "current", label: "Sorteo actual" },
  { value: "past", label: "Sorteos pasados" },
];

const STATUS_OPTIONS: Array<{ value: TicketStatusFilter; label: string }> = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Vigentes" },
  { value: "frozen", label: "Congelados" },
  { value: "reassigned", label: "Reasignados" },
];

const RAFFLE_STATUS_LABELS: Record<RaffleStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

const RAFFLE_STATUS_TONES: Record<RaffleStatus, BadgeTone> = {
  draft: "neutral",
  active: "approved",
  closed: "gold",
  cancelled: "rejected",
};

const REQUEST_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  expired: "Expirada",
};

const REQUEST_STATUS_TONES: Record<PurchaseRequestStatus, BadgeTone> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  expired: "expired",
};

const TICKET_STATUS_LABELS: Record<TicketLifecycleStatus, string> = {
  active: "Vigente",
  frozen: "Congelado",
  reassigned: "Reasignado",
  voided: "Anulado",
};

const TICKET_STATUS_TONES: Record<TicketLifecycleStatus, BadgeTone> = {
  active: "approved",
  frozen: "gold",
  reassigned: "neutral",
  voided: "rejected",
};

function firstSearchParam(value: SearchParamValue): string {
  return typeof value === "string" ? value : "";
}

function normalizeSearch(value: SearchParamValue): string {
  const normalized = firstSearchParam(value)
    .trim()
    .replace(/[%_\\]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 50);

  return normalized.length >= 2 ? normalized : "";
}

function parseRaffleId(value: SearchParamValue): string | null {
  const candidate = firstSearchParam(value);
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

function parsePeriod(value: SearchParamValue): TicketGroupPeriod {
  const candidate = firstSearchParam(value);
  return PERIOD_OPTIONS.some((option) => option.value === candidate)
    ? (candidate as TicketGroupPeriod)
    : "all";
}

function parseStatus(value: SearchParamValue): TicketStatusFilter {
  const candidate = firstSearchParam(value);
  return STATUS_OPTIONS.some((option) => option.value === candidate)
    ? (candidate as TicketStatusFilter)
    : "all";
}

function parseIsoDate(value: SearchParamValue): string | null {
  const candidate = firstSearchParam(value);

  if (!ISO_DATE_PATTERN.test(candidate)) {
    return null;
  }

  const [year, month, day] = candidate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return candidate;
}

function parsePage(value: SearchParamValue): number {
  const parsed = Number(firstSearchParam(value));

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, MAX_PAGE);
}

function groupKey(purchaseRequestId: string, raffleId: string): string {
  return `${purchaseRequestId}:${raffleId}`;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function toSafeCount(value: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getTicketNumberSearch(query: string): number | null {
  if (
    !TICKET_CODE_QUERY_PATTERN.test(query) &&
    !NUMERIC_TICKET_NUMBER_PATTERN.test(query)
  ) {
    return null;
  }

  const parsed = parseTicketCode(query);
  return parsed !== null && parsed <= 1_000_000 ? parsed : null;
}

function buildPageHref(filters: TicketGroupFilters, page: number): string {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.raffleId) params.set("raffle", filters.raffleId);
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `/admin/tickets?${query}` : "/admin/tickets";
}

export default async function AdminTicketsPage({
  searchParams,
}: AdminTicketsPageProps) {
  await requireActiveAdminPage();

  const resolvedSearchParams = await searchParams;
  const filters: TicketGroupFilters = {
    q: normalizeSearch(resolvedSearchParams.q),
    raffleId: parseRaffleId(resolvedSearchParams.raffle),
    period: parsePeriod(resolvedSearchParams.period),
    status: parseStatus(resolvedSearchParams.status),
    from: parseIsoDate(resolvedSearchParams.from),
    to: parseIsoDate(resolvedSearchParams.to),
  };
  const page = parsePage(resolvedSearchParams.page);
  const invalidDateRange = Boolean(
    filters.from && filters.to && filters.from > filters.to,
  );
  const ticketNumberSearch = getTicketNumberSearch(filters.q);
  const isProfessionalTicketSearch = TICKET_CODE_QUERY_PATTERN.test(
    filters.q,
  );
  const adminClient = createAdminClient();

  const rpcArgs: TicketGroupFunction["Args"] = {
    p_period: filters.period,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
    ...(filters.raffleId ? { p_raffle_id: filters.raffleId } : {}),
    ...(filters.status !== "all"
      ? { p_ticket_status: filters.status }
      : {}),
    ...(filters.from ? { p_date_from: filters.from } : {}),
    ...(filters.to ? { p_date_to: filters.to } : {}),
    ...(filters.q && !isProfessionalTicketSearch
      ? { p_search: filters.q }
      : {}),
    ...(ticketNumberSearch !== null
      ? { p_ticket_number: ticketNumberSearch }
      : {}),
  };

  const groupsPromise = invalidDateRange
    ? Promise.resolve({ data: [] as TicketGroupRow[], error: null })
    : adminClient.rpc("admin_list_ticket_groups", rpcArgs);

  const [groupsResult, rafflesResult] = await Promise.all([
    groupsPromise,
    adminClient
      .from("raffles")
      .select("id, name, status")
      .order("created_at", { ascending: false }),
  ]);

  if (groupsResult.error) {
    console.error("Could not load grouped tickets", {
      code: groupsResult.error.code,
      message: groupsResult.error.message,
    });
    throw new Error("No se pudieron cargar los grupos de tickets.");
  }

  if (rafflesResult.error) {
    console.error("Could not load raffles for ticket filters", {
      code: rafflesResult.error.code,
      message: rafflesResult.error.message,
    });
    throw new Error("No se pudieron cargar los sorteos disponibles.");
  }

  const groups = groupsResult.data ?? [];

  if (!invalidDateRange && groups.length === 0 && page > 1) {
    const firstGroupResult = await adminClient.rpc("admin_list_ticket_groups", {
      ...rpcArgs,
      p_limit: 1,
      p_offset: 0,
    });

    if (firstGroupResult.error) {
      console.error("Could not recover ticket pagination", {
        code: firstGroupResult.error.code,
        message: firstGroupResult.error.message,
      });
      throw new Error("No se pudo validar la página de tickets solicitada.");
    }

    const firstGroup = firstGroupResult.data?.[0];

    if (firstGroup) {
      const lastPage = Math.max(
        Math.ceil(toSafeCount(firstGroup.total_count) / PAGE_SIZE),
        1,
      );
      redirect(buildPageHref(filters, lastPage));
    }
  }

  const raffles = (rafflesResult.data ?? []) as RaffleOption[];
  const activeRaffles = raffles
    .filter((raffle) => raffle.status === "active")
    .map(({ id, name }) => ({ id, name }));
  const returnedGroupKeys = new Set(
    groups.map((group) =>
      groupKey(group.purchase_request_id, group.raffle_id),
    ),
  );

  let tickets: TicketDetail[] = [];
  const requestedQuantityByRequestId = new Map<string, number>();

  if (groups.length > 0) {
    const exactGroupFilter = groups
      .map(
        (group) =>
          `and(purchase_request_id.eq.${group.purchase_request_id},raffle_id.eq.${group.raffle_id})`,
      )
      .join(",");
    const purchaseRequestIds = [
      ...new Set(groups.map((group) => group.purchase_request_id)),
    ];
    const [ticketsResult, quantitiesResult] = await Promise.all([
      adminClient
        .from("tickets")
        .select(
          "id, raffle_id, purchase_request_id, ticket_number, ticket_status, origin_ticket_id, assigned_at",
        )
        .or(exactGroupFilter)
        .order("ticket_number", { ascending: true })
        .order("assigned_at", { ascending: true }),
      adminClient
        .from("purchase_requests")
        .select("id, requested_quantity")
        .in("id", purchaseRequestIds),
    ]);

    if (ticketsResult.error) {
      console.error("Could not load exact grouped tickets", {
        code: ticketsResult.error.code,
        message: ticketsResult.error.message,
      });
      throw new Error("No se pudieron cargar los tickets de cada grupo.");
    }

    if (quantitiesResult.error) {
      console.error("Could not load requested ticket quantities", {
        code: quantitiesResult.error.code,
        message: quantitiesResult.error.message,
      });
      throw new Error("No se pudo validar la cantidad de tickets solicitada.");
    }

    tickets = (ticketsResult.data ?? []).filter((ticket) =>
      returnedGroupKeys.has(
        groupKey(ticket.purchase_request_id, ticket.raffle_id),
      ),
    );

    for (const request of
      (quantitiesResult.data ?? []) as PurchaseRequestQuantity[]) {
      requestedQuantityByRequestId.set(
        request.id,
        request.requested_quantity,
      );
    }
  }

  const printCountByTicketId = new Map<string, number>();
  const ticketIds = tickets.map((ticket) => ticket.id);

  if (ticketIds.length > 0) {
    const printRowsByChunk = await Promise.all(
      chunk(ticketIds, PRINT_QUERY_CHUNK_SIZE).map(async (ticketIdChunk) => {
        const rows: Array<{ ticket_id: string }> = [];
        let rangeStart = 0;

        while (true) {
          const { data, error } = await adminClient
            .from("ticket_prints")
            .select("ticket_id")
            .in("ticket_id", ticketIdChunk)
            .order("printed_at", { ascending: true })
            .order("id", { ascending: true })
            .range(rangeStart, rangeStart + PRINT_QUERY_PAGE_SIZE - 1);

          if (error) {
            console.error("Could not load grouped ticket print counts", {
              code: error.code,
              message: error.message,
            });
            throw new Error(
              "No se pudieron cargar los conteos de impresión.",
            );
          }

          const pageRows = data ?? [];
          rows.push(...pageRows);

          if (pageRows.length < PRINT_QUERY_PAGE_SIZE) {
            break;
          }

          rangeStart += PRINT_QUERY_PAGE_SIZE;
        }

        return rows;
      }),
    );

    for (const print of printRowsByChunk.flat()) {
      printCountByTicketId.set(
        print.ticket_id,
        (printCountByTicketId.get(print.ticket_id) ?? 0) + 1,
      );
    }
  }

  const ticketsByGroup = new Map<string, TicketDetail[]>();

  for (const ticket of tickets) {
    const key = groupKey(ticket.purchase_request_id, ticket.raffle_id);
    const current = ticketsByGroup.get(key) ?? [];
    current.push(ticket);
    ticketsByGroup.set(key, current);
  }

  const totalCount = groups.length > 0 ? toSafeCount(groups[0].total_count) : 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : page;
  const firstVisible = groups.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastVisible = groups.length > 0 ? firstVisible + groups.length - 1 : 0;
  const hasPreviousPage = page > 1;
  const hasNextPage = totalCount > page * PAGE_SIZE;

  return (
    <AdminPage wide>
      <AdminPageHeader
        eyebrow="Panel"
        title="Tickets asignados"
        description="Consulta cada compra agrupada por solicitud y sorteo, imprime la tanda completa o gestiona cada ticket de forma independiente."
      />

      <TicketFilters filters={filters} raffles={raffles} />

      {invalidDateRange ? (
        <div className="mt-6">
          <AdminAlert>
            La fecha inicial no puede ser posterior a la fecha final. Corrige
            el rango para consultar los tickets.
          </AdminAlert>
        </div>
      ) : null}

      {!invalidDateRange ? (
        <div
          className="mt-6 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between"
          aria-live="polite"
        >
          <p>
            {groups.length > 0
              ? `Mostrando ${firstVisible}–${lastVisible} de ${totalCount} grupos.`
              : "No se encontraron grupos con los filtros seleccionados."}
          </p>
          <p>Página {page} de {Math.max(totalPages, 1)}</p>
        </div>
      ) : null}

      {!invalidDateRange && groups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Sin tickets para mostrar"
            description="Ajusta los filtros o crea y aprueba una solicitud de compra."
            action={
              <Link href="/admin/tickets" className={btnGhost}>
                Limpiar filtros
              </Link>
            }
          />
        </div>
      ) : null}

      {groups.length > 0 ? (
        <section className="mt-8 space-y-5" aria-label="Grupos de tickets">
          {groups.map((group) => {
            const key = groupKey(group.purchase_request_id, group.raffle_id);
            const groupTickets = ticketsByGroup.get(key) ?? [];

            return (
              <TicketGroupCard
                key={key}
                group={group}
                tickets={groupTickets}
                printCountByTicketId={printCountByTicketId}
                activeRaffles={activeRaffles}
                requestedQuantity={
                  requestedQuantityByRequestId.get(
                    group.purchase_request_id,
                  ) ?? 0
                }
              />
            );
          })}
        </section>
      ) : null}

      {!invalidDateRange && (hasPreviousPage || hasNextPage) ? (
        <Pagination
          page={page}
          totalPages={Math.max(totalPages, 1)}
          previousHref={
            hasPreviousPage ? buildPageHref(filters, page - 1) : null
          }
          nextHref={hasNextPage ? buildPageHref(filters, page + 1) : null}
        />
      ) : null}
    </AdminPage>
  );
}

function TicketFilters({
  filters,
  raffles,
}: {
  filters: TicketGroupFilters;
  raffles: RaffleOption[];
}) {
  return (
    <form
      action="/admin/tickets"
      method="get"
      role="search"
      className={`${adminCard} mt-8 p-4 sm:p-5`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="md:col-span-2 xl:col-span-2">
          <label htmlFor="ticket-search" className={adminLabel}>
            Cliente, documento, teléfono o ticket
          </label>
          <input
            id="ticket-search"
            name="q"
            type="search"
            defaultValue={filters.q}
            minLength={2}
            maxLength={50}
            placeholder="Ejemplo: Ana, 12345678 o PD-0001"
            className={adminInput}
          />
        </div>

        <div>
          <label htmlFor="ticket-raffle" className={adminLabel}>
            Sorteo
          </label>
          <select
            id="ticket-raffle"
            name="raffle"
            defaultValue={filters.raffleId ?? ""}
            className={adminInput}
          >
            <option value="">Todos</option>
            {raffles.map((raffle) => (
              <option key={raffle.id} value={raffle.id}>
                {raffle.name} · {RAFFLE_STATUS_LABELS[raffle.status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ticket-period" className={adminLabel}>
            Período
          </label>
          <select
            id="ticket-period"
            name="period"
            defaultValue={filters.period}
            className={adminInput}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ticket-status" className={adminLabel}>
            Estado del ticket
          </label>
          <select
            id="ticket-status"
            name="status"
            defaultValue={filters.status}
            className={adminInput}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-2">
          <div>
            <label htmlFor="ticket-from" className={adminLabel}>
              Compra desde
            </label>
            <input
              id="ticket-from"
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className={adminInput}
            />
          </div>
          <div>
            <label htmlFor="ticket-to" className={adminLabel}>
              Compra hasta
            </label>
            <input
              id="ticket-to"
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className={adminInput}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary}>
          Aplicar filtros
        </button>
        <Link href="/admin/tickets" className={btnGhost}>
          Limpiar
        </Link>
      </div>
    </form>
  );
}

function TicketGroupCard({
  group,
  tickets,
  printCountByTicketId,
  activeRaffles,
  requestedQuantity,
}: {
  group: TicketGroupRow;
  tickets: TicketDetail[];
  printCountByTicketId: Map<string, number>;
  activeRaffles: Array<{ id: string; name: string }>;
  requestedQuantity: number;
}) {
  const ticketCount = toSafeCount(group.ticket_count);
  const activeCount = toSafeCount(group.active_count);
  const frozenCount = toSafeCount(group.frozen_count);
  const reassignedCount = toSafeCount(group.reassigned_count);
  const voidedCount = toSafeCount(group.voided_count);
  const printedTicketCount = toSafeCount(group.printed_ticket_count);
  const printEventCount = toSafeCount(group.print_event_count);
  const canPrintGroup =
    group.request_status === "approved" &&
    activeCount > 0 &&
    activeCount + voidedCount === ticketCount &&
    activeCount + voidedCount === requestedQuantity;
  const headingId = `ticket-group-${group.purchase_request_id}-${group.raffle_id}`;

  return (
    <article className={`${adminCard} overflow-hidden`} aria-labelledby={headingId}>
      <header className="border-b border-line bg-ink-3/45 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={headingId} className="text-lg font-semibold text-cream">
                {group.full_name}
              </h2>
              <Badge tone={REQUEST_STATUS_TONES[group.request_status]}>
                Solicitud {REQUEST_STATUS_LABELS[group.request_status]}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {group.document_type === "cui" ? "CUI" : "DNI"}: {" "}
              <span className="font-medium text-cream">
                {group.document_number}
              </span>
              <span aria-hidden="true"> · </span>
              Tel. {group.phone}
            </p>
          </div>

          <div className="lg:text-right">
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <p className="font-medium text-cream">{group.raffle_name}</p>
              <Badge tone={RAFFLE_STATUS_TONES[group.raffle_status]}>
                {RAFFLE_STATUS_LABELS[group.raffle_status]}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted">
              Compra: {formatDateTime(group.purchased_at) ?? "No disponible"}
              <br />
              Última asignación: {" "}
              {formatDateTime(group.last_assigned_at) ?? "No disponible"}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <CountCell label="En este grupo" value={ticketCount} />
          <CountCell label="Solicitados" value={requestedQuantity} />
          <CountCell label="Vigentes" value={activeCount} tone="approved" />
          <CountCell label="Congelados" value={frozenCount} tone="gold" />
          <CountCell label="Reasignados" value={reassignedCount} />
          <CountCell label="Anulados" value={voidedCount} tone="rejected" />
          <CountCell label="Tickets impresos" value={printedTicketCount} />
          <CountCell label="Impresiones totales" value={printEventCount} />
        </dl>
      </header>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="font-medium text-cream">
              {ticketCount === 1 ? "1 ticket en este grupo" : `${ticketCount} tickets en este grupo`}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              La impresión individual y la tanda administrativa conservan
              fecha, administrador, secuencia y motivo de cada reimpresión.
            </p>
          </div>

          {canPrintGroup ? (
            <PurchaseRequestPrintAction
              purchaseRequestId={group.purchase_request_id}
              raffleId={group.raffle_id}
              ticketCount={activeCount}
              printedTicketCount={printedTicketCount}
            />
          ) : activeCount > 0 && group.request_status === "approved" ? (
            <p className="max-w-sm rounded-lg border border-amber-800/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              La tanda completa estará disponible cuando todos los tickets de
              este grupo estén vigentes. Puedes gestionar cada ticket debajo.
            </p>
          ) : null}
        </div>

        <details className="mt-5 rounded-xl border border-line bg-ink">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gold outline-none focus-visible:ring-2 focus-visible:ring-gold">
            Ver tickets y acciones ({tickets.length})
          </summary>

          {tickets.length === 0 ? (
            <p className="border-t border-line p-4 text-sm text-red-300">
              No se pudieron relacionar los tickets exactos de este grupo.
            </p>
          ) : (
            <div className="grid gap-3 border-t border-line p-3 md:grid-cols-2 2xl:grid-cols-3">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  requestStatus={group.request_status}
                  previousPrints={printCountByTicketId.get(ticket.id) ?? 0}
                  activeRaffles={activeRaffles}
                />
              ))}
            </div>
          )}
        </details>
      </div>
    </article>
  );
}

function TicketCard({
  ticket,
  requestStatus,
  previousPrints,
  activeRaffles,
}: {
  ticket: TicketDetail;
  requestStatus: PurchaseRequestStatus;
  previousPrints: number;
  activeRaffles: Array<{ id: string; name: string }>;
}) {
  return (
    <article className="rounded-xl border border-line bg-ink-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-light tabular-nums text-cream">
            {formatTicketCode(ticket.ticket_number)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Asignado: {formatDateTime(ticket.assigned_at) ?? "No disponible"}
          </p>
        </div>
        <Badge tone={TICKET_STATUS_TONES[ticket.ticket_status]}>
          {TICKET_STATUS_LABELS[ticket.ticket_status]}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
            Impresiones
          </dt>
          <dd className="mt-1 tabular-nums text-cream">{previousPrints}</dd>
        </div>
        <div>
          <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">
            Origen
          </dt>
          <dd className="mt-1 text-cream">
            {ticket.origin_ticket_id ? "Reasignación" : "Compra"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        {requestStatus === "approved" && ticket.ticket_status === "active" ? (
          <TicketPrintAction
            ticketId={ticket.id}
            previousPrints={previousPrints}
          />
        ) : ticket.ticket_status === "frozen" ? (
          <TicketReassignAction
            ticketId={ticket.id}
            activeRaffles={activeRaffles}
          />
        ) : ticket.ticket_status === "reassigned" ? (
          <p className="text-xs leading-relaxed text-muted">
            Ticket histórico. Su reemplazo vigente se conserva como un registro
            independiente y trazable.
          </p>
        ) : (
          <p className="text-xs text-red-300">
            La solicitud no está aprobada para impresión.
          </p>
        )}
      </div>
    </article>
  );
}

function CountCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "approved" | "gold" | "rejected";
}) {
  const toneClasses = {
    neutral: "border-line bg-ink-2 text-cream",
    approved: "border-emerald-900/60 bg-emerald-950/20 text-emerald-200",
    gold: "border-amber-900/60 bg-amber-950/20 text-amber-200",
    rejected: "border-red-900/60 bg-red-950/20 text-red-200",
  };

  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone]}`}>
      <dt className="text-[0.65rem] uppercase tracking-[0.13em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref: string | null;
  nextHref: string | null;
}) {
  return (
    <nav
      aria-label="Paginación de grupos de tickets"
      className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 sm:flex-row"
    >
      {previousHref ? (
        <Link href={previousHref} className={btnGhost} rel="prev">
          ← Página anterior
        </Link>
      ) : (
        <span className={`${btnGhost} cursor-not-allowed opacity-45`}>
          ← Página anterior
        </span>
      )}

      <p className="text-sm text-muted" aria-live="polite">
        Página <span className="text-cream">{page}</span> de {totalPages}
      </p>

      {nextHref ? (
        <Link href={nextHref} className={btnGhost} rel="next">
          Página siguiente →
        </Link>
      ) : (
        <span className={`${btnGhost} cursor-not-allowed opacity-45`}>
          Página siguiente →
        </span>
      )}
    </nav>
  );
}
