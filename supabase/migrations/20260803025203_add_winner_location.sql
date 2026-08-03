-- ============================================================
-- Ubicación pública y segura del ganador
--
-- Se registra una ciudad o distrito, nunca dirección exacta. El valor queda
-- congelado junto al ganador porque raffle_winners es inmutable.
-- ============================================================

alter table public.raffle_winners
  add column if not exists winner_location text;

alter table public.raffle_winners
  drop constraint if exists raffle_winners_location_length;

alter table public.raffle_winners
  add constraint raffle_winners_location_length
  check (
    winner_location is null
    or char_length(trim(winner_location)) between 2 and 120
  );

comment on column public.raffle_winners.winner_location
  is 'Ciudad o distrito declarado al registrar al ganador. Se muestra públicamente; nunca almacenar dirección exacta.';

drop function if exists public.register_raffle_winner(uuid, uuid, integer, uuid);

create function public.register_raffle_winner(
  p_admin_user_id uuid,
  p_raffle_id uuid,
  p_ticket_number integer,
  p_prize_id uuid default null,
  p_winner_location text default null
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
  v_prize jsonb;
  v_prize_title text;
  v_prize_image_path text;
  v_winner_location text := nullif(regexp_replace(trim(coalesce(p_winner_location, '')), '\s+', ' ', 'g'), '');
begin
  perform public.assert_active_admin(p_admin_user_id);

  if p_ticket_number is null or p_ticket_number <= 0 then
    raise exception 'INVALID_TICKET_NUMBER' using errcode = '22023';
  end if;

  if v_winner_location is null
     or char_length(v_winner_location) < 2
     or char_length(v_winner_location) > 120 then
    raise exception 'INVALID_WINNER_LOCATION' using errcode = '22023';
  end if;

  select r.* into v_raffle
  from public.raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'closed' then
    raise exception 'RAFFLE_NOT_CLOSED' using errcode = 'P0001';
  end if;

  if jsonb_array_length(v_raffle.prizes) = 0 then
    if p_prize_id is not null then
      raise exception 'PRIZE_ID_NOT_ALLOWED' using errcode = '22023';
    end if;
  else
    if p_prize_id is null then
      raise exception 'PRIZE_ID_REQUIRED' using errcode = '22023';
    end if;

    select elem
    into v_prize
    from jsonb_array_elements(v_raffle.prizes) elem
    where (elem->>'id')::uuid = p_prize_id;

    if v_prize is null then
      raise exception 'PRIZE_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_prize_title := v_prize->>'title';
    v_prize_image_path := nullif(v_prize->>'image_path', '');
  end if;

  if p_prize_id is not null then
    if exists (
      select 1 from public.raffle_winners w
      where w.raffle_id = p_raffle_id and w.prize_id = p_prize_id
    ) then
      raise exception 'PRIZE_ALREADY_HAS_WINNER' using errcode = 'P0001';
    end if;
  else
    if exists (
      select 1 from public.raffle_winners w
      where w.raffle_id = p_raffle_id and w.prize_id is null
    ) then
      raise exception 'RAFFLE_ALREADY_HAS_WINNER' using errcode = 'P0001';
    end if;
  end if;

  select t.* into v_ticket
  from public.tickets t
  where t.raffle_id = p_raffle_id
    and t.ticket_number = p_ticket_number;

  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_ticket.ticket_status <> 'active' then
    raise exception 'TICKET_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.raffle_winners w where w.ticket_id = v_ticket.id
  ) then
    raise exception 'TICKET_ALREADY_WINNER' using errcode = 'P0001';
  end if;

  insert into public.raffle_winners (
    raffle_id,
    ticket_id,
    prize_id,
    prize_title,
    prize_image_path,
    winner_location,
    confirmed_by
  )
  values (
    p_raffle_id,
    v_ticket.id,
    p_prize_id,
    v_prize_title,
    v_prize_image_path,
    v_winner_location,
    p_admin_user_id
  )
  returning * into v_winner;

  return v_winner;
end;
$$;

revoke all
  on function public.register_raffle_winner(uuid, uuid, integer, uuid, text)
  from public, anon, authenticated;

grant execute
  on function public.register_raffle_winner(uuid, uuid, integer, uuid, text)
  to service_role;

comment on function public.register_raffle_winner(uuid, uuid, integer, uuid, text)
  is 'Registra un ganador irreversible con ciudad o distrito de compra. Uso exclusivo del backend.';
