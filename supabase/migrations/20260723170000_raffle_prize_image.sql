-- ============================================================
-- Imagen del premio de cada rifa
--
-- El premio cambia en cada sorteo (3-4 al año), así que la foto debe
-- poder subirse desde el panel sin tocar código ni desplegar.
--
-- A diferencia de payment-proofs, este bucket ES público: la foto del
-- premio se muestra en la web abierta. Solo el backend (service_role)
-- puede escribir; cualquiera puede leer.
-- ============================================================

alter table public.raffles
  add column if not exists image_path text;

alter table public.raffles
  drop constraint if exists raffles_image_path_length;

alter table public.raffles
  add constraint raffles_image_path_length
  check (image_path is null or length(image_path) <= 400);

comment on column public.raffles.image_path
  is 'Ruta del objeto en el bucket público raffle-images. NULL = la rifa no tiene foto de premio.';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'raffle-images',
  'raffle-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id)
do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Sin políticas para anon/authenticated: la escritura pasa siempre por el
-- backend con service_role. La lectura es pública por ser bucket público.
