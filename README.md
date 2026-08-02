# Perla Dorada Rifas

Web de marca y sistema de gestión de rifas de Joyería Perla Dorada. Incluye
compra con comprobante Yape, tickets trazables, seguimiento por documento y
código, gestión de promociones y ganadores manuales por premio.

## Tecnología

- Next.js App Router, React y TypeScript.
- Supabase para PostgreSQL, Auth, Storage y Realtime.
- Zod para validación; Sharp y `file-type` para validar y recomprimir imágenes.
- Render para el Web Service y las tareas programadas.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Un proyecto Supabase configurado y variables de `.env.example` completadas.

## Inicio local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Validaciones

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run build
```

## Documentación

- [`docs/ENTREGA_CLIENTE.md`](docs/ENTREGA_CLIENTE.md): descripción, flujos y
  consideraciones para el cliente.
- [`docs/AUDITORIA_ENTREGA_2026-08-02.md`](docs/AUDITORIA_ENTREGA_2026-08-02.md):
  correcciones, pruebas y riesgos residuales.
- [`docs/contex/arquitectura.md`](docs/contex/arquitectura.md): reglas y
  convenciones técnicas de mantenimiento.
