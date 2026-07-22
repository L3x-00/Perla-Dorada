---
name: pd-errores
description: >
  Revisa el código del proyecto Perla Dorada Rifas en busca de bugs y deuda técnica nueva,
  y mantiene docs/contex/errores.md actualizado (agrega, cierra o reabre entradas). Usar
  cuando el usuario dice "revisa errores", "qué bugs hay", "actualiza la bitácora de
  errores", "/pd-errores", o después de terminar un bloque de trabajo para verificar que
  no se introdujeron problemas nuevos.
---

Skill del proyecto Perla Dorada Rifas (D:\perla-dorada-rifas). Objetivo: mantener `docs/contex/errores.md` como bitácora viva y confiable — no un checklist decorativo.

## Al invocarse

1. Lee `docs/contex/errores.md` completo — entradas activas (🔴/🟡) y decisiones pendientes (⚪).
2. Para cada entrada 🔴/🟡 abierta: verifica en el código actual si sigue reproduciendo (lee el archivo/línea referenciado). Si ya no aplica, márcala 🟢 con fecha y una línea de qué la corrigió.
3. Busca bugs nuevos, con foco en lo que el proyecto ya demostró que falla fácilmente:
   - Mismatch entre la URL que hace `fetch()` un client component y la ruta real del `route.ts` correspondiente (el mismo patrón que causó ERR-01) — grep todos los `fetch(` en `src/app/**/*.tsx` contra el árbol real de `src/app/api/**` y `src/app/admin/**/route.ts`.
   - Valores hardcodeados que deberían leer `app_settings` (patrón de ERR-02) — grep literales de tiempo/números en migraciones y route handlers.
   - RPC nuevos sin `grant execute` explícito a `service_role` (patrón de ERR-05).
   - Cualquier RPC/tabla nueva sin política de acceso clara (ni RLS ni SECURITY DEFINER + revoke all).
   - Dependencias nuevas no justificadas (revisa diffs de `package.json` si están disponibles vía git).
4. No reportes como "bug" algo que sea una decisión de diseño ya documentada en la sección 3 (Decisiones pendientes) de `errores.md`, salvo que haya cambiado de forma que amerite revisarla.
5. Actualiza el archivo con `Edit`: nuevas entradas siguen el mismo formato (ID correlativo `ERR-xx`, severidad, área, causa, fix propuesto, fecha de detección). No borres entradas cerradas — quedan como historial con 🟢.
6. Resume al usuario solo lo que cambió (nuevas entradas, cierres, reaperturas) — no repitas la bitácora completa en el chat.

## Notas

- Este skill es de solo-lectura sobre el código de producto (no corrige bugs, solo los documenta) salvo que el usuario pida explícitamente corregir alguno en la misma invocación.
- Si se detecta un bug 🔴 bloqueante nuevo, avisa de inmediato al usuario aunque el resto de la revisión no haya terminado.
