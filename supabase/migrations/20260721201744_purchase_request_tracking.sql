create or replace function public.track_purchase_request(
  p_dni text,
  p_tracking_code text
)
returns table (
  request_id uuid,
  raffle_name text,
  request_status public.purchase_request_status,
  expires_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text,
  ticket_numbers integer[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    pr.id as request_id,
    r.name as raffle_name,
    pr.status as request_status,
    pr.expires_at,
    pr.reviewed_at,

    case
      when pr.status = 'rejected'
        then pr.rejection_reason
      else null
    end as rejection_reason,

    coalesce(
      array_agg(
        t.ticket_number
        order by t.ticket_number
      ) filter (
        where
          t.id is not null
          and pr.status = 'approved'
      ),
      array[]::integer[]
    ) as ticket_numbers

  from public.purchase_requests pr

  inner join public.raffles r
    on r.id = pr.raffle_id

  left join public.tickets t
    on t.purchase_request_id = pr.id

  where pr.dni = trim(p_dni)
    and upper(pr.tracking_code) =
        upper(trim(p_tracking_code))

  group by
    pr.id,
    r.name,
    pr.status,
    pr.expires_at,
    pr.reviewed_at,
    pr.rejection_reason;
$$;

revoke all
on function public.track_purchase_request(
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.track_purchase_request(
  text,
  text
)
to service_role;