-- ============================================================
-- normalize_raffle_prizes() reconstruye cada premio con
-- jsonb_build_object(title, quantity, image_path) y por eso descartaba
-- cualquier "id" que el formulario mandara de vuelta al editar. No era un
-- problema de integridad (assign_prize_ids le asigna uno nuevo igual, y
-- los premios se congelan antes de que un id pueda importarle a un
-- ganador — solo se puede editar en draft/active, solo se puede ganar en
-- closed), pero sí hacía que el id de un premio cambiara en cada guardado
-- sin necesidad. Se preserva el id existente cuando es un uuid válido.
-- ============================================================

create or replace function public.normalize_raffle_prizes(
  p_prizes jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_title text;
  v_quantity integer;
  v_image_path text;
  v_id text;
  v_count integer := 0;
begin
  if p_prizes is null then
    return '[]'::jsonb;
  end if;

  if jsonb_typeof(p_prizes) <> 'array' then
    raise exception 'PRIZES_NOT_ARRAY'
      using errcode = '22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_prizes)
  loop
    v_count := v_count + 1;

    if v_count > 20 then
      raise exception 'TOO_MANY_PRIZES'
        using errcode = '22023';
    end if;

    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'PRIZE_NOT_OBJECT'
        using errcode = '22023';
    end if;

    v_title := nullif(trim(coalesce(v_item->>'title', '')), '');

    if v_title is null then
      raise exception 'PRIZE_TITLE_REQUIRED'
        using errcode = '22023';
    end if;

    if length(v_title) > 120 then
      raise exception 'PRIZE_TITLE_TOO_LONG'
        using errcode = '22023';
    end if;

    begin
      v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    exception
      when others then
        raise exception 'PRIZE_QUANTITY_INVALID'
          using errcode = '22023';
    end;

    if v_quantity < 1 or v_quantity > 100000 then
      raise exception 'PRIZE_QUANTITY_OUT_OF_RANGE'
        using errcode = '22023';
    end if;

    v_image_path :=
      nullif(trim(coalesce(v_item->>'image_path', '')), '');

    if v_image_path is not null and length(v_image_path) > 300 then
      raise exception 'PRIZE_IMAGE_PATH_TOO_LONG'
        using errcode = '22023';
    end if;

    v_id := v_item->>'id';

    if v_id is null or v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_result := v_result || jsonb_build_object(
        'title', v_title,
        'quantity', v_quantity,
        'image_path', v_image_path
      );
    else
      v_result := v_result || jsonb_build_object(
        'id', v_id,
        'title', v_title,
        'quantity', v_quantity,
        'image_path', v_image_path
      );
    end if;
  end loop;

  return v_result;
end;
$$;
