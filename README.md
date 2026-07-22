# Perla Dorada Rifas

MVP web para administrar rifas, solicitudes de compra, comprobantes Yape, tickets, impresión y registro del ganador.

## Requisitos

- Node.js 20.9 o superior.
- npm 10 o superior.
- Proyecto Supabase.

## Inicio local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Validaciones

```bash
npm run lint
npm run build
```

## Estructura

- `src/app`: rutas y layouts.
- `src/components`: componentes reutilizables.
- `src/features`: módulos de negocio.
- `src/lib`: clientes e infraestructura compartida.
- `src/server`: acciones y consultas del servidor.
- `src/types`: tipos transversales.
- `docs`: decisiones y plan de desarrollo.
