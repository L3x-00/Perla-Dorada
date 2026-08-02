-- La normalización de premios usa constructores JSONB clasificados como
-- STABLE por PostgreSQL. La función no lee tablas, pero no debe declararse
-- IMMUTABLE si sus expresiones no lo son.
alter function public.normalize_raffle_prizes(jsonb) stable;

-- Misma generación y máximo de doce intentos, expresados como bucles
-- acotados para que PL/pgSQL pueda verificar que la función siempre retorna
-- un código o lanza un error controlado.
create or replace function public.generate_tracking_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_length constant integer := 8;
  v_max_attempts constant integer := 12;
  v_bytes bytea;
  v_code text;
begin
  for v_attempt in 1 .. v_max_attempts loop
    v_code := '';
    v_bytes := extensions.gen_random_bytes(v_length);

    for v_offset in 0 .. v_length - 1 loop
      v_code := v_code || substr(
        v_alphabet,
        (get_byte(v_bytes, v_offset) % 32) + 1,
        1
      );
    end loop;

    if not exists (
      select 1
      from public.participant_tracking_codes ptc
      where ptc.tracking_code = v_code
    ) and not exists (
      select 1
      from public.participant_tracking_code_aliases ptca
      where ptca.tracking_code = v_code
    ) then
      return v_code;
    end if;
  end loop;

  raise exception 'TRACKING_CODE_GENERATION_FAILED' using errcode = '55000';
end;
$$;
