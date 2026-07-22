-- ============================================================
-- Bloque B / Bloque F: registro de auditoría (audit_log)
--
-- Tabla append-only para registrar acciones administrativas críticas
-- (cambios de configuración, aprobaciones, rechazos, impresiones,
-- ganador, etc.). No almacena secretos ni comprobantes; solo metadatos
-- no sensibles en `metadata` (jsonb).
--
-- Acceso: cerrado a anon/authenticated (RLS + REVOKE). El backend
-- escribe con service_role (bypass RLS). Sin UPDATE/DELETE otorgados:
-- el registro es inmutable por diseño de permisos.
-- ============================================================

create table if not exists public.audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null
    check (length(trim(action)) > 0 and length(action) <= 100),
  entity text not null
    check (length(trim(entity)) > 0 and length(entity) <= 100),
  entity_id text
    check (entity_id is null or length(entity_id) <= 200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity, entity_id);

create index if not exists audit_log_action_idx
  on public.audit_log (action);

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;

grant select, insert on public.audit_log to service_role;
