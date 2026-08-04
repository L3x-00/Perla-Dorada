-- ============================================================
-- Corrige el teléfono provisional "SIN-TELEFONO" de AIORI JOSE
-- SIERRALTA RODRIGUEZ (boletos 015-029, importación manual del
-- 04 ago 2026) por el número real entregado por el cliente.
-- ============================================================

update public.purchase_requests
set
  phone = '929 926 232',
  whatsapp = '929 926 232',
  updated_at = now()
where full_name = 'AIORI JOSE SIERRALTA RODRIGUEZ'
  and phone = 'SIN-TELEFONO';
