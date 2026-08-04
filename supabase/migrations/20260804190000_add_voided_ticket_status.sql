-- ============================================================
-- Nuevo estado de ticket: 'voided' (anulado).
--
-- Se separa en su propia migración porque Postgres no permite usar un
-- valor de enum recién agregado dentro de la misma transacción en la que
-- se agregó (columnas/constraints/funciones que lo referencien deben ir en
-- una migración posterior).
-- ============================================================

alter type public.ticket_lifecycle_status add value if not exists 'voided';
