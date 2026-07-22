-- ============================================================
-- Bloque B: mensaje de mantenimiento configurable
--
-- Agrega una columna opcional a app_settings para personalizar el
-- texto que ve el público cuando el portal está en mantenimiento.
-- Si es NULL o vacía, la aplicación usa un mensaje por defecto.
-- ============================================================

alter table public.app_settings
  add column if not exists maintenance_message text;

alter table public.app_settings
  drop constraint if exists app_settings_maintenance_message_length;

alter table public.app_settings
  add constraint app_settings_maintenance_message_length
  check (
    maintenance_message is null
    or length(maintenance_message) <= 500
  );

comment on column public.app_settings.maintenance_message
  is 'Mensaje público opcional para el modo mantenimiento (máx 500 caracteres). NULL o vacío = mensaje por defecto de la aplicación.';
