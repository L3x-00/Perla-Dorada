---
name: pd-contexto
description: >
  Re-audita el código real del proyecto Perla Dorada Rifas contra los documentos de
  docs/contex/ y corrige lo que haya quedado desactualizado. Usar cuando el usuario dice
  "actualiza el contexto", "revisa si los docs siguen correctos", "/pd-contexto", pide
  cargar/refrescar todo el contexto del proyecto, o al empezar una sesión larga de trabajo
  después de cambios grandes en el código que no pasaron por este flujo.
---

Skill del proyecto Perla Dorada Rifas (D:\perla-dorada-rifas). Objetivo: mantener `docs/contex/*.md` como fuente de verdad fiel al código real — nunca al revés. Los documentos describen el pasado; el código es la verdad presente.

## Al invocarse

1. Lee los 4 documentos actuales completos: `estado_proyecto.md`, `pendiente.md`, `arquitectura.md`, `errores.md`.
2. Lanza en paralelo (Agent tool, subagent_type Explore, 3 agentes) una auditoría real del código, cubriendo como mínimo:
   - Árbol de `src/` y `supabase/` completo, versiones de `package.json`, anomalías/duplicados/carpetas paralelas.
   - Todas las migraciones de `supabase/migrations/*.sql`: tablas, columnas, RPC/funciones (firma, SECURITY DEFINER, grants), políticas RLS, triggers, extensiones, jobs programados.
   - Estado de implementación real de cada área de la app: páginas públicas, admin, route handlers (¿coincide la URL que llama el cliente con la ruta real del servidor?), lib/, rate limiting, cualquier feature que los docs marquen como pendiente o completada.
3. Compara los hallazgos contra cada afirmación de los 4 documentos. Para cada discrepancia encontrada:
   - Si un doc dice algo que ya no es cierto (feature completada que se rompió, feature pendiente que ya se hizo, nombre de tabla/RPC/ruta cambiado): corrígelo con `Edit`, sin reescribir secciones enteras que sigan vigentes.
   - Si es un bug nuevo o deuda técnica nueva: añade entrada en `errores.md` con el mismo formato que las existentes (Área / Causa / Fix propuesto / Detectado con fecha).
   - Si un bug de `errores.md` ya no reproduce (se corrigió): márcalo 🟢 con fecha y referencia.
4. No inventes hallazgos ni "completes" secciones basándote en suposiciones — todo lo que se escriba debe venir de haber leído el archivo/migración/código real en esta pasada.
5. Al final, resume en 5-8 líneas qué cambió en los docs (no repitas todo el contenido, el usuario puede leer el diff).

## Notas

- Esto es exactamente el mismo procedimiento que se usó para la auditoría inicial del 22 jul 2026 — está pensado para repetirse cada vez que el código avance significativamente sin que los docs se hayan tocado a la par.
- Preferir Edit sobre Write para no perder historial/estructura de secciones que sigan correctas.
- Si el usuario no pidió esto pero vas a empezar una fase grande de `/pd-fases`, es razonable sugerir correr este skill primero si los docs tienen más de una sesión de antigüedad respecto al código.
