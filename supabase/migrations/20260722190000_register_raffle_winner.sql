-- ============================================================
-- Bloque E: registro de ganador (irreversible)
--
-- La tabla raffle_winners YA EXISTE (unicidad por rifa y por ticket,
-- triggers que impiden UPDATE/DELETE). Aquí solo se agrega el RPC
-- transaccional que la escribe, validando:
--   - administrador activo
--   - rifa cerrada
--   - que la rifa no tenga ya un ganador
--   - que el número de ticket exista y pertenezca a la rifa
--
-- Recibe el NÚMERO de ticket (amigable para el admin) y resuelve su id.
-- ============================================================

create or replace function public.register_raffle_winner(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_ticket_number integer
)
returns public.raffle_winners
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raffle public.raffles%rowtype;
  v_ticket public.tickets%rowtype;
  v_winner public.raffle_winners%rowtype;
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_ticket_number is null or p_ticket_number <= 0 then
    raise exception 'INVALID_TICKET_NUMBER' using errcode = '22023';
  end if;

  -- Bloquea la rifa para serializar el registro del ganador.
  select r.*
  into v_raffle
  from public.raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'closed' then
    raise exception 'RAFFLE_NOT_CLOSED' using errcode = 'P0001';
  end if;

  -- Un solo ganador por rifa (respaldado además por índice único).
  if exists (
    select 1
    from public.raffle_winners w
    where w.raffle_id = p_raffle_id
  ) then
    raise exception 'RAFFLE_ALREADY_HAS_WINNER' using errcode = 'P0001';
  end if;

  select t.*
  into v_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id
    and t.ticket_number = p_ticket_number;

  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.raffle_winners (
    raffle_id,
    ticket_id,
    confirmed_by
  )
  values (
    p_raffle_id,
    v_ticket.id,
    p_admin_user_id
  )
  returning * into v_winner;

  return v_winner;
end;
$$;

revoke all
  on function public.register_raffle_winner(uuid, uuid, integer)
  from public, anon, authenticated;

grant execute
  on function public.register_raffle_winner(uuid, uuid, integer)
  to service_role;

comment on function public.register_raffle_winner(uuid, uuid, integer)
  is 'Registra el ganador único e irreversible de una rifa cerrada, validando administrador activo, estado cerrado, ausencia de ganador previo y pertenencia del ticket. Uso exclusivo del backend.';
