-- ============================================================
-- Promociones del modal de bienvenida — gestión desde el panel admin.
--
-- Reemplaza la config estática (src/config/promotions.ts, eliminada en este
-- mismo cambio) por una tabla: el administrador sube la foto, escribe
-- título/descripción y elige si el CTA redirige a un sorteo o a un enlace
-- propio, todo sin tocar código ni desplegar.
--
-- Las fotos reutilizan el bucket público raffle-images (carpeta
-- promotions/) en vez de crear un bucket nuevo: mismo propósito ("imagen de
-- marketing pública"), mismas políticas ya correctas (solo service_role
-- escribe, lectura pública por ser bucket público).
--
-- Mismo patrón sin-RLS del resto del proyecto (DEC-03): REVOKE ALL de
-- anon/authenticated, solo service_role opera sobre la tabla. Es una tabla
-- de contenido de marketing, no una operación crítica con invariantes de
-- negocio, así que el CRUD va directo desde las rutas admin (como
-- app_settings), sin necesitar RPC SECURITY DEFINER.
-- ============================================================

create type public.promotion_cta_kind as enum ('raffle', 'url');

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  image_path text,
  cta_kind public.promotion_cta_kind not null default 'url',
  cta_raffle_id uuid references public.raffles(id) on delete set null,
  cta_url text,
  cta_text text not null default 'Ver más',
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint promotions_title_length check (char_length(title) between 1 and 150),
  constraint promotions_description_length check (char_length(description) <= 500),
  constraint promotions_cta_text_length check (char_length(cta_text) between 1 and 40),
  constraint promotions_image_path_length check (image_path is null or char_length(image_path) <= 400),
  constraint promotions_cta_url_length check (cta_url is null or char_length(cta_url) <= 2000),
  constraint promotions_date_range check (starts_at is null or ends_at is null or ends_at >= starts_at),

  /*
   * A propósito NO exige cta_raffle_id is not null cuando cta_kind='raffle':
   * si el admin borra ese sorteo (solo se puede borrar en estado 'draft'),
   * el FK deja este campo en null vía ON DELETE SET NULL. Bloquear eso con
   * un CHECK haría fallar el borrado del sorteo por una promoción que ni
   * siquiera se está tocando. En el sitio público, cta_kind='raffle' siempre
   * enlaza a la sección #sorteo (solo hay una rifa activa a la vez), así que
   * perder la referencia puntual no rompe nada — solo se pierde la etiqueta
   * informativa en el panel. La obligatoriedad de elegir un sorteo al crear
   * o editar se valida en la aplicación (Zod), no aquí.
   */
  constraint promotions_cta_kind_fields check (
    (cta_kind = 'raffle' and cta_url is null)
    or (cta_kind = 'url' and cta_url is not null and cta_raffle_id is null)
  )
);

comment on table public.promotions is 'Promociones del carrusel de bienvenida público. Gestionadas desde /admin/promotions.';
comment on column public.promotions.image_path is 'Ruta del objeto en el bucket público raffle-images (carpeta promotions/). NULL = fondo degradado por defecto.';
comment on column public.promotions.cta_raffle_id is 'Sorteo elegido para el CTA cuando cta_kind = raffle. Solo informativo: el enlace público siempre apunta a #sorteo.';

create index promotions_enabled_dates_idx on public.promotions (enabled, starts_at, ends_at);
create index promotions_cta_raffle_id_idx on public.promotions (cta_raffle_id) where cta_raffle_id is not null;

create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

revoke all on public.promotions from public, anon, authenticated;
grant all on public.promotions to service_role;
