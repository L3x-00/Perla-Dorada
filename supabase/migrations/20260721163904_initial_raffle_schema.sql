-- ============================================================
-- Joyería Perla Dorada
-- Esquema inicial del sistema de rifas
-- ============================================================

create extension if not exists pgcrypto
with schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================

create type public.raffle_status as enum (
  'draft',
  'active',
  'closed',
  'cancelled'
);

create type public.purchase_request_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired'
);

create type public.ticket_print_type as enum (
  'original',
  'reprint'
);

-- ============================================================
-- FUNCIONES COMUNES
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- CONFIGURACIÓN GENERAL
-- ============================================================

create table public.app_settings (
  id boolean primary key default true,
  maintenance_mode boolean not null default false,
  reservation_minutes integer not null default 60,
  max_reprints integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint app_settings_single_row
    check (id = true),

  constraint app_settings_reservation_minutes_positive
    check (reservation_minutes > 0),

  constraint app_settings_max_reprints_valid
    check (max_reprints between 0 and 20)
);

insert into public.app_settings (id)
values (true);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

-- ============================================================
-- ADMINISTRADORES
-- ============================================================

create table public.admin_profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,

  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_profiles_display_name_not_blank
    check (length(trim(display_name)) >= 2)
);

create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();

-- ============================================================
-- RIFAS
-- ============================================================

create table public.raffles (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  description text,
  status public.raffle_status not null default 'draft',
  ticket_price numeric(12, 2) not null,
  total_tickets integer not null,
  starts_at timestamptz,
  closes_at timestamptz,
  draw_at timestamptz,
  closed_at timestamptz,
  created_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint raffles_name_not_blank
    check (length(trim(name)) >= 3),

  constraint raffles_ticket_price_positive
    check (ticket_price > 0),

  constraint raffles_total_tickets_positive
    check (total_tickets > 0),

  constraint raffles_date_order
    check (
      starts_at is null
      or closes_at is null
      or starts_at < closes_at
    ),

  constraint raffles_draw_after_close
    check (
      closes_at is null
      or draw_at is null
      or draw_at >= closes_at
    ),

  constraint raffles_closed_at_consistent
    check (
      status <> 'closed'
      or closed_at is not null
    )
);

create unique index raffles_only_one_active_idx
on public.raffles ((status))
where status = 'active';

create index raffles_status_idx
on public.raffles (status);

create trigger raffles_set_updated_at
before update on public.raffles
for each row
execute function public.set_updated_at();

-- ============================================================
-- SOLICITUDES DE COMPRA
-- ============================================================

create table public.purchase_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  raffle_id uuid not null
    references public.raffles(id)
    on delete restrict,

  tracking_code text not null,
  full_name text not null,
  dni varchar(8) not null,
  phone text not null,
  whatsapp text not null,
  requested_quantity integer not null,
  payment_proof_path text not null,
  payment_proof_deleted_at timestamptz,

  status public.purchase_request_status
    not null
    default 'pending',

  expires_at timestamptz not null,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_requests_tracking_code_not_blank
    check (length(trim(tracking_code)) >= 8),

  constraint purchase_requests_full_name_not_blank
    check (length(trim(full_name)) >= 3),

  constraint purchase_requests_dni_format
    check (dni ~ '^[0-9]{8}$'),

  constraint purchase_requests_phone_length
    check (length(trim(phone)) between 7 and 20),

  constraint purchase_requests_whatsapp_length
    check (length(trim(whatsapp)) between 7 and 20),

  constraint purchase_requests_quantity_positive
    check (requested_quantity > 0),

  constraint purchase_requests_payment_path_not_blank
    check (length(trim(payment_proof_path)) > 0),

  constraint purchase_requests_expiration_after_creation
    check (expires_at > created_at),

  constraint purchase_requests_review_consistency
    check (
      (
        status = 'pending'
        and reviewed_at is null
        and reviewed_by is null
      )
      or
      (
        status in ('approved', 'rejected')
        and reviewed_at is not null
        and reviewed_by is not null
      )
      or status = 'expired'
    ),

  constraint purchase_requests_rejection_reason_consistency
    check (
      status <> 'rejected'
      or length(trim(rejection_reason)) > 0
    )
);

create unique index purchase_requests_tracking_code_idx
on public.purchase_requests (tracking_code);

create unique index purchase_requests_one_pending_dni_idx
on public.purchase_requests (raffle_id, dni)
where status = 'pending';

create index purchase_requests_raffle_status_idx
on public.purchase_requests (raffle_id, status);

create index purchase_requests_dni_idx
on public.purchase_requests (dni);

create index purchase_requests_expires_at_pending_idx
on public.purchase_requests (expires_at)
where status = 'pending';

create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row
execute function public.set_updated_at();

-- ============================================================
-- BOLETOS
-- ============================================================

create table public.tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  raffle_id uuid not null
    references public.raffles(id)
    on delete restrict,

  purchase_request_id uuid not null
    references public.purchase_requests(id)
    on delete restrict,

  ticket_number integer not null,
  assigned_at timestamptz not null default now(),

  constraint tickets_number_positive
    check (ticket_number > 0),

  constraint tickets_raffle_number_unique
    unique (raffle_id, ticket_number)
);

create index tickets_purchase_request_idx
on public.tickets (purchase_request_id);

create index tickets_raffle_idx
on public.tickets (raffle_id);

-- ============================================================
-- AUDITORÍA DE IMPRESIONES
-- ============================================================

create table public.ticket_prints (
  id uuid primary key default extensions.gen_random_uuid(),
  ticket_id uuid not null
    references public.tickets(id)
    on delete restrict,

  print_type public.ticket_print_type not null,
  print_sequence integer not null,
  printed_by uuid
    references auth.users(id)
    on delete set null,
  printed_at timestamptz not null default now(),
  reason text,

  constraint ticket_prints_sequence_positive
    check (print_sequence > 0),

  constraint ticket_prints_original_sequence
    check (
      (print_type = 'original' and print_sequence = 1)
      or
      (print_type = 'reprint' and print_sequence > 1)
    ),

  constraint ticket_prints_reason_for_reprint
    check (
      print_type <> 'reprint'
      or length(trim(reason)) > 0
    ),

  constraint ticket_prints_ticket_sequence_unique
    unique (ticket_id, print_sequence)
);

create index ticket_prints_ticket_idx
on public.ticket_prints (ticket_id);

-- ============================================================
-- GANADORES
-- ============================================================

create table public.raffle_winners (
  id uuid primary key default extensions.gen_random_uuid(),
  raffle_id uuid not null
    references public.raffles(id)
    on delete restrict,

  ticket_id uuid not null
    references public.tickets(id)
    on delete restrict,

  confirmed_by uuid
    references auth.users(id)
    on delete set null,

  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint raffle_winners_raffle_unique
    unique (raffle_id),

  constraint raffle_winners_ticket_unique
    unique (ticket_id)
);

-- Impide modificar o eliminar un ganador confirmado.

create or replace function public.prevent_raffle_winner_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception
    'El ganador confirmado de una rifa es inmutable.';
end;
$$;

create trigger raffle_winners_prevent_update
before update on public.raffle_winners
for each row
execute function public.prevent_raffle_winner_changes();

create trigger raffle_winners_prevent_delete
before delete on public.raffle_winners
for each row
execute function public.prevent_raffle_winner_changes();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.app_settings enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.raffles enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_prints enable row level security;
alter table public.raffle_winners enable row level security;

-- No se conceden permisos a anon ni authenticated todavía.
-- Las políticas y permisos se definirán en la siguiente subfase.

revoke all on table public.app_settings
from anon, authenticated;

revoke all on table public.admin_profiles
from anon, authenticated;

revoke all on table public.raffles
from anon, authenticated;

revoke all on table public.purchase_requests
from anon, authenticated;

revoke all on table public.tickets
from anon, authenticated;

revoke all on table public.ticket_prints
from anon, authenticated;

revoke all on table public.raffle_winners
from anon, authenticated;