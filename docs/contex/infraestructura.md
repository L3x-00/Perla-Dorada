PD-CC-05 · Alcance de la infraestructura, límites de los planes y escalado

Sistema Web de Gestión de Rifas — Joyería Perla Dorada · 23 jul 2026

---

## 0. Para qué sirve este documento

Responder, con números, a tres preguntas antes de que ocurran:

1. ¿Hasta dónde aguanta lo que tenemos hoy (planes gratuitos / baratos)?
2. ¿Qué se rompe primero y a partir de cuántos usuarios/boletos?
3. ¿Qué decisión de plan hay que tomar, cuándo, y cuánto cuesta?

No es un documento de alarma: el sistema está bien construido para su escala real (una rifa 3-4 veces al año, la web como vitrina de marca el resto del tiempo). Es un mapa de los bordes.

---

## 1. Qué tenemos hoy

| Pieza | Servicio | Plan actual | Rol |
|---|---|---|---|
| Aplicación web (Next.js) | **Render** | Web Service | Sirve el sitio y toda la API |
| Base de datos + Auth + Storage + Realtime | **Supabase** | Proyecto `iewcowhkfsywdiyligsq` | Fuente de verdad, login admin, comprobantes, fotos |
| Tareas programadas | **Render Cron Jobs** | 2 jobs (curl con Bearer) | Vencer reservas / retención de comprobantes |

Todo el estado vive en Supabase. Render es sin estado: si se cae y se reinicia, no se pierde nada. Esto es bueno para escalar (se puede duplicar la instancia web sin coordinación).

---

## 2. Los límites reales de cada plan

Cifras de referencia de los planes (verificar en la facturación real, cambian con el tiempo):

### Render

| | Free | Starter (~7 USD/mes) | Standard (~25 USD/mes) |
|---|---|---|---|
| Siempre encendido | ❌ se duerme a los 15 min | ✅ | ✅ |
| Arranque en frío | 30-60 s la 1ª visita tras dormir | — | — |
| RAM | 512 MB | 512 MB | 2 GB |
| CPU | compartida | 0.5 | 1 |
| Ancho de banda | 100 GB/mes | 100 GB/mes | mayor |

**El arranque en frío del plan Free es el problema práctico para este negocio**: la web es una vitrina que estará casi siempre inactiva (8-9 meses sin rifa). En Free, el primer visitante tras un rato de inactividad espera ~1 minuto a que el servicio despierte, y muchos cierran la pestaña antes. Para una web de marca eso es inaceptable. **Recomendación firme: Render Starter como mínimo** (ya decidido en el proyecto).

### Supabase

| | Free | Pro (~25 USD/mes) |
|---|---|---|
| Base de datos | 500 MB | 8 GB (ampliable) |
| **Almacenamiento de archivos** | **1 GB** | 100 GB |
| **Ancho de banda (egress)** | **5 GB/mes** | 250 GB/mes |
| Pausa por inactividad | ❌ se pausa a la semana | ✅ nunca |
| Backups | ninguno | diarios (7 días) |
| Conexiones a BD | límite bajo, pooler obligatorio | mayor |

**Dos límites del plan Free de Supabase son los que este sistema toca primero: el almacenamiento (1 GB) y el egress (5 GB/mes).** Ver sección 4.

Además, **la pausa por inactividad del plan Free es incompatible con una vitrina**: si nadie entra una semana, Supabase pausa el proyecto y la web deja de cargar hasta que alguien lo reactiva desde el panel. Otra razón para no depender del Free en Supabase si la web debe estar viva todo el año.

---

## 3. Cómo consume recursos cada acción (el modelo de carga)

| Acción | BD | Storage | Egress | Bloqueo |
|---|---|---|---|---|
| Ver la landing (sin rifa) | 1 lectura | — | HTML + foto de marca | — |
| Ver la landing (con rifa) | 2-3 lecturas | — | HTML + **foto del premio** | — |
| Registrar solicitud | 1 RPC (varias queries) | **+1 imagen (≤5 MB)** | subida | **FOR UPDATE sobre la rifa activa** |
| Consultar estado / tickets | 1 RPC + 2 escrituras de rate-limit | — | pequeño | — |
| Admin: ver comprobante | 1 lectura + URL firmada | — | **descarga de la imagen** | — |
| Aprobar solicitud | 1 RPC (asigna tickets) | — | — | FOR UPDATE sobre la rifa |
| Cron vencer/retención | 1 RPC c/u | retención borra imágenes | — | — |

Dos cosas a retener de esta tabla:

- **Cada solicitud sube una imagen de hasta 5 MB al Storage.** Es el gasto de almacenamiento dominante.
- **Las escrituras críticas (crear solicitud, aprobar) toman un bloqueo de fila sobre la rifa activa.** Es correcto —garantiza que no se vendan más boletos de los que hay— pero define el techo de escrituras por segundo (sección 5).

---

## 4. Qué se rompe primero: almacenamiento y egress

### 4.1 Almacenamiento de comprobantes (1 GB en Free)

Cada solicitud deja una imagen. Suponiendo comprobantes de móvil de ~1.5 MB de media:

| Solicitudes en una rifa | Storage usado | ¿Cabe en 1 GB Free? |
|---|---|---|
| 100 | ~150 MB | Sí |
| 300 | ~450 MB | Sí, con margen |
| 600 | ~900 MB | Al límite |
| 1000 | ~1.5 GB | **No — se rompe la subida** |

Cuando el bucket se llena, **las nuevas solicitudes fallan al subir el comprobante** (el endpoint responde 500 "No se pudo subir el comprobante"), justo en el peor momento: una rifa que va bien.

Mitigaciones ya presentes:
- Validación de tamaño (máx 5 MB) y tipo (JPG/PNG/WEBP) antes de subir.
- **Cron de retención**: borra los comprobantes 15 días después de cerrar la rifa. Esto libera el espacio *entre* rifas, pero **no durante** una rifa activa.

Qué falta / decisiones:
- Con rifas de hasta ~300-400 solicitudes, el Free de Storage aguanta. Por encima, hay que subir a Supabase Pro (100 GB) **o** comprimir los comprobantes al subir (reducir 5 MB → ~300 KB con una recompresión del lado del servidor multiplicaría por ~5-10 la capacidad efectiva). La compresión es la opción barata y se puede añadir sin cambiar el flujo.

### 4.2 Egress / ancho de banda (5 GB/mes en Free)

Cada byte que Supabase envía cuenta: fotos del premio servidas al público, comprobantes descargados por el admin, imágenes de la vitrina.

El gasto dominante es **la foto del premio en la landing**, que se sirve a *todos* los visitantes:

| Visitas a la landing/mes | Foto del premio | Egress aprox. |
|---|---|---|
| 2 000 | 1 MB | ~2 GB |
| 5 000 | 1 MB | **~5 GB — límite Free** |
| 5 000 | 200 KB (optimizada) | ~1 GB |

Una campaña de rifa con difusión en redes puede traer varios miles de visitas en pocos días. Con una foto de 1-2 MB sin optimizar, se agota el egress Free rápido, y al agotarse **Supabase deja de servir las imágenes** (rompe la vitrina).

Mitigaciones / decisiones:
- **Optimizar la foto del premio antes de subirla** (idealmente < 300 KB, formato WEBP). Es la palanca más barata y efectiva.
- Servir imágenes públicas por una CDN/caché delante de Supabase reduce el egress a casi cero en picos (la CDN sirve la copia). Render puede cachear, o se puede usar un CDN gratuito. Decisión para cuando el tráfico lo justifique.
- Supabase Pro sube el egress a 250 GB/mes: margen de sobra.

---

## 5. Picos de compra y solicitudes masivas (concurrencia)

### 5.1 El techo de escrituras: el bloqueo de la rifa activa

`create_purchase_request` y `approve_purchase_request` hacen `SELECT ... FOR UPDATE` sobre la fila de la rifa activa. Esto **serializa** todas las compras: se procesan de una en una, no en paralelo. Es la decisión correcta (evita sobreventa de boletos), pero significa:

- El throughput de altas está limitado por lo que tarda cada RPC (~10-40 ms) → orden de **25-100 solicitudes por segundo** en el mejor caso.
- Para una rifa normal (cientos de solicitudes repartidas en días) esto es holgadísimo.
- En un **pico sincronizado** (se anuncia la rifa y 500 personas entran a comprar en el mismo minuto), las peticiones hacen cola sobre el bloqueo. Las últimas pueden esperar segundos y, si Render/Supabase cortan por timeout, el usuario ve un error aunque el sistema esté sano.

No es un bug: es el coste de la consistencia fuerte. Qué hacer si se prevé un pico así:
- Es un evento raro (3-4 rifas/año). Aceptable de origen.
- Si un lanzamiento concreto se espera viral, conviene subir temporalmente el plan de Supabase (más CPU/conexiones acorta cada RPC y sube el techo) y tener Render Starter/Standard caliente.
- No intentar "paralelizar" quitando el bloqueo: reintroduce sobreventa. La cola es la garantía.

### 5.2 Conexiones a la base de datos

Cada petición HTTP crea un cliente Supabase y abre conexión. El plan Free tiene un límite bajo de conexiones directas; **hay que usar siempre el pooler de Supabase** (puerto 6543 / cadena "pooler") en la variable de conexión, no la conexión directa, o un pico agota las conexiones y todo empieza a devolver errores de "too many connections". Verificar que la URL usada es la del pooler.

### 5.3 El coste oculto del rate limit bajo flood

El rate limit escribe en la BD *antes* de decidir si permite (upsert de contadores). Un atacante que inunda `/api/tracking` genera escrituras aunque reciba 429. Mitigaciones presentes:
- La IP ya no es falsificable (ERR-12 corregido): un atacante no puede abrir infinitos cubos; su volumen queda acotado por las IPs reales que controle.
- La tabla de contadores ya se purga (ERR-14 corregido): no crece sin fin.
- Aun así, un flood distribuido genera carga de escritura. Si algún día es un problema real, la defensa es una capa de rate-limit en el borde (antes de tocar la BD). Hoy no se justifica.

---

## 6. Resumen: qué se rompe, cuándo, y qué hacer

| Recurso | Se rompe cuando… | Señal temprana | Palanca (barata → cara) |
|---|---|---|---|
| **Storage comprobantes** (1 GB Free) | una rifa pasa de ~600 solicitudes | subidas empiezan a fallar (500) | comprimir al subir → Supabase Pro |
| **Egress** (5 GB/mes Free) | ~5 000 visitas con foto pesada | imágenes dejan de cargar | optimizar foto → CDN/caché → Pro |
| **Arranque en frío** (Render Free) | siempre, tras inactividad | 1ª visita tarda ~1 min | **Render Starter (ya decidido)** |
| **Pausa Supabase** (Free) | 1 semana sin tráfico | la web deja de cargar | Supabase Pro (no se pausa) |
| **Throughput de compra** | pico sincronizado de cientos/min | timeouts en la compra | subir plan Supabase temporalmente el día del lanzamiento |
| **Conexiones BD** | pico + conexión directa | "too many connections" | usar el pooler (config, gratis) |
| **DB llena** (500 MB Free) | improbable (filas diminutas) | — | purga ya activa; Pro si acaso |

---

## 7. Recomendación de planes por escenario

- **Vitrina todo el año, rifas pequeñas (≤300 solicitudes):** Render Starter + Supabase Free *puede* funcionar, pero la **pausa por inactividad de Supabase Free rompe la vitrina**. Recomendado: Render Starter + Supabase Pro. Coste ~32 USD/mes, todo estable sin sorpresas.
- **Rifas medianas (300-800 solicitudes) o con difusión fuerte:** Render Starter + Supabase Pro, y **optimizar/compimir imágenes**. El egress y el storage son los límites, no el cómputo.
- **Lanzamiento que se espera viral:** lo anterior + subir temporalmente el cómputo de Supabase el día del evento + confirmar que se usa el pooler. Bajar el plan después.

La decisión de fondo no es Render vs Vercel (ya resuelta: se queda en Render, migrar no requiere reestructurar nada). Es **Supabase Free vs Pro**, y el disparador es doble: (1) que la web deba estar viva todo el año sin pausarse, y (2) el tamaño de las rifas. Ambos apuntan a Pro en cuanto el proyecto sea "de verdad" y no de pruebas.

---

## 8. Cosas baratas que suben el techo sin cambiar de plan

1. **Comprimir el comprobante al subir** (5 MB → ~300 KB): multiplica por ~5-10 la capacidad de Storage y reduce egress de admin. La de mayor impacto por esfuerzo.
2. **Optimizar la foto del premio** (< 300 KB WEBP) antes de subirla desde el panel: corta el egress público, que es el que se dispara en campañas.
3. **Confirmar la cadena del pooler** en la variable de conexión: evita el colapso por conexiones en picos, coste cero.
4. **Cachear las imágenes públicas** (cabeceras de caché ya se pueden ajustar; una CDN delante si hace falta): egress casi nulo en picos.
5. Mantener los **dos Render Cron Jobs** activos: la retención es lo que recupera el Storage entre rifas; sin ella, el bucket solo crece.

---

## 9. Estado de las mitigaciones a hoy (23 jul 2026)

- ✅ Validación de tamaño/tipo de comprobante antes de subir.
- ✅ Cron de retención (borra comprobantes 15 días tras cierre) — recupera Storage entre rifas.
- ✅ Purga de la tabla de rate-limit (ERR-14) — la BD no crece sin fin.
- ✅ IP no falsificable en el rate-limit (ERR-12) — el volumen de abuso queda acotado.
- ✅ Bloqueo atómico en compra/aprobación — sin sobreventa, a costa de serializar (techo conocido).
- ⚠️ Pendiente (barato, alto impacto): compresión de comprobantes y optimización de la foto del premio.
- ⚠️ Pendiente (config): verificar que se usa el **pooler** de Supabase en producción.
- 🔜 Decisión de negocio: pasar Supabase a **Pro** cuando la web deba vivir todo el año o cuando una rifa supere ~300-400 solicitudes.
