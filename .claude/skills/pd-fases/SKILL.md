---
name: pd-fases
description: >
  Propone y planea la siguiente subfase de mayor valor del proyecto Perla Dorada Rifas,
  basado en docs/contex/pendiente.md y docs/contex/errores.md. Usar cuando el usuario dice
  "siguiente fase", "qué sigue", "empecemos con la siguiente parte", "/pd-fases", o pide
  continuar el desarrollo del MVP de rifas sin especificar qué bloque tocar.
---

Skill del proyecto Perla Dorada Rifas (D:\perla-dorada-rifas). Objetivo: decidir y planear —no improvisar— la siguiente subfase de trabajo.

## Al invocarse

1. Lee `docs/contex/estado_proyecto.md`, `docs/contex/pendiente.md` y `docs/contex/errores.md` completos (no asumas que ya están en contexto; si el chat es nuevo, no lo están).
2. Prioridad de selección, en este orden:
   - Bugs 🔴 bloqueantes en `errores.md` (ERR-01 y cualquier otro que se marque bloqueante) van primero, siempre, salvo que el usuario pida explícitamente otra cosa.
   - Luego bloques de `pendiente.md` en orden A → G, saltando los que ya estén marcados como completados en una edición reciente del archivo.
   - Si el usuario ya indicó un bloque o feature específica en su mensaje, usa eso en vez de la prioridad automática — pero avisa si hay un bug bloqueante sin resolver que lo afecta.
3. Antes de proponer nada: inspecciona el árbol real relevante (Glob/Grep/Read), no confíes ciegamente en que `pendiente.md` sigue describiendo el estado actual — puede haber quedado desactualizado desde la última sesión. Si encuentras diferencias, corrige el doc como parte del trabajo (no lo dejes desactualizado) y anótalo en `errores.md` si aplica.
4. Presenta la propuesta usando EXACTAMENTE el formato de `docs/contex/arquitectura.md` §14 (Inspección / Alcance de esta iteración / Plan de cambios / Archivos / Implementación / Comandos / Pruebas / Rollback / Definición de terminado).
5. No implementes nada sin que el usuario confirme el alcance de la iteración, salvo que ya haya dado autorización explícita para "seguir con las fases" de forma continua en este mismo turno — en ese caso, procede pero manteniendo cambios pequeños e incrementales, y detente a reportar tras cada bloque completo (no encadenes bloques enteros sin dar visibilidad).
6. Tras implementar cualquier bloque: corre la secuencia de validación de `CLAUDE.md` (tsc/lint/build), actualiza `docs/contex/pendiente.md` (marcar lo completado), y actualiza `docs/contex/errores.md` si se cerró o abrió algún bug.

## Reglas heredadas (no las repitas al usuario, solo respétalas)

Todas las de `docs/contex/arquitectura.md` §12 (prohibiciones) y `pendiente.md` §3 (reglas de negocio invariantes) aplican sin excepción. No reintroducir paquetes. No inventar tablas/RPC/rutas — usa `src/types/database.ts` y las migraciones reales.
